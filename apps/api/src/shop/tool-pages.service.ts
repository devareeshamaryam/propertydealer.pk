import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { RevalidateService } from '../revalidate/revalidate.service';
import { RedisCacheService } from '../redis-cache/redis-cache.service';

/*
 * The admin's words for each tool page (/tools/<slug>) and the tools page
 * itself (slug "index"): SEO title, description and keywords, a sharing
 * picture, the heading and intro, a block of rich text shown under the tool,
 * and extra questions. Anything left empty keeps the page's built-in text.
 */

export interface ToolPageText {
  metaTitle?: string;
  metaDescription?: string;
  /** Comma-separated. */
  keywords?: string;
  /** Picture shown when the page is shared (Facebook, WhatsApp…). */
  ogImage?: string;
  heading?: string;
  intro?: string;
  contentTitle?: string;
  /** Rich text from the admin's editor. */
  content?: string;
  faqs?: { q: string; a: string }[];
  /** Keep the page out of search results. */
  noindex?: boolean;
  updatedAt?: Date;
}

const DOC_ID = 'tool_pages';
const SLUG = /^[a-z0-9][a-z0-9-]{1,59}$/;

const text = (v: unknown, max: number) =>
  String(v ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, max);

/** Rich text: drop scripts, embedded pages, event handlers and javascript: links. */
function richText(v: unknown): string {
  return String(v ?? '')
    .replace(/<(script|style|iframe|object|embed|form)[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(script|style|iframe|object|embed|form|meta|link|base)\b[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(["']?)\s*(javascript|vbscript|data):[^"'\s>]*\2/gi, '$1="#"')
    .trim()
    .slice(0, 60_000);
}

function imageUrl(v: unknown): string {
  const s = String(v ?? '').trim().slice(0, 600);
  return /^(https?:\/\/|\/)[^\s"'<>]+$/i.test(s) ? s : '';
}

function clean(input: any): ToolPageText {
  const p = input && typeof input === 'object' ? input : {};
  const faqs = (Array.isArray(p.faqs) ? p.faqs : [])
    .map((f: any) => ({ q: text(f?.q, 200), a: text(f?.a, 1500) }))
    .filter((f: { q: string; a: string }) => f.q && f.a)
    .slice(0, 20);
  const keywords = text(p.keywords, 600)
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, 30)
    .join(', ');
  const content = richText(p.content);
  const out: ToolPageText = {
    metaTitle: text(p.metaTitle, 90),
    metaDescription: text(p.metaDescription, 250),
    keywords,
    ogImage: imageUrl(p.ogImage),
    heading: text(p.heading, 140),
    intro: text(p.intro, 700),
    contentTitle: text(p.contentTitle, 140),
    // An editor left empty still holds "<p></p>".
    content: content.replace(/<[^>]*>|&nbsp;|\s/g, '') ? content : '',
    faqs,
    noindex: !!p.noindex,
  };
  for (const k of Object.keys(out) as (keyof ToolPageText)[]) {
    const v = out[k];
    if (v === '' || v === false || (Array.isArray(v) && !v.length)) delete out[k];
  }
  return out;
}

@Injectable()
export class ToolPagesService {
  constructor(
    @InjectConnection() private readonly conn: Connection,
    private readonly revalidate: RevalidateService,
    private readonly cache: RedisCacheService,
  ) {}

  private get store() {
    return this.conn.db!.collection<{ _id: string; pages?: Record<string, ToolPageText> }>('tool_config');
  }

  private slug(s: string): string {
    const v = String(s ?? '').toLowerCase();
    if (!SLUG.test(v)) throw new BadRequestException('Unknown page');
    return v;
  }

  async all(): Promise<Record<string, ToolPageText>> {
    return (await this.store.findOne({ _id: DOC_ID }))?.pages ?? {};
  }

  async one(slug: string): Promise<ToolPageText> {
    return (await this.all())[this.slug(slug)] ?? {};
  }

  async save(slug: string, input: unknown): Promise<ToolPageText> {
    const s = this.slug(slug);
    const page = { ...clean(input), updatedAt: new Date() };
    await this.store.updateOne({ _id: DOC_ID }, { $set: { [`pages.${s}`]: page } }, { upsert: true });
    await this.refresh(s);
    return page;
  }

  async reset(slug: string): Promise<ToolPageText> {
    const s = this.slug(slug);
    await this.store.updateOne({ _id: DOC_ID }, { $unset: { [`pages.${s}`]: '' } });
    await this.refresh(s);
    return {};
  }

  private async refresh(slug: string) {
    await this.cache.invalidateTags(['tool-pages']).catch(() => undefined);
    await this.revalidate
      .revalidate({ tags: ['tool-pages'], paths: [slug === 'index' ? '/tools' : `/tools/${slug}`] })
      .catch(() => undefined);
  }
}

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  SiteSetting,
  SiteSettingDocument,
  SITE_FONTS,
  type SiteFont,
} from '@rent-ghar/db/schemas/site-setting.schema';
import { RevalidateService } from '../revalidate/revalidate.service';

export interface SiteSettingsInput {
  primaryColor?: string;
  darkColor?: string;
  radius?: number | string;
  font?: string;
  logoUrl?: string;
  logoHeight?: number | string;
  footerLogoUrl?: string;
  faviconUrl?: string;
  heroTitle?: string;
  heroSubtitle?: string;
}

export interface SiteSettings {
  primaryColor: string;
  darkColor: string;
  radius: number;
  font: SiteFont;
  logoUrl: string;
  logoHeight: number;
  footerLogoUrl: string;
  faviconUrl: string;
  heroTitle: string;
  heroSubtitle: string;
}

const DEFAULTS: SiteSettings = {
  primaryColor: '',
  darkColor: '',
  radius: 8,
  font: 'geist',
  logoUrl: '',
  logoHeight: 32,
  footerLogoUrl: '',
  faviconUrl: '',
  heroTitle: '',
  heroSubtitle: '',
};

const KEY = 'site';

/** "#rrggbb" (or "#rgb", expanded), otherwise "" — so a typo can never break the CSS. */
function hex(value: unknown): string {
  const v = String(value ?? '').trim();
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(v);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase();
  return '';
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/** Only our own uploads or a full https URL — nothing that could inject markup. */
function url(value: unknown): string {
  const v = String(value ?? '').trim();
  if (!v) return '';
  if (v.startsWith('/uploads/') || /^https?:\/\/[^\s"'<>]+$/i.test(v)) return v.slice(0, 500);
  return '';
}

function text(value: unknown, max: number): string {
  return String(value ?? '').replace(/[<>]/g, '').trim().slice(0, max);
}

@Injectable()
export class SiteSettingsService {
  constructor(
    @InjectModel(SiteSetting.name)
    private readonly model: Model<SiteSettingDocument>,
    private readonly revalidate: RevalidateService,
  ) {}

  async get(): Promise<SiteSettings> {
    const doc = await this.model.findOne({ key: KEY }).lean().exec();
    if (!doc) return { ...DEFAULTS };
    return {
      primaryColor: hex(doc.primaryColor),
      darkColor: hex(doc.darkColor),
      radius: clampInt(doc.radius, 0, 16, DEFAULTS.radius),
      font: SITE_FONTS.includes(doc.font) ? doc.font : DEFAULTS.font,
      logoUrl: url(doc.logoUrl),
      logoHeight: clampInt(doc.logoHeight, 20, 64, DEFAULTS.logoHeight),
      footerLogoUrl: url(doc.footerLogoUrl),
      faviconUrl: url(doc.faviconUrl),
      heroTitle: text(doc.heroTitle, 120),
      heroSubtitle: text(doc.heroSubtitle, 200),
    };
  }

  async update(input: SiteSettingsInput): Promise<SiteSettings> {
    const set: Partial<SiteSettings> = {};
    if (input.primaryColor !== undefined) set.primaryColor = hex(input.primaryColor);
    if (input.darkColor !== undefined) set.darkColor = hex(input.darkColor);
    if (input.radius !== undefined) set.radius = clampInt(input.radius, 0, 16, DEFAULTS.radius);
    if (input.font !== undefined) {
      set.font = SITE_FONTS.includes(input.font as SiteFont) ? (input.font as SiteFont) : DEFAULTS.font;
    }
    if (input.logoUrl !== undefined) set.logoUrl = url(input.logoUrl);
    if (input.logoHeight !== undefined) set.logoHeight = clampInt(input.logoHeight, 20, 64, DEFAULTS.logoHeight);
    if (input.footerLogoUrl !== undefined) set.footerLogoUrl = url(input.footerLogoUrl);
    if (input.faviconUrl !== undefined) set.faviconUrl = url(input.faviconUrl);
    if (input.heroTitle !== undefined) set.heroTitle = text(input.heroTitle, 120);
    if (input.heroSubtitle !== undefined) set.heroSubtitle = text(input.heroSubtitle, 200);

    await this.model
      .updateOne({ key: KEY }, { $set: set, $setOnInsert: { key: KEY } }, { upsert: true })
      .exec();

    // Every page carries these variables, so the whole site is refreshed.
    await this.revalidate.revalidate({ tags: ['site-settings'], paths: ['/'] });

    return this.get();
  }
}

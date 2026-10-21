import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  SiteSetting,
  SiteSettingDocument,
  SITE_FONTS,
} from '@rent-ghar/db/schemas/site-setting.schema';
import { RevalidateService } from '../revalidate/revalidate.service';

/*
 * Every setting the admin can change, with its type and limits.
 *
 * Reading fills in the default for anything never saved; writing accepts only
 * these keys and coerces each value to its type, so a typo can never break a
 * page (a bad colour becomes "use the default", a script tag in a text field
 * loses its brackets). The web app mirrors this list in lib/site-settings.ts.
 */
type Field =
  | { kind: 'color'; def: string }
  | { kind: 'url'; def: string }
  | { kind: 'link'; def: string }
  | { kind: 'text'; def: string; max: number }
  | { kind: 'int'; def: number; min: number; max: number }
  | { kind: 'bool'; def: boolean }
  | { kind: 'enum'; def: string; options: readonly string[] }
  | { kind: 'email'; def: string }
  | { kind: 'ga'; def: string }
  | { kind: 'adclient'; def: string }
  | { kind: 'adslot'; def: string };

const FIELDS = {
  // ── Appearance ──
  primaryColor: { kind: 'color', def: '' },
  darkColor: { kind: 'color', def: '' },
  priceTagColor: { kind: 'color', def: '' },
  browserBarColor: { kind: 'color', def: '' },
  radius: { kind: 'int', def: 8, min: 0, max: 24 },
  buttonShape: { kind: 'enum', def: 'rounded', options: ['rounded', 'pill'] },
  tabBarShape: { kind: 'enum', def: 'rounded', options: ['rounded', 'pill'] },
  font: { kind: 'enum', def: 'geist', options: SITE_FONTS },
  logoUrl: { kind: 'url', def: '' },
  logoHeight: { kind: 'int', def: 32, min: 16, max: 72 },
  logoHeightMobile: { kind: 'int', def: 28, min: 16, max: 56 },
  footerLogoUrl: { kind: 'url', def: '' },
  faviconUrl: { kind: 'url', def: '' },
  heroTitle: { kind: 'text', def: '', max: 120 },
  heroSubtitle: { kind: 'text', def: '', max: 200 },
  heroImageEnabled: { kind: 'bool', def: true },
  heroImageUrl: { kind: 'url', def: '' },
  heroOverlay: { kind: 'int', def: 50, min: 0, max: 95 },

  // ── General: identity & contact ──
  siteName: { kind: 'text', def: '', max: 60 },
  tagline: { kind: 'text', def: '', max: 140 },
  contactPhone: { kind: 'text', def: '', max: 30 },
  contactWhatsapp: { kind: 'text', def: '', max: 30 },
  contactEmail: { kind: 'email', def: '' },
  address: { kind: 'text', def: '', max: 200 },
  officeHours: { kind: 'text', def: '', max: 100 },

  // ── Social ──
  socialFacebook: { kind: 'url', def: '' },
  socialInstagram: { kind: 'url', def: '' },
  socialYoutube: { kind: 'url', def: '' },
  socialLinkedin: { kind: 'url', def: '' },
  socialTiktok: { kind: 'url', def: '' },
  socialX: { kind: 'url', def: '' },

  // ── Footer ──
  footerAbout: { kind: 'text', def: '', max: 400 },
  copyrightText: { kind: 'text', def: '', max: 150 },

  // ── SEO & tracking ──
  seoTitle: { kind: 'text', def: '', max: 70 },
  seoDescription: { kind: 'text', def: '', max: 200 },
  ogImageUrl: { kind: 'url', def: '' },
  gaMeasurementId: { kind: 'ga', def: '' },
  googleVerification: { kind: 'text', def: '', max: 100 },

  // ── Announcement bar ──
  announcementEnabled: { kind: 'bool', def: false },
  announcementText: { kind: 'text', def: '', max: 160 },
  announcementLink: { kind: 'link', def: '' },

  // ── Homepage sections ──
  homeShowCities: { kind: 'bool', def: true },
  homeShowLatest: { kind: 'bool', def: true },
  homeLatestCount: { kind: 'int', def: 8, min: 4, max: 16 },
  homeShowAgentBand: { kind: 'bool', def: true },
  homeShowPlans: { kind: 'bool', def: true },
  homeShowRates: { kind: 'bool', def: true },
  homeShowAgencies: { kind: 'bool', def: true },
  homeShowExplore: { kind: 'bool', def: true },
  homeShowBlog: { kind: 'bool', def: true },
  homeShowFaq: { kind: 'bool', def: true },
  defaultCity: { kind: 'text', def: 'lahore', max: 60 },

  // ── Listings ──
  listingsPerPage: { kind: 'int', def: 12, min: 6, max: 48 },
  soldGraceDays: { kind: 'int', def: 15, min: 0, max: 90 },
  floatingWhatsapp: { kind: 'bool', def: false },

  // ── Shop (construction materials) ──
  shopEnabled: { kind: 'bool', def: true },
  shopDeliveryFee: { kind: 'int', def: 0, min: 0, max: 1_000_000 },
  shopFreeDeliveryOver: { kind: 'int', def: 0, min: 0, max: 100_000_000 },
  shopMinOrder: { kind: 'int', def: 0, min: 0, max: 100_000_000 },
  shopCodEnabled: { kind: 'bool', def: true },
  shopOrderNote: { kind: 'text', def: '', max: 300 },
  shopWhatsapp: { kind: 'text', def: '', max: 30 },

  // ── Ads (Google AdSense) — off until the admin turns them on ──
  adsEnabled: { kind: 'bool', def: false },
  /** ca-pub-XXXXXXXXXXXXXXXX */
  adsClient: { kind: 'adclient', def: '' },
  /** The ad unit every placement uses unless it has its own. */
  adsSlot: { kind: 'adslot', def: '' },
  /** Inside the results: an ad after every this many listings. */
  adsArchiveEvery: { kind: 'int', def: 6, min: 3, max: 24 },
  // Each placement: on/off, and its own ad unit (empty = the one above).
  adsHomeTop: { kind: 'bool', def: false },
  adsHomeTopSlot: { kind: 'adslot', def: '' },
  adsHomeMiddle: { kind: 'bool', def: true },
  adsHomeMiddleSlot: { kind: 'adslot', def: '' },
  adsHomeBottom: { kind: 'bool', def: false },
  adsHomeBottomSlot: { kind: 'adslot', def: '' },
  adsArchiveTop: { kind: 'bool', def: false },
  adsArchiveTopSlot: { kind: 'adslot', def: '' },
  adsArchiveFeed: { kind: 'bool', def: true },
  adsArchiveFeedSlot: { kind: 'adslot', def: '' },
  adsArchiveSidebar: { kind: 'bool', def: true },
  adsArchiveSidebarSlot: { kind: 'adslot', def: '' },
  adsArchiveBottom: { kind: 'bool', def: false },
  adsArchiveBottomSlot: { kind: 'adslot', def: '' },
  adsListingTop: { kind: 'bool', def: false },
  adsListingTopSlot: { kind: 'adslot', def: '' },
  adsListingContent: { kind: 'bool', def: true },
  adsListingContentSlot: { kind: 'adslot', def: '' },
  adsListingSidebar: { kind: 'bool', def: true },
  adsListingSidebarSlot: { kind: 'adslot', def: '' },
  adsListingBottom: { kind: 'bool', def: false },
  adsListingBottomSlot: { kind: 'adslot', def: '' },
  adsSocietyContent: { kind: 'bool', def: true },
  adsSocietyContentSlot: { kind: 'adslot', def: '' },
  adsBlogContent: { kind: 'bool', def: true },
  adsBlogContentSlot: { kind: 'adslot', def: '' },
} as const satisfies Record<string, Field>;

type FieldKey = keyof typeof FIELDS;
export type SiteSettings = { [K in FieldKey]: (typeof FIELDS)[K]['def'] extends boolean ? boolean : (typeof FIELDS)[K]['def'] extends number ? number : string };
export type SiteSettingsInput = Partial<Record<FieldKey, unknown>>;

const KEY = 'site';

function coerce(field: Field, value: unknown): string | number | boolean {
  const raw = typeof value === 'string' ? value.trim() : value;
  switch (field.kind) {
    case 'color': {
      const v = String(raw ?? '');
      if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
      const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(v);
      return short
        ? `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase()
        : field.def;
    }
    case 'url': {
      // Our own uploads or a full http(s) URL — nothing that could inject markup.
      const v = String(raw ?? '');
      if (!v) return '';
      return v.startsWith('/uploads/') || /^https?:\/\/[^\s"'<>]+$/i.test(v) ? v.slice(0, 500) : field.def;
    }
    case 'link': {
      // A path on this site or a full URL.
      const v = String(raw ?? '');
      if (!v) return '';
      return /^\/[^\s"'<>]*$/.test(v) || /^https?:\/\/[^\s"'<>]+$/i.test(v) ? v.slice(0, 300) : field.def;
    }
    case 'text':
      return String(raw ?? '').replace(/[<>]/g, '').slice(0, field.max);
    case 'int': {
      const n = Math.round(Number(raw));
      return Number.isFinite(n) ? Math.min(field.max, Math.max(field.min, n)) : field.def;
    }
    case 'bool':
      return raw === true || raw === 'true' || raw === 1 || raw === '1';
    case 'enum':
      return field.options.includes(String(raw)) ? String(raw) : field.def;
    case 'email': {
      const v = String(raw ?? '');
      return !v || /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v) ? v.slice(0, 120) : field.def;
    }
    case 'adclient': {
      // "ca-pub-" and 16 digits; a bare "pub-…" or the digits alone are accepted too.
      const digits = String(raw ?? '').replace(/^ca-/i, '').replace(/^pub-/i, '').trim();
      if (!digits) return '';
      return /^\d{10,20}$/.test(digits) ? `ca-pub-${digits}` : field.def;
    }
    case 'adslot': {
      const v = String(raw ?? '').trim();
      return !v || /^\d{5,20}$/.test(v) ? v : field.def;
    }
    case 'ga': {
      const v = String(raw ?? '').toUpperCase();
      return !v || /^G-[A-Z0-9]{4,15}$/.test(v) ? v : field.def;
    }
  }
}

@Injectable()
export class SiteSettingsService {
  constructor(
    @InjectModel(SiteSetting.name)
    private readonly model: Model<SiteSettingDocument>,
    private readonly revalidate: RevalidateService,
  ) {}

  /*
   * Read on every listing query (sold/rented grace days), so it is kept in
   * memory for a minute; a save clears it at once.
   */
  private memo: { at: number; value: SiteSettings } | null = null;

  async get(): Promise<SiteSettings> {
    if (this.memo && Date.now() - this.memo.at < 60_000) return this.memo.value;
    const value = await this.read();
    this.memo = { at: Date.now(), value };
    return value;
  }

  private async read(): Promise<SiteSettings> {
    const doc = (await this.model.findOne({ key: KEY }).lean().exec()) as Record<string, unknown> | null;
    const out: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(FIELDS) as [FieldKey, Field][]) {
      out[key] = doc && doc[key] !== undefined && doc[key] !== null ? coerce(field, doc[key]) : field.def;
    }
    return out as SiteSettings;
  }

  async update(input: SiteSettingsInput): Promise<SiteSettings> {
    const set: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(FIELDS) as [FieldKey, Field][]) {
      if (input && Object.prototype.hasOwnProperty.call(input, key)) {
        set[key] = coerce(field, input[key]);
      }
    }

    if (Object.keys(set).length > 0) {
      await this.model
        .updateOne({ key: KEY }, { $set: set, $setOnInsert: { key: KEY } }, { upsert: true, strict: false })
        .exec();
    }

    this.memo = null;
    // Every page carries these values, so the whole site is refreshed — and
    // the listing caches, since the sold/rented grace period is one of them.
    await this.revalidate.revalidate({ tags: ['site-settings', 'properties'], paths: ['/'] });

    return this.get();
  }
}

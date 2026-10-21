import { DEFAULT_AD_SETTINGS, type AdSettings } from './ads';

/**
 * Site-wide settings, as saved in Admin → Settings (General, Appearance, Shop).
 *
 * Shared by the server (root layout: CSS variables, metadata, analytics) and
 * the client (header, hero, footer, listing page). Types and pure functions
 * only; the server fetch is in lib/site-settings.server.ts. The API keeps the
 * same list, with validation, in apps/api/src/site-settings.
 */

export const SITE_FONTS = [
  { value: 'geist', label: 'Geist (default)' },
  { value: 'inter', label: 'Inter' },
  { value: 'poppins', label: 'Poppins' },
  { value: 'roboto', label: 'Roboto' },
  { value: 'open-sans', label: 'Open Sans' },
] as const;

export type SiteFont = (typeof SITE_FONTS)[number]['value'];

export interface SiteSettings extends AdSettings {
  // Appearance
  primaryColor: string;
  darkColor: string;
  priceTagColor: string;
  /** The phone browser's address-bar colour (meta theme-color). Empty = white, like the header. */
  browserBarColor: string;
  radius: number;
  buttonShape: 'rounded' | 'pill';
  tabBarShape: 'rounded' | 'pill';
  font: SiteFont;
  logoUrl: string;
  logoHeight: number;
  logoHeightMobile: number;
  footerLogoUrl: string;
  faviconUrl: string;
  heroTitle: string;
  heroSubtitle: string;
  heroImageEnabled: boolean;
  heroImageUrl: string;
  heroOverlay: number;
  // General
  siteName: string;
  tagline: string;
  contactPhone: string;
  contactWhatsapp: string;
  contactEmail: string;
  address: string;
  officeHours: string;
  socialFacebook: string;
  socialInstagram: string;
  socialYoutube: string;
  socialLinkedin: string;
  socialTiktok: string;
  socialX: string;
  footerAbout: string;
  copyrightText: string;
  seoTitle: string;
  seoDescription: string;
  ogImageUrl: string;
  gaMeasurementId: string;
  googleVerification: string;
  announcementEnabled: boolean;
  announcementText: string;
  announcementLink: string;
  homeShowCities: boolean;
  homeShowLatest: boolean;
  homeLatestCount: number;
  homeShowAgentBand: boolean;
  homeShowPlans: boolean;
  homeShowRates: boolean;
  homeShowAgencies: boolean;
  homeShowExplore: boolean;
  homeShowBlog: boolean;
  homeShowFaq: boolean;
  defaultCity: string;
  listingsPerPage: number;
  soldGraceDays: number;
  floatingWhatsapp: boolean;
  // Shop
  shopEnabled: boolean;
  shopDeliveryFee: number;
  shopFreeDeliveryOver: number;
  shopMinOrder: number;
  shopCodEnabled: boolean;
  shopOrderNote: string;
  shopWhatsapp: string;
}

/** The built-in look and details — what the site uses for anything left empty. */
export const DEFAULT_PRIMARY = '#1a56db';
export const DEFAULT_DARK = '#0f2c5c';
export const DEFAULT_PRICE_TAG = '#dc2626';
export const DEFAULT_HERO_TITLE = 'Find your perfect home in Pakistan';
export const DEFAULT_HERO_SUBTITLE =
  'Houses, flats, plots and shops for sale and rent, straight from local dealers.';
/** Hunza valley — "Beautiful Hunza" by Mehtab Farooq on Unsplash (free licence). */
export const DEFAULT_HERO_IMAGE =
  'https://images.unsplash.com/photo-1514558427911-8e293bebf18c?w=1920&q=70&auto=format&fit=crop';
export const DEFAULT_SITE_NAME = 'Property Dealer';
export const DEFAULT_PHONE = '+92 303 011 9992';
export const DEFAULT_EMAIL = 'propertydealer.pk01@gmail.com';
export const DEFAULT_GA_ID = 'G-GFGWSFNVDS';
export const DEFAULT_FOOTER_ABOUT =
  'Buy, sell and rent houses, plots, flats and commercial property across Pakistan — with today’s construction material rates alongside.';

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  primaryColor: '',
  darkColor: '',
  priceTagColor: '',
  browserBarColor: '',
  radius: 8,
  buttonShape: 'rounded',
  tabBarShape: 'rounded',
  font: 'geist',
  logoUrl: '',
  logoHeight: 32,
  logoHeightMobile: 28,
  footerLogoUrl: '',
  faviconUrl: '',
  heroTitle: '',
  heroSubtitle: '',
  heroImageEnabled: true,
  heroImageUrl: '',
  heroOverlay: 50,
  siteName: '',
  tagline: '',
  contactPhone: '',
  contactWhatsapp: '',
  contactEmail: '',
  address: '',
  officeHours: '',
  socialFacebook: '',
  socialInstagram: '',
  socialYoutube: '',
  socialLinkedin: '',
  socialTiktok: '',
  socialX: '',
  footerAbout: '',
  copyrightText: '',
  seoTitle: '',
  seoDescription: '',
  ogImageUrl: '',
  gaMeasurementId: '',
  googleVerification: '',
  announcementEnabled: false,
  announcementText: '',
  announcementLink: '',
  homeShowCities: true,
  homeShowLatest: true,
  homeLatestCount: 8,
  homeShowAgentBand: true,
  homeShowPlans: true,
  homeShowRates: true,
  homeShowAgencies: true,
  homeShowExplore: true,
  homeShowBlog: true,
  homeShowFaq: true,
  defaultCity: 'lahore',
  listingsPerPage: 12,
  soldGraceDays: 15,
  floatingWhatsapp: false,
  shopEnabled: true,
  shopDeliveryFee: 0,
  shopFreeDeliveryOver: 0,
  shopMinOrder: 0,
  shopCodEnabled: true,
  shopOrderNote: '',
  shopWhatsapp: '',
  ...DEFAULT_AD_SETTINGS,
};

/** Social links the footer shows until the admin enters their own. */
export const DEFAULT_SOCIALS: [string, string][] = [
  ['Facebook', 'https://www.facebook.com/pkpropertydealer'],
  ['YouTube', 'https://www.youtube.com/@Propertydealer-y9r'],
  ['LinkedIn', 'https://www.linkedin.com/company/propertydealer-pk/about/'],
];
export const DEFAULT_SEO_TITLE = 'Property Dealer | Buy, Sell & Rent Property';
export const DEFAULT_SEO_DESCRIPTION =
  'Property Dealer is a property buying and selling marketplace across Pakistan, connecting buyers and sellers for residential and commercial real estate.';
export const DEFAULT_TAGLINE = 'Serving buyers, renters and dealers across Pakistan since 2007.';
export const DEFAULT_COPYRIGHT = '© {year} Property Dealer. All rights reserved.';

/**
 * What the live site shows for each setting left empty — so the settings
 * screens can show the real values in their fields rather than blanks.
 * Saving one of these unchanged stores the same value, so nothing on the
 * site moves.
 */
export const LIVE_DEFAULTS: Partial<SiteSettings> = {
  siteName: DEFAULT_SITE_NAME,
  tagline: DEFAULT_TAGLINE,
  contactPhone: DEFAULT_PHONE,
  contactWhatsapp: DEFAULT_PHONE,
  contactEmail: DEFAULT_EMAIL,
  footerAbout: DEFAULT_FOOTER_ABOUT,
  copyrightText: DEFAULT_COPYRIGHT,
  seoTitle: DEFAULT_SEO_TITLE,
  seoDescription: DEFAULT_SEO_DESCRIPTION,
  gaMeasurementId: DEFAULT_GA_ID,
  socialFacebook: DEFAULT_SOCIALS[0]![1],
  socialYoutube: DEFAULT_SOCIALS[1]![1],
  socialLinkedin: DEFAULT_SOCIALS[2]![1],
  heroTitle: DEFAULT_HERO_TITLE,
  heroSubtitle: DEFAULT_HERO_SUBTITLE,
};

/** The settings with every empty field showing its live value. */
export function withLiveDefaults(s: SiteSettings): SiteSettings {
  const out = { ...s };
  // The footer's fallback social links apply only while none are set.
  const anySocial = [s.socialFacebook, s.socialInstagram, s.socialYoutube, s.socialLinkedin, s.socialTiktok, s.socialX].some(Boolean);
  for (const [k, v] of Object.entries(LIVE_DEFAULTS) as [keyof SiteSettings, never][]) {
    if (String(k).startsWith('social') && anySocial) continue;
    if (out[k] === '' || out[k] === undefined || out[k] === null) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

export const isHex = (v?: string) => !!v && /^#[0-9a-f]{6}$/i.test(v);

/** Values with their defaults applied, for rendering. */
export function resolved(s: SiteSettings) {
  const phone = s.contactPhone || DEFAULT_PHONE;
  return {
    siteName: s.siteName || DEFAULT_SITE_NAME,
    phone,
    phoneHref: `tel:${phone.replace(/[^\d+]/g, '')}`,
    whatsapp: s.contactWhatsapp || phone,
    email: s.contactEmail || DEFAULT_EMAIL,
    footerAbout: s.footerAbout || DEFAULT_FOOTER_ABOUT,
    heroTitle: s.heroTitle || DEFAULT_HERO_TITLE,
    heroSubtitle: s.heroSubtitle || DEFAULT_HERO_SUBTITLE,
    heroImage: s.heroImageEnabled ? s.heroImageUrl || DEFAULT_HERO_IMAGE : '',
    gaId: s.gaMeasurementId || DEFAULT_GA_ID,
    socials: [
      ['Facebook', s.socialFacebook],
      ['Instagram', s.socialInstagram],
      ['YouTube', s.socialYoutube],
      ['LinkedIn', s.socialLinkedin],
      ['TikTok', s.socialTiktok],
      ['X', s.socialX],
    ].filter(([, url]) => Boolean(url)) as [string, string][],
  };
}

/** Pakistani numbers in the form wa.me accepts: 92 + number without the leading 0. */
export function waDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('92')) return digits;
  return `92${digits.replace(/^0/, '')}`;
}

/**
 * CSS variables for <html>. Shades are derived with color-mix, so a single
 * colour from the admin produces the light tint (badges, hovers) and the dark
 * text-on-tint shade as well.
 */
export function themeStyle(s: SiteSettings): Record<string, string> {
  const vars: Record<string, string> = {};

  if (isHex(s.primaryColor)) {
    const p = s.primaryColor;
    vars['--primary'] = p;
    vars['--ring'] = p;
    vars['--accent'] = `color-mix(in srgb, ${p} 8%, white)`;
    vars['--accent-foreground'] = `color-mix(in srgb, ${p} 78%, black)`;
    vars['--sidebar-primary'] = p;
    vars['--sidebar-ring'] = p;
  }
  if (isHex(s.darkColor)) vars['--brand-navy'] = s.darkColor;
  if (isHex(s.priceTagColor)) vars['--price-tag'] = s.priceTagColor;
  const radius = Number.isFinite(s.radius) ? Math.min(24, Math.max(0, s.radius)) : 8;
  if (radius !== 8) vars['--radius'] = `${radius}px`;
  // Buttons and the phone tab bar can be fully round on their own, whatever
  // the corner size of cards and inputs.
  vars['--btn-radius'] = s.buttonShape === 'pill' ? '9999px' : `${radius + 4}px`;
  vars['--tabbar-radius'] = s.tabBarShape === 'pill' ? '9999px' : `${Math.max(14, radius + 14)}px`;
  if (s.font && s.font !== 'geist') vars['--site-font'] = `var(--font-${s.font})`;
  vars['--logo-h'] = `${s.logoHeightMobile || 28}px`;
  vars['--logo-h-lg'] = `${s.logoHeight || 32}px`;
  return vars;
}

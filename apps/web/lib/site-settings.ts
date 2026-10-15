/**
 * The site's appearance, as saved in Admin → Settings → Appearance.
 *
 * Shared by the server (root layout: CSS variables, favicon) and the client
 * (logo, hero text), so this file only holds types and pure functions; the
 * server fetch lives in lib/site-settings.server.ts.
 */

export const SITE_FONTS = [
  { value: 'geist', label: 'Geist (default)' },
  { value: 'inter', label: 'Inter' },
  { value: 'poppins', label: 'Poppins' },
  { value: 'roboto', label: 'Roboto' },
  { value: 'open-sans', label: 'Open Sans' },
] as const;

export type SiteFont = (typeof SITE_FONTS)[number]['value'];

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

/** The built-in look — what the site shows when nothing has been saved. */
export const DEFAULT_PRIMARY = '#1a56db';
export const DEFAULT_DARK = '#0f2c5c';
export const DEFAULT_HERO_TITLE = 'Find your perfect home in Pakistan';
export const DEFAULT_HERO_SUBTITLE =
  'Houses, flats, plots and shops for sale and rent, straight from local dealers.';

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
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

const isHex = (v?: string) => !!v && /^#[0-9a-f]{6}$/i.test(v);

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
  if (isHex(s.darkColor)) {
    vars['--brand-navy'] = s.darkColor;
  }
  if (Number.isFinite(s.radius) && s.radius !== 8) {
    vars['--radius'] = `${Math.min(16, Math.max(0, s.radius))}px`;
  }
  if (s.font && s.font !== 'geist') {
    vars['--site-font'] = `var(--font-${s.font})`;
  }
  return vars;
}

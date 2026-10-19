import { cache } from 'react';
import { DEFAULT_SITE_SETTINGS, resolved, type SiteSettings } from './site-settings';

function apiBase(): string {
  const raw =
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://propertydealer.pk';
  return raw.endsWith('/') ? `${raw}api` : `${raw}/api`;
}

/**
 * Read once per request (React cache), stored by Next for an hour and thrown
 * away the moment the admin saves (the API revalidates the "site-settings"
 * tag). Never throws: if the API is down — or this is the build, with no API
 * at all — the site renders with its built-in look.
 */
export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  try {
    const response = await fetch(`${apiBase()}/site-settings`, {
      next: { revalidate: 300, tags: ['site-settings'] },
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return DEFAULT_SITE_SETTINGS;
    const json = await response.json();
    return { ...DEFAULT_SITE_SETTINGS, ...(json?.data ?? {}) };
  } catch {
    return DEFAULT_SITE_SETTINGS;
  }
});

/** The site's name for titles and text — Settings → General → Site name, else "Property Dealer". */
export async function getSiteName(): Promise<string> {
  return resolved(await getSiteSettings()).siteName;
}

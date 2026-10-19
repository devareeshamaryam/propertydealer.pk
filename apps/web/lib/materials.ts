/*
 * Materials added from the dashboard (Dashboard → Materials), next to the
 * eight built in. Each gets /today-<slug>-rate-in-pakistan, a page per
 * product, and a place in the menu, the footer, the shop and the sitemap —
 * all read from GET /material-types, so a new one needs no code change.
 */

export interface MaterialTypeInfo {
  _id: string;
  name: string;
  slug: string;
  unit: string;
  description?: string;
  path: string;
  order?: number;
}

export interface MaterialTypeAdmin extends MaterialTypeInfo {
  content?: string;
  metaTitle?: string;
  metaDescription?: string;
  image?: string;
  isActive: boolean;
  rates: number;
  createdAt?: string;
}

/** /today-marble-rate-in-pakistan → "marble"; null for any other address. */
export function materialSlugFromPage(page: string): string | null {
  const m = /^today-([a-z0-9-]+)-rate-in-pakistan$/.exec(String(page ?? '').toLowerCase());
  return m ? m[1]! : null;
}

function apiBase(): string {
  const raw = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://propertydealer.pk';
  return raw.endsWith('/api') ? raw : `${raw.replace(/\/$/, '')}/api`;
}

/** Server side: the active materials (cached; refreshed when the admin saves one). Never throws. */
export async function getMaterialTypes(): Promise<MaterialTypeInfo[]> {
  try {
    const res = await fetch(`${apiBase()}/material-types`, { next: { revalidate: 600, tags: ['material-types'] }, signal: AbortSignal.timeout(4000) });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json?.data) ? json.data : [];
  } catch {
    return [];
  }
}

/** Server side: one material's page data, or null when there is no such (active) material. Throws when the API is down. */
export async function getMaterialType(slug: string): Promise<(MaterialTypeAdmin & { content?: string }) | null> {
  const res = await fetch(`${apiBase()}/material-types/slug/${encodeURIComponent(slug)}`, { next: { revalidate: 300, tags: ['material-types'] } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`material type ${slug}: ${res.status}`);
  return (await res.json())?.data ?? null;
}

/** Server side: a material's active rates. */
export async function getMaterialRates(slug: string): Promise<any[]> {
  const res = await fetch(`${apiBase()}/material-rate?materialType=${encodeURIComponent(slug)}`, { next: { revalidate: 60, tags: ['material-rates'] } });
  if (!res.ok) throw new Error(`material rates ${slug}: ${res.status}`);
  const json = await res.json();
  return Array.isArray(json) ? json : json?.data ?? [];
}

/** Server side: one product of a material, or null. */
export async function getMaterialRate(slug: string, item: string): Promise<any | null> {
  const res = await fetch(`${apiBase()}/material-rate/slug/${encodeURIComponent(item)}?materialType=${encodeURIComponent(slug)}`, {
    next: { revalidate: 60, tags: ['material-rates'] },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`material rate ${slug}/${item}: ${res.status}`);
  return res.json();
}

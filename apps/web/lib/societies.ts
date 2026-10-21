/*
 * Housing societies — the guide pages (/societies/<city>/<slug>) and the
 * society boxes on listing pages. See the API's SocietyService.
 */

export interface SocietyGuide {
  published?: boolean;
  image?: string;
  gallery?: string[];
  tagline?: string;
  overview?: string;
  developer?: string;
  approvedBy?: string;
  approval?: 'approved' | 'in-process' | 'not-approved' | '';
  totalArea?: string;
  launched?: string;
  possession?: string;
  plotSizes?: string;
  address?: string;
  nearby?: string[];
  amenities?: string[];
  paymentPlan?: string;
  phone?: string;
  website?: string;
  faqs?: { q: string; a: string }[];
  metaTitle?: string;
  metaDescription?: string;
}

export interface SocietyCard {
  _id: string;
  name: string;
  slug: string;
  citySlug: string;
  cityName: string;
  image: string;
  tagline: string;
  approval: string;
  approvedBy: string;
  phases: number;
  listings: number;
  priceFrom: number;
}

export interface PriceRow {
  size: string;
  marla: number;
  segment: string;
  min: number;
  max: number;
  count: number;
}

export interface SocietyPhase {
  _id: string;
  name: string;
  slug: string;
  order: number;
  image: string;
  tagline: string;
  overview: string;
  sale: number;
  rent: number;
  map: { slug: string; citySlug: string } | null;
}

type Range = { min: number; max: number; count: number } | null;

export interface SocietyPage {
  _id: string;
  name: string;
  slug: string;
  city: { _id: string; name: string; slug: string };
  lat: number | null;
  lng: number | null;
  guide: SocietyGuide;
  published: boolean;
  phases: SocietyPhase[];
  stats: { sale: number; rent: number; house: Range; plot: Range; flat: Range; houseRent: Range };
  prices: Record<string, { sale: PriceRow[]; rent: PriceRow[] }>;
  map: { slug: string; citySlug: string; name: string; thumb: string; center: { lat: number; lng: number } | null } | null;
  nearby: SocietyCard[];
  updatedAt: string | null;
}

export interface AreaSociety {
  name: string;
  slug: string;
  citySlug: string;
  url: string | null;
  image: string;
  tagline: string;
  isPhase: boolean;
  phases: { name: string; slug: string }[];
}

export const APPROVAL_LABELS: Record<string, { label: string; tone: 'good' | 'ok' | 'bad' }> = {
  approved: { label: 'Approved', tone: 'good' },
  'in-process': { label: 'Approval in process', tone: 'ok' },
  'not-approved': { label: 'Not approved', tone: 'bad' },
};

/** "1.5 Crore", "85 Lakh", "45,000" — prices the way they are said in Pakistan. */
export function pkPrice(n: number): string {
  if (!n) return '';
  if (n >= 10_000_000) return `${+(n / 10_000_000).toFixed(2)} Crore`;
  if (n >= 100_000) return `${+(n / 100_000).toFixed(2)} Lakh`;
  return n.toLocaleString('en-PK');
}

export const societyPath = (citySlug: string, slug: string) => `/societies/${citySlug}/${slug}`;

const title = (t: string) => t.replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * The guide's questions: the admin's own, or — when there are none — the
 * common ones, answered from what the guide already knows (approval,
 * phases, plot sizes, today's listings). Nothing is guessed.
 */
export function guideFaqs(s: SocietyPage): { q: string; a: string }[] {
  if (s.guide.faqs?.length) return s.guide.faqs;
  const name = `${title(s.name)} ${s.city.name}`;
  const g = s.guide;
  const out: { q: string; a: string }[] = [];
  if (g.approval === 'approved') out.push({ q: `Is ${name} approved?`, a: `Yes. ${name} is approved${g.approvedBy ? ` by ${g.approvedBy}` : ''}.` });
  else if (g.approval === 'in-process') out.push({ q: `Is ${name} approved?`, a: `Its approval${g.approvedBy ? ` from ${g.approvedBy}` : ''} is in process. Check the latest status with the authority before buying.` });
  else if (g.approval === 'not-approved') out.push({ q: `Is ${name} approved?`, a: `${name} is not approved${g.approvedBy ? ` by ${g.approvedBy}` : ''}. Check the status with the authority before buying.` });
  const range = (r: { min: number; max: number } | null) => (r ? (r.min === r.max ? `PKR ${pkPrice(r.min)}` : `PKR ${pkPrice(r.min)} to ${pkPrice(r.max)}`) : '');
  if (s.stats.house) out.push({ q: `What is the price of a house in ${name}?`, a: `Houses for sale in ${name} are listed from ${range(s.stats.house)} right now, depending on size and location.` });
  if (s.stats.plot) out.push({ q: `What is the price of a plot in ${name}?`, a: `Plots for sale in ${name} are listed from ${range(s.stats.plot)} right now.` });
  if (s.stats.houseRent) out.push({ q: `What is the rent of a house in ${name}?`, a: `Houses for rent in ${name} are listed at ${range(s.stats.houseRent)} a month right now.` });
  if (s.phases.length) out.push({ q: `How many phases does ${name} have?`, a: `${name} has ${s.phases.length} ${s.phases.length === 1 ? 'phase' : 'phases'}: ${s.phases.map((p) => title(p.name)).join(', ')}.` });
  if (g.plotSizes) out.push({ q: `What plot sizes are available in ${name}?`, a: `${g.plotSizes}.` });
  if (g.developer) out.push({ q: `Who is the developer of ${name}?`, a: `${name} is developed by ${g.developer}.` });
  return out;
}

// ── Server reads ────────────────────────────────────────────────────────

const RAW = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';
const BASE = `${RAW.trim().replace(/\/$/, '')}/api`;

/** Null on a 404; throws when the API is down (so a cached page is kept), except during the build. */
async function read<T>(path: string, revalidate = 600): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      next: { revalidate, tags: ['societies', 'areas'] },
      signal: AbortSignal.timeout(15000),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`societies ${res.status} ${path}`);
    const json = await res.json();
    return (json?.data ?? json ?? null) as T | null;
  } catch (e) {
    if (process.env.NEXT_PHASE === 'phase-production-build') return null;
    throw e;
  }
}

/** Never throws — for boxes on other pages, which simply leave the box out. */
async function quiet<T>(path: string): Promise<T | null> {
  try {
    return await read<T>(path);
  } catch {
    return null;
  }
}

export async function getSocieties(citySlug?: string): Promise<SocietyCard[]> {
  const rows = await quiet<SocietyCard[]>(`/societies${citySlug ? `?city=${encodeURIComponent(citySlug)}` : ''}`);
  return Array.isArray(rows) ? rows : [];
}

export function getSocietyPage(citySlug: string, slug: string) {
  return read<SocietyPage>(`/societies/page/${encodeURIComponent(citySlug)}/${encodeURIComponent(slug)}`);
}

export function getAreaSociety(citySlug: string, areaSlug: string) {
  return quiet<AreaSociety>(`/societies/for-area?city=${encodeURIComponent(citySlug)}&area=${encodeURIComponent(areaSlug)}`);
}

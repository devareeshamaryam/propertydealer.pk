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

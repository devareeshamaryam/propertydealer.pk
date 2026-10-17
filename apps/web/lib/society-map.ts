/*
 * Society maps — the shapes the public API returns, and the server-side
 * fetchers for the /emap pages. Every fetch is optional: a missing map (or an
 * API that does not have the endpoint yet, mid-deploy) is null, and the page
 * falls back to the plain property map.
 */

export interface SocietyTileLayer {
  id: string;
  name: string;
  opacity: number;
  url: string;
  /** [south, west, north, east] */
  bounds: [number, number, number, number];
  minZoom: number;
  maxZoom: number;
  downloadUrl?: string;
}

export interface SocietyBlock {
  id: string;
  name: string;
  slug: string;
  polygon: [number, number][];
  color?: string;
}

export interface SocietyPoi {
  id: string;
  name: string;
  kind: string;
  lat: number;
  lng: number;
}

export interface SocietyInView {
  id: string;
  name: string;
  slug: string;
  citySlug: string;
  center: { lat: number; lng: number } | null;
  boundary: [number, number][];
  layers: SocietyTileLayer[];
}

export interface SocietyCard {
  id?: string;
  name: string;
  slug: string;
  citySlug: string;
  cityName?: string;
  center?: { lat: number; lng: number } | null;
  zoom?: number;
  thumb: string;
  blocks?: number;
  intro?: string;
  /** plan: master plan laid over the map · document: authority's plan beside it · outline: boundary only */
  kind?: 'plan' | 'document' | 'outline';
  official?: { authority: string; status: string } | null;
  plots?: number;
  updatedAt?: string;
}

export interface SocietyOfficial {
  authority: string;
  /** approved · approved-local · technically-approved · regularised · illegal */
  status: string;
  stage?: string;
  date?: string;
  approvedArea?: string;
  residentialPlots?: number;
  commercialPlots?: number;
  blocks?: string;
  mauza?: string;
  listName?: string;
  listUrl?: string;
  checkedAt?: string;
  phases?: { name: string; stage?: string; date?: string; approvedArea?: string; residentialPlots?: number; commercialPlots?: number }[];
}

export interface SocietyDocument {
  title: string;
  kind: string;
  url: string;
  thumbUrl: string;
  source: string;
  sourceUrl: string;
  width: number;
  height: number;
}

/** One plot from a society's GIS. */
export interface SocietyPlotHit {
  id: string;
  no: string;
  house: string;
  sector: string;
  use: string;
  kind: string;
  corner: boolean;
  sqft: number;
  lat: number;
  lng: number;
  ring: [number, number][];
  citySlug: string;
  mapSlug: string;
}

export const OFFICIAL_LABELS: Record<string, { label: string; tone: 'good' | 'ok' | 'bad' }> = {
  approved: { label: 'Approved', tone: 'good' },
  'approved-local': { label: 'Approved (local government)', tone: 'ok' },
  'technically-approved': { label: 'Technically approved', tone: 'ok' },
  regularised: { label: 'Regularised', tone: 'ok' },
  illegal: { label: 'Listed as illegal', tone: 'bad' },
};

export interface SocietyMapPage {
  id: string;
  name: string;
  slug: string;
  citySlug: string;
  cityName: string;
  areaSlug: string;
  areaId: string;
  center: { lat: number; lng: number } | null;
  zoom: number;
  boundary: [number, number][];
  layers: SocietyTileLayer[];
  blocks: SocietyBlock[];
  pois: SocietyPoi[];
  info: {
    developer?: string;
    approval?: string;
    totalArea?: string;
    launched?: string;
    possession?: string;
    plotSizes?: string;
    amenities?: string[];
    /** Where the society is, when only roughly known ("Approximate — around Mouza …"). */
    location?: string;
  };
  seo: { metaTitle?: string; metaDescription?: string; intro?: string; content?: string };
  faqs: { q: string; a: string }[];
  sponsor: { name?: string; tagline?: string; phone?: string; whatsapp?: string; logoUrl?: string; link?: string } | null;
  thumb: string;
  kind?: 'plan' | 'document' | 'outline';
  source?: string;
  official?: SocietyOfficial | null;
  documents?: SocietyDocument[];
  plotCount?: number;
  stats: { sale: number; rent: number; minPrice: number; maxPrice: number };
  nearby: SocietyCard[];
  updatedAt: string;
}

export const POI_LABELS: Record<string, string> = {
  gate: 'Gate',
  mosque: 'Mosque',
  school: 'School',
  hospital: 'Hospital',
  park: 'Park',
  commercial: 'Commercial',
  office: 'Site office',
  graveyard: 'Graveyard',
  grid: 'Grid station',
  landmark: 'Landmark',
  utility: 'Utility',
  parking: 'Parking',
  bank: 'Bank',
  fuel: 'Petrol pump',
  police: 'Police',
  restaurant: 'Restaurant',
};

/** One emoji per kind: tiny, no icon font, readable at a glance on a map. */
export const POI_ICONS: Record<string, string> = {
  gate: '🚪',
  mosque: '🕌',
  school: '🏫',
  hospital: '🏥',
  park: '🌳',
  commercial: '🏬',
  office: '🏢',
  graveyard: '🪦',
  grid: '⚡',
  landmark: '📍',
  utility: '🚰',
  parking: '🅿️',
  bank: '🏦',
  fuel: '⛽',
  police: '👮',
  restaurant: '🍽️',
};

/** "1 Kanal" · "10 Marla" · "4.5 Marla" — 225 sq ft a marla. */
export function plotSizeLabel(sqft: number): string {
  if (!sqft) return '';
  // The sizes plots are sold as, when the drawn outline is within 10% of one.
  const STANDARD: [number, string][] = [[900, '4 Marla'], [1125, '5 Marla'], [1575, '7 Marla'], [1800, '8 Marla'], [2250, '10 Marla'], [3375, '15 Marla'], [4500, '1 Kanal'], [9000, '2 Kanal'], [18000, '4 Kanal']];
  const snap = STANDARD.find(([s]) => Math.abs(sqft - s) / s <= 0.1);
  if (snap) return snap[1];
  const marla = sqft / 225;
  if (marla >= 19.5) {
    const kanal = marla / 20;
    return Math.abs(kanal - Math.round(kanal)) < 0.08 ? `${Math.round(kanal)} Kanal` : `${+kanal.toFixed(1)} Kanal`;
  }
  return Math.abs(marla - Math.round(marla)) < 0.25 ? `${Math.round(marla)} Marla` : `${+marla.toFixed(1)} Marla`;
}

const RAW = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';
const BASE = `${RAW.trim().replace(/\/$/, '')}/api`;

async function quiet<T>(path: string): Promise<T | null> {
  try {
    return await strict<T>(path);
  } catch {
    return null;
  }
}

/**
 * Null only when the API says there is nothing (404). A slow or failing API
 * throws instead, so a society page is never turned into a 404 because the
 * server was busy (e.g. making tiles) — Next keeps serving the last good page.
 */
async function strict<T>(path: string): Promise<T | null> {
  const res = await fetch(`${BASE}${path}`, {
    next: { revalidate: 600, tags: ['society-maps'] },
    signal: AbortSignal.timeout(15000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`society-maps ${res.status} ${path}`);
  const json = await res.json();
  return (json?.data ?? null) as T | null;
}

/**
 * Null when there is no published map at this address. While the site is
 * running, an API that is down or slow throws instead, so the cached page is
 * kept rather than replaced by a 404. During `next build` (the API may be
 * restarting) it is simply null, and the page is regenerated later.
 */
export async function getSocietyMap(city: string, slug: string) {
  const path = `/society-maps/page/${encodeURIComponent(city)}/${encodeURIComponent(slug)}`;
  if (process.env.NEXT_PHASE === 'phase-production-build') return quiet<SocietyMapPage>(path);
  return strict<SocietyMapPage>(path);
}

export async function getSocietyMaps(city?: string): Promise<SocietyCard[]> {
  const rows = await quiet<SocietyCard[]>(`/society-maps${city ? `?city=${encodeURIComponent(city)}` : ''}`);
  return Array.isArray(rows) ? rows : [];
}

export function lookupSocietyMap(city: string, area: string) {
  return quiet<{ name: string; url: string } | null>(
    `/society-maps/lookup?city=${encodeURIComponent(city)}&area=${encodeURIComponent(area)}`,
  );
}

/** Ray casting: is [lat, lng] inside the polygon? */
export function insidePolygon(lat: number, lng: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [yi, xi] = polygon[i]!;
    const [yj, xj] = polygon[j]!;
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Middle of a polygon's box — where its label goes. */
export function polygonCentre(polygon: [number, number][]): [number, number] {
  const lats = polygon.map((p) => p[0]);
  const lngs = polygon.map((p) => p[1]);
  return [(Math.min(...lats) + Math.max(...lats)) / 2, (Math.min(...lngs) + Math.max(...lngs)) / 2];
}

/** Area of a lat/lng polygon in square feet (small polygons; equirectangular). */
export function polygonSqft(polygon: [number, number][]): number {
  if (polygon.length < 3) return 0;
  const lat0 = (polygon.reduce((s, p) => s + p[0], 0) / polygon.length) * (Math.PI / 180);
  const m = 111_320;
  const pts = polygon.map(([lat, lng]) => [lng * m * Math.cos(lat0), lat * m]);
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i]!;
    const [x2, y2] = pts[(i + 1) % pts.length]!;
    a += x1! * y2! - x2! * y1!;
  }
  return Math.abs(a / 2) * 10.7639;
}

/** "3 Kanal 4 Marla" / "12.5 Marla" — 1 Marla = 225 sq ft (the standard most societies use). */
export function marlaLabel(sqft: number): string {
  const marla = sqft / 225;
  if (marla >= 20) {
    const kanal = Math.floor(marla / 20);
    const rest = Math.round(marla - kanal * 20);
    return rest ? `${kanal} Kanal ${rest} Marla` : `${kanal} Kanal`;
  }
  return `${+marla.toFixed(1)} Marla`;
}

export interface MapPlaceRow {
  name: string;
  slug: string;
  citySlug?: string;
  cityName?: string;
  lat: number;
  lng: number;
  listings: number;
  hasMap?: boolean;
  societies?: number;
}

/** Cities (no argument) or one city's societies, placed by their real listings. */
export async function getMapPlaces(city?: string): Promise<MapPlaceRow[]> {
  const rows = await quiet<MapPlaceRow[]>(`/society-maps/places${city ? `?city=${encodeURIComponent(city)}` : ''}`);
  return Array.isArray(rows) ? rows : [];
}

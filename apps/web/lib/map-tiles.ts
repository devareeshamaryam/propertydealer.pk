/**
 * Map tiles: Google's imagery, drawn by Leaflet.
 *
 * Leaflet stays — it is the renderer, and it needs no API key, no billing
 * account and no script tag. Only the tile source changes: CARTO/OSM tiles
 * showed half the societies in Pakistan as empty fields, while Google has the
 * phases, blocks and streets people actually navigate by. Satellite matters
 * even more here, because a plot in a new society is often only identifiable
 * from the air.
 *
 * Note for whoever maintains this: mt{0-3}.google.com/vt is Google's own tile
 * endpoint rather than a published API, so it carries no uptime promise and
 * using it this way is outside the Maps Platform terms. If it ever has to go,
 * swapping these URLs back is the only change needed — every map on the site
 * reads its tiles from this one file.
 */

export type MapStyle = "street" | "satellite" | "hybrid";

export interface TileSource {
  url: string;
  attribution: string;
  label: string;
  maxZoom: number;
  subdomains: string[];
}

/**
 * `lyrs` picks the layer: m = street map, s = pure satellite, y = satellite
 * with roads and labels on top.
 */
export const MAP_TILES: Record<MapStyle, TileSource> = {
  street: {
    url: "https://{s}.google.com/vt/lyrs=m&hl=en&x={x}&y={y}&z={z}",
    attribution: "&copy; Google",
    label: "Map",
    maxZoom: 20,
    subdomains: ["mt0", "mt1", "mt2", "mt3"],
  },
  satellite: {
    url: "https://{s}.google.com/vt/lyrs=s&hl=en&x={x}&y={y}&z={z}",
    attribution: "&copy; Google",
    label: "Satellite",
    maxZoom: 20,
    subdomains: ["mt0", "mt1", "mt2", "mt3"],
  },
  hybrid: {
    url: "https://{s}.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}",
    attribution: "&copy; Google",
    label: "Hybrid",
    maxZoom: 20,
    subdomains: ["mt0", "mt1", "mt2", "mt3"],
  },
};

/** Centre of Pakistan — the fallback when a listing has no coordinates. */
export const PAKISTAN_CENTER: [number, number] = [30.3753, 69.3451];

/** Big-city centres, so "Lahore" lands on Lahore rather than Balochistan. */
export const CITY_CENTERS: Record<string, [number, number]> = {
  lahore: [31.5204, 74.3587],
  karachi: [24.8607, 67.0011],
  islamabad: [33.6844, 73.0479],
  rawalpindi: [33.5973, 73.0479],
  faisalabad: [31.4504, 73.135],
  multan: [30.1575, 71.5249],
  peshawar: [34.0151, 71.5249],
  quetta: [30.1798, 66.975],
  gujranwala: [32.1877, 74.1945],
  sialkot: [32.4927, 74.5319],
  hyderabad: [25.396, 68.3578],
  bahawalpur: [29.3956, 71.6836],
  sargodha: [32.0836, 72.6711],
  abbottabad: [34.1688, 73.2215],
  sahiwal: [30.6682, 73.1114],
  gujrat: [32.5731, 74.0789],
};

export function cityCenter(city?: string | null): [number, number] | null {
  if (!city) return null;
  return CITY_CENTERS[city.trim().toLowerCase()] ?? null;
}

/* ───────────────────────── Address → coordinates ───────────────────────── */

export interface GeocodeHit {
  label: string;
  lat: number;
  lng: number;
}

/**
 * Turns a typed address into coordinates, using OpenStreetMap's Nominatim.
 *
 * Keyless and free, which is the point: it runs in the dashboard when an agent
 * presses "Find on map", a handful of times a day, well inside Nominatim's
 * fair-use limit. Pakistan is appended (and the country restricted) so "Model
 * Town" finds Lahore rather than Melbourne.
 */
export async function geocodeAddress(
  query: string,
  signal?: AbortSignal,
): Promise<GeocodeHit[]> {
  const text = query.trim();
  if (text.length < 3) return [];

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", /pakistan/i.test(text) ? text : `${text}, Pakistan`);
  url.searchParams.set("countrycodes", "pk");
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "0");

  const response = await fetch(url.toString(), {
    signal,
    headers: { Accept: "application/json" },
  });

  if (!response.ok) return [];

  const rows = (await response.json()) as {
    display_name?: string;
    lat?: string;
    lon?: string;
  }[];

  return rows
    .map((row) => ({
      label: row.display_name ?? "",
      lat: Number(row.lat),
      lng: Number(row.lon),
    }))
    .filter((hit) => Number.isFinite(hit.lat) && Number.isFinite(hit.lng));
}

/** Coordinates → a readable address, for filling the address box from a pin. */
export async function reverseGeocode(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<string | null> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("zoom", "18");

  try {
    const response = await fetch(url.toString(), {
      signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const row = (await response.json()) as { display_name?: string };
    return row.display_name ?? null;
  } catch {
    return null;
  }
}

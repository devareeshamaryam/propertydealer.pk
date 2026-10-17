'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import api from '@/lib/api';
import { CITIES } from '@/app/(pages)/emap/cities-data';

/*
 * The only names on the map.
 *
 * The base map has its own labels switched off, so this draws what matters
 * here, by zoom:
 *   - Country view (below zoom 10): one pin per city, with its listings count.
 *   - City view (10–15): the societies — placed at their published map's
 *     centre, or at the middle of their exactly pinned listings — as name pills.
 *     Pills that would overlap are dropped (societies with a map and the most
 *     listings win), so the map stays readable at every zoom, the way
 *     emap.pk does it.
 * Tapping a city or society opens its page.
 */

export interface CityPlace {
  name: string;
  slug: string;
  lat: number;
  lng: number;
  listings?: number;
  maps?: number;
}

interface SocietyPlace {
  name: string;
  slug: string;
  citySlug: string;
  lat: number;
  lng: number;
  listings: number;
  hasMap: boolean;
}

const areaSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');

/** Hand-placed areas (the old E-Map list), as a floor under what the API knows. */
const STATIC_AREAS: Record<string, SocietyPlace[]> = Object.fromEntries(
  CITIES.map((c) => [
    c.slug,
    c.areas.map((a) => ({ name: a.name, slug: areaSlug(a.name), citySlug: c.slug, lat: a.lat, lng: a.lng, listings: 0, hasMap: false })),
  ]),
);

const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!);

const cityIcon = (c: CityPlace) =>
  L.divIcon({
    className: '',
    html: `<div class="pd-city"><span class="pd-city__dot"></span><span class="pd-city__name">${esc(c.name)}</span>${
      c.listings ? `<span class="pd-city__n">${c.listings.toLocaleString('en-PK')}</span>` : ''
    }</div>`,
    iconSize: [0, 0],
  });

const societyIcon = (s: SocietyPlace, focused: boolean) =>
  L.divIcon({
    className: '',
    html: `<div class="pd-soc-label${s.hasMap ? ' pd-soc-label--map' : ''}${focused ? ' pd-soc-label--focus' : ''}">${esc(s.name)}${
      s.listings ? `<span class="pd-soc-label__n">${s.listings}</span>` : ''
    }</div>`,
    iconSize: [0, 0],
  });

/** Bigger cities win when two pills would overlap. */
const BIG = ['lahore', 'karachi', 'islamabad', 'rawalpindi', 'faisalabad', 'multan', 'peshawar', 'quetta', 'gujranwala', 'sialkot', 'hyderabad', 'bahawalpur'];
const rank = (slug: string) => (BIG.indexOf(slug) + 1 || 99);

/** Rough pixel box of a pill, for the overlap test. */
const boxOf = (p: L.Point, name: string, n: number) => {
  const w = name.length * 6.6 + (n ? 26 : 0) + 30;
  return { x1: p.x - w / 2, x2: p.x + w / 2, y1: p.y - 13, y2: p.y + 13 };
};

export default function PlaceLabels({
  cities,
  focusSlug,
  hideBelow16 = true,
}: {
  /** Fallback city list when the API has none (static centres). */
  cities: CityPlace[];
  /** The society whose page this is — drawn dark. */
  focusSlug?: string | null;
  hideBelow16?: boolean;
}) {
  const map = useMap();
  const router = useRouter();
  const [apiCities, setApiCities] = useState<CityPlace[] | null>(null);
  const [byCity, setByCity] = useState<Record<string, SocietyPlace[]>>({});
  const [shown, setShown] = useState<SocietyPlace[]>([]);
  const [zoom, setZoom] = useState(map.getZoom());
  const loading = useRef(new Set<string>());

  // Cities with real listings (and their counts), merged with the static list.
  useEffect(() => {
    api
      .get('/society-maps/places')
      .then((r) => setApiCities(Array.isArray(r.data?.data) ? r.data.data : []))
      .catch(() => setApiCities([]));
  }, []);

  const allCities = useMemo(() => {
    const out = new Map<string, CityPlace>();
    for (const c of cities) out.set(c.slug, c);
    for (const c of apiCities ?? []) {
      // The same city under another spelling ("Faislabad") is the one within ~20 km.
      const known = out.get(c.slug) ?? [...out.values()].find((k) => Math.hypot(k.lat - c.lat, k.lng - c.lng) < 0.2);
      if (known) out.set(known.slug, { ...known, listings: (known.listings ?? 0) + (c.listings ?? 0), maps: (known.maps ?? 0) + (c.maps ?? 0) });
      else out.set(c.slug, c);
    }
    return [...out.values()];
  }, [cities, apiCities]);

  /** Societies of the cities near the view, loaded once per city. */
  const ensure = useCallback(
    (slugs: string[]) => {
      for (const slug of slugs) {
        if (byCity[slug] || loading.current.has(slug)) continue;
        loading.current.add(slug);
        api
          .get('/society-maps/places', { params: { city: slug } })
          .then((r) => setByCity((m) => ({ ...m, [slug]: Array.isArray(r.data?.data) ? r.data.data : [] })))
          .catch(() => setByCity((m) => ({ ...m, [slug]: [] })))
          .finally(() => loading.current.delete(slug));
      }
    },
    [byCity],
  );

  const [shownCities, setShownCities] = useState<CityPlace[]>([]);

  const layout = useCallback(() => {
    const z = map.getZoom();
    setZoom(z);
    if (z < 10) {
      // Big cities first; a city whose pill would sit on another's is left out until you zoom in.
      const placed: { x1: number; x2: number; y1: number; y2: number }[] = [];
      const keep: CityPlace[] = [];
      const order = [...allCities].sort((a, b) => rank(a.slug) - rank(b.slug) || (b.listings ?? 0) - (a.listings ?? 0));
      for (const c of order) {
        const p = map.latLngToContainerPoint([c.lat, c.lng]);
        const box = boxOf(L.point(p.x, p.y - 14), c.name, c.listings ?? 0);
        if (placed.some((q) => box.x1 < q.x2 + 4 && box.x2 > q.x1 - 4 && box.y1 < q.y2 + 2 && box.y2 > q.y1 - 2)) continue;
        placed.push(box);
        keep.push(c);
      }
      setShownCities(keep);
      setShown([]);
      return;
    }
    const b = map.getBounds().pad(0.15);
    const c = map.getCenter();
    // Cities whose centre is within ~60 km of the view.
    const near = allCities
      .filter((x) => Math.hypot(x.lat - c.lat, x.lng - c.lng) < 0.6 || b.contains([x.lat, x.lng]))
      .map((x) => x.slug);
    ensure(near);

    const candidates = near
      .flatMap((slug) => {
        const live = byCity[slug] ?? [];
        const extra = (STATIC_AREAS[slug] ?? []).filter((a) => !live.some((l) => l.slug === a.slug));
        return [...live, ...extra];
      })
      .filter((p) => b.contains([p.lat, p.lng]))
      .sort((a, bb) => Number(bb.slug === focusSlug) - Number(a.slug === focusSlug) || Number(bb.hasMap) - Number(a.hasMap) || bb.listings - a.listings);

    const placed: { x1: number; x2: number; y1: number; y2: number }[] = [];
    const keep: SocietyPlace[] = [];
    for (const p of candidates) {
      if (hideBelow16 && z >= 16 && p.slug === focusSlug) continue;
      const box = boxOf(map.latLngToContainerPoint([p.lat, p.lng]), p.name, p.listings);
      if (placed.some((q) => box.x1 < q.x2 + 6 && box.x2 > q.x1 - 6 && box.y1 < q.y2 + 4 && box.y2 > q.y1 - 4)) continue;
      placed.push(box);
      keep.push(p);
      if (keep.length >= 120) break;
    }
    setShown(keep);
  }, [map, allCities, byCity, ensure, focusSlug, hideBelow16]);

  useMapEvents({ moveend: layout, zoomend: layout });
  useEffect(() => {
    layout();
  }, [layout]);

  if (zoom < 10) {
    return (
      <>
        {shownCities.map((c) => (
          <Marker
            key={`city:${c.slug}`}
            position={[c.lat, c.lng]}
            icon={cityIcon(c)}
            zIndexOffset={c.listings ?? 0}
            eventHandlers={{ click: () => router.push(`/emap/${c.slug}`) }}
          />
        ))}
      </>
    );
  }

  return (
    <>
      {shown.map((p) => (
        <Marker
          key={`soc:${p.citySlug}/${p.slug}`}
          position={[p.lat, p.lng]}
          icon={societyIcon(p, p.slug === focusSlug)}
          zIndexOffset={p.hasMap ? 50 : 0}
          eventHandlers={{
            click: () => {
              if (p.slug === focusSlug) map.flyTo([p.lat, p.lng], Math.max(map.getZoom() + 1, 16), { duration: 0.6 });
              else router.push(`/emap/${p.citySlug}/${p.slug}`);
            },
          }}
        />
      ))}
    </>
  );
}

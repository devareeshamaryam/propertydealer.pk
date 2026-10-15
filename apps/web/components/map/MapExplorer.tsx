'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { BedDouble, Bath, ChevronDown, Crosshair, Layers, List, Loader2, Map as MapIcon, Ruler, X } from 'lucide-react';
import api from '@/lib/api';
import { MAP_TILES, type MapStyle } from '@/lib/map-tiles';
import { amountShort, propertySizeLabel } from '@/lib/pk';
import { cn, toTitleCase } from '@/lib/utils';

/*
 * The property map.
 *
 * Every live listing, pinned where it is: a price pill per listing, merged
 * into a count bubble when they crowd together, refreshed as the map moves.
 * Listings the dealer never pinned sit at their area's centre (the API works
 * that out) and are drawn lighter, marked "approximate".
 *
 * Desktop: the map with a list of what is in view beside it. Phone: the map
 * full screen with the listings as a row of cards along the bottom; tapping a
 * pin brings its card up.
 */

export interface MapListing {
  id: string;
  slug: string;
  title: string;
  price: number;
  purpose: 'sale' | 'rent';
  type: string;
  lat: number;
  lng: number;
  approx: boolean;
  image: string;
  marla?: number;
  kanal?: number;
  areaSize?: number;
  beds?: number;
  baths?: number;
  featured: boolean;
  closed: boolean;
  location?: string;
}

export interface MapPlace {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  zoom: number;
}

type Purpose = 'all' | 'sale' | 'rent';

const TYPES = ['all', 'house', 'plot', 'apartment', 'flat', 'shop', 'commercial', 'office', 'land'];

/** "1.1 Cr", "85 L", "45 K" — fits on a pin. */
function pinPrice(n: number): string {
  if (n >= 10_000_000) return `${+(n / 10_000_000).toFixed(n >= 100_000_000 ? 0 : 1)} Cr`;
  if (n >= 100_000) return `${+(n / 100_000).toFixed(n >= 10_000_000 ? 0 : 1)} L`;
  if (n >= 1000) return `${Math.round(n / 1000)} K`;
  return String(n);
}

function priceIcon(item: MapListing, active: boolean) {
  const cls = [
    'pd-pin',
    active ? 'pd-pin--active' : '',
    item.approx ? 'pd-pin--approx' : '',
    item.purpose === 'rent' ? 'pd-pin--rent' : '',
  ].join(' ');
  return L.divIcon({
    className: '',
    html: `<div class="${cls}">${pinPrice(item.price)}</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function clusterIcon(count: number) {
  const size = count > 99 ? 52 : count > 9 ? 44 : 38;
  return L.divIcon({
    className: '',
    html: `<div class="pd-cluster" style="width:${size}px;height:${size}px;margin:-${size / 2}px 0 0 -${size / 2}px">${count}</div>`,
    iconSize: [0, 0],
  });
}

type Cluster = { key: string; lat: number; lng: number; items: MapListing[] };

/** Group pins that would overlap at this zoom into one bubble (pixel grid). */
function cluster(map: L.Map, items: MapListing[]): Cluster[] {
  const zoom = map.getZoom();
  if (zoom >= 16) return items.map((i) => ({ key: i.id, lat: i.lat, lng: i.lng, items: [i] }));
  const cell = 64;
  const cells = new Map<string, MapListing[]>();
  for (const item of items) {
    const p = map.project([item.lat, item.lng], zoom);
    const k = `${Math.floor(p.x / cell)}:${Math.floor(p.y / cell)}`;
    const list = cells.get(k);
    if (list) list.push(item);
    else cells.set(k, [item]);
  }
  return [...cells.entries()].map(([k, list]) => ({
    key: list.length === 1 ? list[0]!.id : `c${k}`,
    lat: list.reduce((s, i) => s + i.lat, 0) / list.length,
    lng: list.reduce((s, i) => s + i.lng, 0) / list.length,
    items: list,
  }));
}

function Viewport({ onChange }: { onChange: (map: L.Map) => void }) {
  const map = useMapEvents({
    moveend: () => onChange(map),
    zoomend: () => onChange(map),
  });
  useEffect(() => {
    onChange(map);
  }, [map, onChange]);
  return null;
}

function FlyTo({ target }: { target: { lat: number; lng: number; zoom: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], target.zoom, { duration: 0.8 });
  }, [map, target]);
  return null;
}

function ListingCard({ item, compact, onClose }: { item: MapListing; compact?: boolean; onClose?: () => void }) {
  const size = propertySizeLabel({ marla: item.marla, kanal: item.kanal, areaSize: item.areaSize });
  return (
    <div className="relative flex gap-3 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
      <Link href={`/properties/${item.slug}`} className="absolute inset-0 z-0 rounded-2xl" aria-label={item.title} />
      <div className={cn('relative shrink-0 overflow-hidden rounded-xl bg-slate-100', compact ? 'h-[88px] w-[96px]' : 'h-[96px] w-[112px]')}>
        {item.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image} alt="" loading="lazy" className="h-full w-full object-cover" />
        )}
        {item.featured && <span className="absolute left-1 top-1 rounded bg-amber-400 px-1 text-[9px] font-bold uppercase text-slate-900">Featured</span>}
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <p className="text-[16px] font-bold leading-none text-slate-900">
          <span className="text-[10px] font-semibold text-slate-500">PKR </span>
          {amountShort(item.price)}
          {item.purpose === 'rent' && <span className="text-[11px] font-normal text-slate-500"> /month</span>}
        </p>
        <p className="mt-1 line-clamp-2 text-[13px] font-medium leading-snug text-slate-900">{item.title}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2.5 text-[12px] text-slate-600">
          {!!item.beds && <span className="inline-flex items-center gap-0.5"><BedDouble className="h-3.5 w-3.5" />{item.beds}</span>}
          {!!item.baths && <span className="inline-flex items-center gap-0.5"><Bath className="h-3.5 w-3.5" />{item.baths}</span>}
          {size !== '—' && <span className="inline-flex items-center gap-0.5"><Ruler className="h-3.5 w-3.5" />{size}</span>}
          {item.approx && <span className="text-[11px] text-amber-700">Approx. location</span>}
        </p>
      </div>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Close" className="relative z-10 -mr-0.5 -mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-slate-100">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export default function MapExplorer({
  places,
  focus,
}: {
  places: MapPlace[];
  /** Where to open: a city or an area. Defaults to Pakistan. */
  focus?: { lat: number; lng: number; zoom: number } | null;
}) {
  const [style, setStyle] = useState<MapStyle>('street');
  const [purpose, setPurpose] = useState<Purpose>('all');
  const [type, setType] = useState('all');
  const [visible, setVisible] = useState<MapListing[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [selected, setSelected] = useState<MapListing | null>(null);
  const [target, setTarget] = useState<{ lat: number; lng: number; zoom: number } | null>(null);
  const [showList, setShowList] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  const reqId = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = focus ?? { lat: 30.3753, lng: 69.3451, zoom: 6 };

  const recluster = useCallback((map: L.Map, list: MapListing[]) => {
    const b = map.getBounds();
    const inView = list.filter((i) => b.contains([i.lat, i.lng]));
    setVisible(inView);
    setClusters(cluster(map, inView));
  }, []);

  const load = useCallback(
    (map: L.Map) => {
      mapRef.current = map;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        const b = map.getBounds().pad(0.2);
        const id = ++reqId.current;
        setLoading(true);
        try {
          const res = await api.get('/properties/map', {
            params: {
              minLat: b.getSouth().toFixed(4),
              maxLat: b.getNorth().toFixed(4),
              minLng: b.getWest().toFixed(4),
              maxLng: b.getEast().toFixed(4),
              ...(purpose !== 'all' ? { purpose } : {}),
              ...(type !== 'all' ? { type } : {}),
            },
          });
          if (id !== reqId.current) return;
          const list: MapListing[] = res.data?.listings ?? [];
          setTruncated(!!res.data?.truncated);
          recluster(map, list);
        } catch {
          // keep what is on screen
        } finally {
          if (id === reqId.current) setLoading(false);
        }
      }, 250);
    },
    [purpose, type, recluster],
  );

  // (A filter change gives `load` a new identity, and Viewport reloads with it.)

  const locate = () => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setTarget({ lat: pos.coords.latitude, lng: pos.coords.longitude, zoom: 14 }),
      () => {},
      { enableHighAccuracy: false, timeout: 8000 },
    );
  };

  const tiles = MAP_TILES[style];
  const sortedVisible = useMemo(
    () => [...visible].sort((a, b) => Number(b.featured) - Number(a.featured) || Number(a.approx) - Number(b.approx)),
    [visible],
  );

  return (
    <div className="relative isolate flex h-[calc(100dvh-64px)] w-full bg-slate-100">
      {/* Desktop list */}
      <aside className="hidden w-[380px] shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="border-b border-slate-200 px-4 py-3">
          <h1 className="text-[20px] font-bold tracking-tight text-slate-900">Property map</h1>
          <p className="text-[13px] text-slate-600">
            {loading ? 'Loading…' : `${visible.length.toLocaleString('en-PK')} ${visible.length === 1 ? 'listing' : 'listings'} in this area`}
            {truncated && ' · zoom in to see all'}
          </p>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {sortedVisible.length === 0 && !loading ? (
            <p className="px-2 py-10 text-center text-[14px] text-slate-500">No listings here. Zoom out or move the map.</p>
          ) : (
            sortedVisible.slice(0, 120).map((item) => (
              <div key={item.id} onMouseEnter={() => setSelected(item)} onMouseLeave={() => setSelected(null)}>
                <ListingCard item={item} />
              </div>
            ))
          )}
        </div>
      </aside>

      <div className="relative flex-1">
        <MapContainer center={[start.lat, start.lng]} zoom={start.zoom} minZoom={5} className="h-full w-full" zoomControl={false} preferCanvas>
          <TileLayer key={style} url={tiles.url} subdomains={tiles.subdomains} attribution={tiles.attribution} maxZoom={tiles.maxZoom} />
          <Viewport onChange={load} />
          <FlyTo target={target} />
          {clusters.map((c) =>
            c.items.length === 1 ? (
              <Marker
                key={c.key}
                position={[c.lat, c.lng]}
                icon={priceIcon(c.items[0]!, selected?.id === c.items[0]!.id)}
                zIndexOffset={selected?.id === c.items[0]!.id ? 1000 : c.items[0]!.featured ? 100 : 0}
                eventHandlers={{ click: () => setSelected(c.items[0]!) }}
              />
            ) : (
              <Marker
                key={c.key}
                position={[c.lat, c.lng]}
                icon={clusterIcon(c.items.length)}
                eventHandlers={{
                  click: () => {
                    const m = mapRef.current;
                    if (m) m.flyTo([c.lat, c.lng], Math.min(m.getZoom() + 2, 17), { duration: 0.6 });
                  },
                }}
              />
            ),
          )}
        </MapContainer>

        {/* Controls */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] p-2 sm:p-3">
          <div className="pointer-events-auto flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-full bg-white p-0.5 shadow-md ring-1 ring-slate-200">
              {(['all', 'sale', 'rent'] as Purpose[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPurpose(p)}
                  className={cn('h-9 rounded-full px-3.5 text-[13.5px] font-semibold', purpose === p ? 'bg-primary text-white' : 'text-slate-800')}
                >
                  {p === 'all' ? 'All' : p === 'sale' ? 'Buy' : 'Rent'}
                </button>
              ))}
            </div>
            <label className="relative">
              <span className="sr-only">Property type</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="h-10 appearance-none rounded-full bg-white pl-3.5 pr-8 text-[13.5px] font-semibold text-slate-900 shadow-md outline-none ring-1 ring-slate-200"
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>{t === 'all' ? 'All types' : toTitleCase(t)}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            </label>
            <label className="relative">
              <span className="sr-only">Jump to city</span>
              <select
                defaultValue=""
                onChange={(e) => {
                  const p = places.find((x) => x.slug === e.target.value);
                  if (p) setTarget({ lat: p.lat, lng: p.lng, zoom: p.zoom });
                }}
                className="h-10 appearance-none rounded-full bg-white pl-3.5 pr-8 text-[13.5px] font-semibold text-slate-900 shadow-md outline-none ring-1 ring-slate-200"
              >
                <option value="" disabled>City</option>
                {places.map((p) => (
                  <option key={p.slug} value={p.slug}>{p.name}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            </label>
            {loading && (
              <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3 text-[12.5px] font-medium text-slate-700 shadow-md ring-1 ring-slate-200">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading
              </span>
            )}
          </div>
        </div>

        <div className="absolute right-2 top-[60px] z-[500] flex flex-col gap-2 sm:right-3 sm:top-3">
          <button
            type="button"
            onClick={() => setStyle(style === 'street' ? 'hybrid' : 'street')}
            className="grid h-10 w-10 place-items-center rounded-full bg-white text-slate-900 shadow-md ring-1 ring-slate-200"
            aria-label={style === 'street' ? 'Satellite view' : 'Map view'}
          >
            {style === 'street' ? <Layers className="h-5 w-5" /> : <MapIcon className="h-5 w-5" />}
          </button>
          <button type="button" onClick={locate} className="grid h-10 w-10 place-items-center rounded-full bg-white text-slate-900 shadow-md ring-1 ring-slate-200" aria-label="My location">
            <Crosshair className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setShowList((v) => !v)}
            className="grid h-10 w-10 place-items-center rounded-full bg-white text-slate-900 shadow-md ring-1 ring-slate-200 lg:hidden"
            aria-label="List"
          >
            <List className="h-5 w-5" />
          </button>
        </div>

        {/* Phone: the selected listing, or a row of what is in view */}
        <div className="absolute inset-x-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-[500] lg:bottom-4 lg:left-auto lg:right-4 lg:w-[380px]">
          {selected ? (
            <div className="px-2">
              <ListingCard item={selected} onClose={() => setSelected(null)} />
            </div>
          ) : (
            sortedVisible.length > 0 && (
              <div className="hide-scrollbar flex snap-x gap-2 overflow-x-auto px-2 lg:hidden">
                {sortedVisible.slice(0, 30).map((item) => (
                  <div key={item.id} className="w-[86%] shrink-0 snap-center">
                    <ListingCard item={item} compact />
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* Phone: full list sheet */}
        {showList && (
          <div className="absolute inset-0 z-[600] flex flex-col bg-white lg:hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-3">
              <p className="text-[15px] font-bold text-slate-900">{visible.length.toLocaleString('en-PK')} listings in view</p>
              <button type="button" onClick={() => setShowList(false)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-slate-100" aria-label="Back to map">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-2 pb-28">
              {sortedVisible.slice(0, 150).map((item) => (
                <ListingCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

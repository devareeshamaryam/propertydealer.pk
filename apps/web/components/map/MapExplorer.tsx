'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Circle, MapContainer, Marker, Polygon, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { useRouter } from 'next/navigation';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  BadgeCheck,
  BedDouble,
  Bath,
  Check,
  ChevronDown,
  Copy,
  Hash,
  MapPin,
  Navigation,
  Crosshair,
  Download,
  Eye,
  EyeOff,
  Layers,
  List,
  Loader2,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  MessageCircle,
  Phone,
  Ruler,
  Search,
  Share2,
  Undo2,
  X,
} from 'lucide-react';
import api from '@/lib/api';
import { CLEAN_TILES, EMAP_TILES, type MapStyle } from '@/lib/map-tiles';
import { amountShort, propertySizeLabel } from '@/lib/pk';
import { cn, toTitleCase } from '@/lib/utils';
import {
  POI_ICONS,
  POI_LABELS,
  insidePolygon,
  marlaLabel,
  plotSizeLabel,
  polygonSqft,
  type MapPlaceRow,
  type SocietyBlock,
  type SocietyCard,
  type SocietyMapPage,
  type SocietyPlotHit,
} from '@/lib/society-map';
import SocietyLayers, { MeasureLayer } from './SocietyLayers';
import PlaceLabels from './PlaceLabels';
import PlotsLayer, { PLOT_COLORS } from './PlotsLayer';

/*
 * The property map.
 *
 * Every live listing, pinned where it is: a price pill per listing, merged
 * into a count bubble when they crowd together, refreshed as the map moves.
 * Listings the dealer never pinned sit at their area's centre (the API works
 * that out) and are drawn lighter, marked "approximate".
 *
 * Society master plans published from the dashboard are drawn over the base
 * map wherever they are in view; on a society's own page its blocks, landmarks
 * and sponsor are shown too, and the listings can be narrowed to one block.
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
  /** In this society / city but the dealer never pinned it: listed, not drawn. */
  unpinned?: boolean;
}

/** A listing from the plain list API, in the map's shape (no position). */
function fromApi(p: any): MapListing {
  return {
    id: String(p._id),
    slug: p.slug,
    title: p.title,
    price: Number(p.price) || 0,
    purpose: p.listingType === 'rent' ? 'rent' : 'sale',
    type: p.propertyType ?? '',
    lat: Number(p.latitude) || 0,
    lng: Number(p.longitude) || 0,
    approx: false,
    image: p.mainPhotoUrl || p.videoPosterUrl || '',
    marla: p.marla,
    kanal: p.kanal,
    areaSize: p.areaSize,
    beds: p.bedrooms,
    baths: p.bathrooms,
    featured: !!p.isFeatured,
    closed: p.availability === 'sold' || p.availability === 'rented',
    location: p.location,
    unpinned: !(Number(p.latitude) && Number(p.longitude)),
  };
}

export interface MapPlace {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  zoom: number;
}

type Purpose = 'all' | 'sale' | 'rent';
type View = { lat: number; lng: number; zoom: number };

/** Listings are fetched from this zoom in — below it the map shows cities and societies only. */
const LISTINGS_ZOOM = 12;

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

const meIcon = L.divIcon({ className: '', html: '<div class="pd-me"></div>', iconSize: [0, 0] });

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

/** Metres between two [lat, lng] points. */
function metres(a: [number, number], b: [number, number]): number {
  const r = Math.PI / 180;
  const dLat = (b[0] - a[0]) * r;
  const dLng = (b[1] - a[1]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

function distanceLabel(m: number): string {
  const ft = Math.round(m * 3.28084);
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m · ${ft.toLocaleString('en-PK')} ft`;
}

/** `#map=16/31.4700/74.4086` — the view, so a shared link opens where it was shared from. */
/** The page the map code was loaded on: only there may a shared #map= link set the opening view. */
const loadedPath = typeof window !== 'undefined' ? window.location.pathname : null;

function readHash(): View | null {
  if (typeof window === 'undefined') return null;
  const m = window.location.hash.match(/map=(\d{1,2}(?:\.\d+)?)\/(-?\d+\.\d+)\/(-?\d+\.\d+)/);
  if (!m) return null;
  const zoom = Number(m[1]);
  const lat = Number(m[2]);
  const lng = Number(m[3]);
  return lat > 20 && lat < 40 && lng > 58 && lng < 80 && zoom >= 5 && zoom <= 21 ? { lat, lng, zoom } : null;
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

function FlyTo({ target }: { target: View | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], target.zoom, { duration: 0.8 });
  }, [map, target]);
  return null;
}

function FitTo({ bounds }: { bounds: L.LatLngBoundsExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.flyToBounds(bounds, { padding: [30, 30], duration: 0.7, maxZoom: 18 });
  }, [map, bounds]);
  return null;
}

/** Tells Leaflet the box changed size (full screen on/off). */
function Resize({ dep }: { dep: unknown }) {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 60);
    return () => clearTimeout(t);
  }, [map, dep]);
  return null;
}

function ClickInfo({ enabled, onClick }: { enabled: boolean; onClick: (p: [number, number], zoom: number) => void }) {
  const map = useMapEvents({
    click: (e) => {
      if (enabled) onClick([e.latlng.lat, e.latlng.lng], map.getZoom());
    },
  });
  return null;
}

/** "31.4697, 74.4086", "31.4697 N 74.4086 E" or a Google Maps link (…/@31.4697,74.4086,17z, ?q=31.4,74.4). */
export function parseLocation(text: string): [number, number] | null {
  const t = text.trim();
  const m =
    t.match(/@(-?\d{1,2}\.\d+),\s*(-?\d{2,3}\.\d+)/) ??
    t.match(/[?&](?:q|query|ll|destination)=(-?\d{1,2}\.\d+),\s*(-?\d{2,3}\.\d+)/) ??
    t.match(/^(-?\d{1,2}\.\d{3,})\s*°?\s*[N]?[\s,]+(-?\d{2,3}\.\d{3,})\s*°?\s*[E]?$/i);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return lat > 20 && lat < 40 && lng > 58 && lng < 80 ? [lat, lng] : null;
}

const PLOT_USE: Record<string, string> = {
  residential: 'Residential plot',
  commercial: 'Commercial',
  park: 'Park / green area',
  mosque: 'Mosque',
  school: 'School',
  hospital: 'Health',
  utility: 'Utility',
  parking: 'Parking',
  graveyard: 'Graveyard',
  apartments: 'Apartments',
};

const streetView = (p: [number, number]) => `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${p[0]},${p[1]}`;
const directions = (p: [number, number]) => `https://www.google.com/maps/dir/?api=1&destination=${p[0]},${p[1]}`;

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
          {item.unpinned && <span className="text-[11px] text-slate-500">Not pinned on map</span>}
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

const ctrl = 'grid h-10 w-10 place-items-center rounded-full bg-white text-slate-900 shadow-md ring-1 ring-slate-200 transition-colors hover:bg-slate-50';

/** The rest of a society's or city's listings: in the list, though not on the map. */
function ScopeMore({ rows, title, busy, hasMore, onMore }: { rows: MapListing[]; title: string; busy: boolean; hasMore: boolean; onMore: () => void }) {
  if (!rows.length && !busy) return null;
  return (
    <>
      {title && rows.length > 0 && <p className="px-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{title}</p>}
      {rows.map((item) => (
        <ListingCard key={`s:${item.id}`} item={item} />
      ))}
      {busy ? (
        <p className="flex items-center justify-center gap-1.5 py-3 text-[13px] text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading listings…
        </p>
      ) : hasMore ? (
        <button type="button" onClick={onMore} className="w-full rounded-xl border border-slate-200 py-2.5 text-[13.5px] font-semibold text-slate-800 hover:border-slate-400">
          Show more listings
        </button>
      ) : null}
    </>
  );
}

/** A city's societies, searchable: the ones with a map open their page, the rest fly the map there. */
function SocietyList({
  items,
  loading,
  filter,
  onFilter,
  onOpen,
  cityName,
}: {
  items: MapPlaceRow[];
  loading: boolean;
  filter: string;
  onFilter: (v: string) => void;
  onOpen: (p: MapPlaceRow) => void;
  cityName: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="p-3 pb-2">
        <label className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 focus-within:border-primary">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            value={filter}
            onChange={(e) => onFilter(e.target.value)}
            placeholder={`Search societies in ${cityName}`}
            className="min-w-0 flex-1 bg-transparent text-[14px] text-slate-900 outline-none placeholder:text-slate-400"
          />
        </label>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {loading ? (
          <p className="px-2 py-6 text-center text-[13px] text-slate-500">Loading societies…</p>
        ) : items.length === 0 ? (
          <p className="px-2 py-6 text-center text-[13px] text-slate-500">No society by that name.</p>
        ) : (
          items.slice(0, 400).map((p) => (
            <button
              key={p.slug}
              type="button"
              onClick={() => onOpen(p)}
              className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-slate-50"
            >
              <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', p.hasMap ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500')}>
                {p.hasMap ? <MapIcon className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold text-slate-900">{p.name}</span>
                <span className="block text-[12px] text-slate-500">
                  {p.hasMap ? 'Society map' : 'On the map'}
                  {p.listings ? ` · ${p.listings} ${p.listings === 1 ? 'listing' : 'listings'}` : ''}
                </span>
              </span>
              <ChevronDown className="h-4 w-4 -rotate-90 text-slate-300" />
            </button>
          ))
        )}
      </div>
    </div>
  );
}

/** What a tap on a plot shows. */
function PlotCard({ plot, at, onClose }: { plot: SocietyPlotHit; at: [number, number]; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const title = [plot.sector && `Sector ${plot.sector}`, plot.no && `Plot ${plot.no}`].filter(Boolean).join(' · ') || 'Plot';
  const size = plotSizeLabel(plot.sqft);
  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}#plot=${encodeURIComponent(plot.house || [plot.sector, plot.no].filter(Boolean).join('-'))}`;
    try {
      if (navigator.share) await navigator.share({ title, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }
    } catch {
      // dismissed
    }
  };
  return (
    <div className="min-w-[220px] text-[13px]">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">{PLOT_USE[plot.kind] ?? 'Plot'}{plot.corner ? ' · Corner' : ''}</p>
      <p className="mt-0.5 text-[16px] font-bold leading-tight text-slate-900">{title}</p>
      <p className="mt-1 text-slate-600">
        {size && <span className="font-semibold text-slate-900">{size}</span>}
        {size && plot.sqft ? ` · ${Math.round(plot.sqft).toLocaleString('en-PK')} sq ft` : ''}
      </p>
      {plot.house && <p className="mt-0.5 font-mono text-[11.5px] text-slate-500">{plot.house}</p>}
      {plot.use && plot.kind !== 'residential' && <p className="mt-0.5 text-[12px] text-slate-500">{plot.use}</p>}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <a href={directions(at)} target="_blank" rel="noopener" className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[12px] font-semibold !text-white">
          <Navigation className="h-3 w-3" /> Directions
        </a>
        <button type="button" onClick={share} className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-[12px] font-semibold text-slate-700">
          {copied ? <Check className="h-3 w-3" /> : <Share2 className="h-3 w-3" />} {copied ? 'Copied' : 'Share'}
        </button>
        <a href={streetView(at)} target="_blank" rel="noopener" className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-[12px] font-semibold !text-slate-700">
          Street view
        </a>
        <button type="button" onClick={onClose} className="sr-only">Close</button>
      </div>
      <p className="mt-2 text-[10.5px] leading-snug text-slate-400">From the society&apos;s GIS. Confirm with the society office before buying.</p>
    </div>
  );
}

export default function MapExplorer({
  places,
  focus,
  society,
  city,
  mode = 'full',
}: {
  places: MapPlace[];
  /** Where to open: a city or an area. Defaults to Pakistan. */
  focus?: View | null;
  /** A society's page: its plan, blocks, landmarks and sponsor. */
  society?: SocietyMapPage | null;
  /** A city's page: the city is selected — its societies are listed beside the map. */
  city?: { slug: string; name: string } | null;
  /** `page`: shorter on phones, with the page's content below. */
  mode?: 'full' | 'page';
}) {
  const router = useRouter();
  // The simple map by default everywhere; Satellite and Hybrid are a tap away in Layers.
  const [style, setStyle] = useState<MapStyle>('street');
  const [showLayers, setShowLayers] = useState(false);
  const [poisOn, setPoisOn] = useState(true);
  // Landmark kinds switched off in the layers menu (all on to start).
  const [poiOff, setPoiOff] = useState<Set<string>>(() => new Set());
  // Plot outlines and numbers from the society's GIS, at street level.
  const [plotsOn, setPlotsOn] = useState(true);
  const [plotsShown, setPlotsShown] = useState(0);
  // Tapped plot (from the society's GIS) and plot finder.
  const [plot, setPlot] = useState<SocietyPlotHit | null>(null);
  const [plotBusy, setPlotBusy] = useState(false);
  const [plotHits, setPlotHits] = useState<SocietyPlotHit[] | null>(null);
  // City mode: the city's societies.
  const cityslug = city?.slug ?? society?.citySlug ?? '';
  const [cityPlaces, setCityPlaces] = useState<MapPlaceRow[] | null>(null);
  const [tab, setTab] = useState<'societies' | 'listings'>(city ? 'societies' : 'listings');
  const [societyFilter, setSocietyFilter] = useState('');
  // Every listing of this society (or city) — not only the pinned ones on the
  // map. The map labels count them all, so the list has to show them all.
  const [scopeRows, setScopeRows] = useState<MapListing[]>([]);
  const [scopeTotal, setScopeTotal] = useState(0);
  const [scopePage, setScopePage] = useState(1);
  const [scopeBusy, setScopeBusy] = useState(false);
  const [purpose, setPurpose] = useState<Purpose>('all');
  const [type, setType] = useState('all');
  const [all, setAll] = useState<MapListing[]>([]);
  const [visible, setVisible] = useState<MapListing[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [selected, setSelected] = useState<MapListing | null>(null);
  const [target, setTarget] = useState<View | null>(null);
  const [fit, setFit] = useState<L.LatLngBoundsExpression | null>(null);
  const [showList, setShowList] = useState(false);
  const [zoomedOut, setZoomedOut] = useState(false);

  // Society overlay
  const [planCount, setPlanCount] = useState(0);
  const [planOn, setPlanOn] = useState(true);
  const [planOpacity, setPlanOpacity] = useState(1);
  const [showOpacity, setShowOpacity] = useState(false);
  const [block, setBlock] = useState<SocietyBlock | null>(null);

  // Tools
  const [measure, setMeasure] = useState<null | 'distance' | 'area'>(null);
  const [points, setPoints] = useState<[number, number][]>([]);
  const [clickAt, setClickAt] = useState<[number, number] | null>(null);
  const [me, setMe] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const watchId = useRef<number | null>(null);
  const [full, setFull] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [societies, setSocieties] = useState<SocietyCard[] | null>(null);
  const [copied, setCopied] = useState(false);

  const mapRef = useRef<L.Map | null>(null);
  const reqId = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The opening view comes from the page (city, society). A shared #map= link is
  // applied after mount — during a client navigation this renders before the
  // address changes, so reading it here picked up the previous page's view.
  const [start] = useState<View>(() => {
    if (society?.center) return { lat: society.center.lat, lng: society.center.lng, zoom: society.zoom || 15 };
    return focus ?? { lat: 30.3753, lng: 69.3451, zoom: 6 };
  });

  /** Listings in view, narrowed to the chosen block. */
  const recluster = useCallback(
    (map: L.Map, list: MapListing[]) => {
      const b = map.getBounds();
      let inView = list.filter((i) => b.contains([i.lat, i.lng]));
      if (block?.polygon.length) inView = inView.filter((i) => insidePolygon(i.lat, i.lng, block.polygon));
      setVisible(inView);
      setClusters(cluster(map, inView));
    },
    [block],
  );

  const load = useCallback(
    (map: L.Map) => {
      mapRef.current = map;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        // The address bar keeps the page's own clean URL; Share adds the view.
        // Country and city views: names only, no price pins.
        if (map.getZoom() < LISTINGS_ZOOM) {
          ++reqId.current;
          setZoomedOut(true);
          setAll([]);
          setVisible([]);
          setClusters([]);
          setLoading(false);
          return;
        }
        setZoomedOut(false);
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
          setAll(list);
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

  // A block chosen or cleared: re-filter what is loaded.
  useEffect(() => {
    if (mapRef.current) recluster(mapRef.current, all);
  }, [block, recluster]); // eslint-disable-line react-hooks/exhaustive-deps

  // Search needs the list of society maps; fetch it the first time search opens.
  useEffect(() => {
    if (!searchOpen || societies) return;
    api
      .get('/society-maps')
      .then((r) => setSocieties(Array.isArray(r.data?.data) ? r.data.data : []))
      .catch(() => setSocieties([]));
  }, [searchOpen, societies]);

  // The city's societies: the list beside the map on a city page, and search everywhere in the city.
  useEffect(() => {
    if (!cityslug || (!city && !searchOpen) || cityPlaces) return;
    api
      .get('/society-maps/places', { params: { city: cityslug } })
      .then((r) => setCityPlaces(Array.isArray(r.data?.data) ? r.data.data : []))
      .catch(() => setCityPlaces([]));
  }, [cityslug, city, searchOpen, cityPlaces]);

  const scopeParams = society?.areaId ? { areaId: society.areaId } : city ? { city: city.slug } : null;
  const scopeKey = JSON.stringify([scopeParams, purpose, type]);
  useEffect(() => {
    setScopeRows([]);
    setScopeTotal(0);
    setScopePage(1);
  }, [scopeKey]);
  useEffect(() => {
    if (!scopeParams) return;
    let cancelled = false;
    setScopeBusy(true);
    api
      .get('/properties', {
        params: {
          ...scopeParams,
          ...(purpose === 'sale' ? { purpose: 'buy' } : purpose === 'rent' ? { purpose: 'rent' } : {}),
          ...(type !== 'all' ? { type } : {}),
          page: scopePage,
          limit: 24,
        },
      })
      .then((r) => {
        if (cancelled) return;
        const rows: any[] = Array.isArray(r.data) ? r.data : r.data?.properties ?? [];
        setScopeTotal(Number(r.data?.total) || rows.length);
        setScopeRows((prev) => (scopePage === 1 ? rows.map(fromApi) : [...prev, ...rows.map(fromApi)]));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setScopeBusy(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey, scopePage]);

  // Plot finder: "L 215", "215 L", "6/L/215" — in this society's GIS.
  const plotSearchable = !!society?.plotCount;
  useEffect(() => {
    const text = query.trim();
    if (!plotSearchable || !searchOpen || !/\d/.test(text) || parseLocation(text)) {
      setPlotHits(null);
      return;
    }
    const t = setTimeout(() => {
      api
        .get('/society-maps/plots/find', { params: { city: society!.citySlug, map: society!.slug, q: text } })
        .then((r) => setPlotHits(Array.isArray(r.data?.data) ? r.data.data : []))
        .catch(() => setPlotHits([]));
    }, 300);
    return () => clearTimeout(t);
  }, [query, plotSearchable, searchOpen, society]);

  const showPlot = useCallback((p: SocietyPlotHit) => {
    setPlot(p);
    setClickAt([p.lat, p.lng]);
    setTarget({ lat: p.lat, lng: p.lng, zoom: 19 });
    try {
      window.history.replaceState(null, '', `#plot=${encodeURIComponent(p.house || [p.sector, p.no].filter(Boolean).join('-'))}`);
    } catch {
      // ignore
    }
  }, []);

  // A shared plot link: #plot=6/L/215 or #plot=L-215.
  useEffect(() => {
    if (!plotSearchable) return;
    const m = window.location.hash.match(/plot=([^&]+)/);
    if (!m) return;
    const q = decodeURIComponent(m[1]!).replace(/-/g, ' ');
    api
      .get('/society-maps/plots/find', { params: { city: society!.citySlug, map: society!.slug, q } })
      .then((r) => {
        const hit = r.data?.data?.[0];
        if (hit) setTimeout(() => showPlot(hit), 600);
      })
      .catch(() => undefined);
  }, [plotSearchable, society, showPlot]);

  /** A tap: the plot under it when the society's GIS has plots, else the point itself. */
  const onMapClick = useCallback(
    (p: [number, number], zoom: number) => {
      setClickAt(p);
      setPlot(null);
      if (zoom < 16) return;
      setPlotBusy(true);
      api
        .get('/society-maps/plots/at', { params: { lat: p[0].toFixed(7), lng: p[1].toFixed(7) } })
        .then((r) => {
          if (r.data?.data) setPlot(r.data.data);
        })
        .catch(() => undefined)
        .finally(() => setPlotBusy(false));
    },
    [],
  );

  useEffect(() => {
    if (window.location.pathname !== loadedPath) return;
    const fromHash = readHash();
    if (fromHash) setTarget(fromHash);
  }, []);

  useEffect(() => () => {
    if (watchId.current !== null) navigator.geolocation?.clearWatch(watchId.current);
    // A view saved after leaving would write the old place into the next page's address.
    if (timer.current) clearTimeout(timer.current);
  }, []);

  /** Live location: a blue dot that follows you — for finding a plot on site. */
  const toggleLocate = () => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
      setMe(null);
      return;
    }
    if (!navigator.geolocation) return;
    let first = true;
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy };
        setMe(p);
        if (first) {
          first = false;
          setTarget({ lat: p.lat, lng: p.lng, zoom: Math.max(mapRef.current?.getZoom() ?? 15, 16) });
        }
      },
      () => {
        if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
    );
  };

  const share = async () => {
    // The page's URL plus where the map is looking (#map=zoom/lat/lng), so the link opens on this view.
    const m = mapRef.current;
    const c = m?.getCenter();
    const url = `${window.location.origin}${window.location.pathname}${
      window.location.hash.includes('plot=') ? window.location.hash : m && c ? `#map=${m.getZoom()}/${c.lat.toFixed(5)}/${c.lng.toFixed(5)}` : ''
    }`;
    const title = society ? `${society.name} map` : 'Property map';
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // dismissed
    }
  };

  const chooseBlock = useCallback((b: SocietyBlock | null) => {
    setBlock((cur) => (b && cur?.id === b.id ? null : b));
    if (b?.polygon.length) setFit(L.latLngBounds(b.polygon));
  }, []);

  // The plain map hides every label except ours; on a society page its streets are worth reading.
  const tiles = style === 'street' && !society ? CLEAN_TILES : EMAP_TILES[style];
  const sortedVisible = useMemo(
    () => [...visible].sort((a, b) => Number(b.featured) - Number(a.featured) || Number(a.approx) - Number(b.approx)),
    [visible],
  );
  /** The scope's listings not already on the map in view. */
  const moreRows = useMemo(() => {
    const shown = new Set(visible.map((v) => v.id));
    return scopeRows.filter((r) => !shown.has(r.id) && (!block || r.unpinned));
  }, [scopeRows, visible, block]);
  const listCount = scopeParams ? Math.max(scopeTotal, visible.length) : visible.length;

  const measured = useMemo(() => {
    if (measure === 'area') {
      if (points.length < 3) return 'Tap 3 or more corners';
      const sqft = polygonSqft(points);
      return `${marlaLabel(sqft)} · ${Math.round(sqft).toLocaleString('en-PK')} sq ft`;
    }
    if (points.length < 2) return 'Tap two or more points';
    let m = 0;
    for (let i = 1; i < points.length; i++) m += metres(points[i - 1]!, points[i]!);
    return distanceLabel(m);
  }, [measure, points]);

  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    const cityHits = places.filter((p) => !q || p.name.toLowerCase().includes(q)).slice(0, q ? 8 : 6);
    const socHits = (societies ?? []).filter((s) => !q || s.name.toLowerCase().includes(q) || (s.cityName ?? '').toLowerCase().includes(q)).slice(0, 30);
    const blockHits = society ? society.blocks.filter((b) => !q || b.name.toLowerCase().includes(q)) : [];
    // Every society of this city — with a map page or not — so any of them can be found and flown to.
    const withPage = new Set(socHits.map((s) => `${s.citySlug}/${s.slug}`));
    const areaHits = q
      ? (cityPlaces ?? []).filter((p) => p.name.toLowerCase().includes(q) && !withPage.has(`${p.citySlug}/${p.slug}`)).slice(0, 12)
      : [];
    return { cityHits, socHits, blockHits, areaHits, point: parseLocation(query) };
  }, [q, query, places, societies, society, cityPlaces]);

  /** The city's societies beside the map: maps first, then by listings. */
  const cityList = useMemo(() => {
    const f = societyFilter.trim().toLowerCase();
    return (cityPlaces ?? []).filter((p) => !f || p.name.toLowerCase().includes(f));
  }, [cityPlaces, societyFilter]);

  const openPlace = useCallback(
    (p: MapPlaceRow) => {
      if (p.hasMap && p.citySlug) router.push(`/emap/${p.citySlug}/${p.slug}`);
      else setTarget({ lat: p.lat, lng: p.lng, zoom: 16 });
    },
    [router],
  );

  const Title = mode === 'page' ? 'p' : 'h1';
  const sponsor = society?.sponsor;
  const download = society?.layers.find((l) => l.downloadUrl)?.downloadUrl;
  const wa = sponsor?.whatsapp?.replace(/\D/g, '').replace(/^0/, '92');

  return (
    <div
      className={cn(
        'relative isolate flex w-full bg-slate-100',
        full
          ? 'fixed inset-0 z-[70] h-[100dvh]'
          : mode === 'page'
            ? 'h-[72dvh] min-h-[480px] lg:h-[calc(100dvh-64px)]'
            : 'h-[calc(100dvh-64px)]',
      )}
    >
      {/* Desktop list */}
      <aside className="hidden w-[380px] shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="border-b border-slate-200 px-4 py-3">
          {society ? (
            <>
              <p className="text-[12px] font-semibold uppercase tracking-wider text-primary">{society.cityName} · Society map</p>
              {/* The page has its own H1 below the map. */}
              <p className="text-[20px] font-bold leading-tight tracking-tight text-slate-900">{society.name} Map</p>
            </>
          ) : city ? (
            <>
              <p className="text-[12px] font-semibold uppercase tracking-wider text-primary">E-Map · City</p>
              <div className="flex items-center gap-2">
                <Title className="text-[20px] font-bold leading-tight tracking-tight text-slate-900">{city.name} Map</Title>
                <label className="relative ml-auto">
                  <span className="sr-only">Change city</span>
                  <select
                    value={city.slug}
                    onChange={(e) => router.push(`/emap/${e.target.value}`)}
                    className="h-8 appearance-none rounded-full border border-slate-200 bg-white pl-3 pr-7 text-[12.5px] font-semibold text-slate-700 outline-none hover:border-primary"
                  >
                    {[...places].sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
                      <option key={p.slug} value={p.slug}>{p.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                </label>
              </div>
            </>
          ) : (
            <Title className="text-[20px] font-bold tracking-tight text-slate-900">Property map</Title>
          )}
          <p className="mt-0.5 text-[13px] text-slate-600">
            {society
              ? `${listCount.toLocaleString('en-PK')} ${listCount === 1 ? 'listing' : 'listings'} in ${block ? block.name : society.name}${visible.length ? ` · ${visible.length} on the map` : ''}`
              : zoomedOut
                ? city ? `Tap a society — on the map or in the list — to open its map.` : 'Choose a city, then a society, to see its listings.'
                : loading
                  ? 'Loading…'
                  : `${visible.length.toLocaleString('en-PK')} ${visible.length === 1 ? 'listing' : 'listings'} ${block ? `in ${block.name}` : 'in this area'}`}
            {truncated && ' · zoom in to see all'}
          </p>
          {society && society.blocks.length > 0 && (
            <div className="hide-scrollbar -mx-1 mt-2.5 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
              {society.blocks.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => chooseBlock(b)}
                  className={cn(
                    'shrink-0 rounded-full border px-2.5 py-1 text-[12.5px] font-semibold transition-colors',
                    block?.id === b.id ? 'border-primary bg-primary text-white' : 'border-slate-200 text-slate-700 hover:border-primary hover:text-primary',
                  )}
                >
                  {b.name}
                </button>
              ))}
            </div>
          )}
          {society && download && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {download && (
                <a href={download} download className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-slate-800">
                  <Download className="h-3.5 w-3.5" /> Download map
                </a>
              )}
            </div>
          )}
        </div>
        {sponsor && (
          <div className="flex items-center gap-2.5 border-b border-slate-200 bg-amber-50/60 px-4 py-2.5">
            {sponsor.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={sponsor.logoUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg object-contain" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-slate-900">{sponsor.name}</p>
              {sponsor.tagline && <p className="truncate text-[11.5px] text-slate-600">{sponsor.tagline}</p>}
            </div>
            {wa && (
              <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener nofollow" className="grid h-8 w-8 place-items-center rounded-full bg-[#25D366] text-white" aria-label="WhatsApp">
                <MessageCircle className="h-4 w-4" />
              </a>
            )}
            {sponsor.phone && (
              <a href={`tel:${sponsor.phone}`} className="grid h-8 w-8 place-items-center rounded-full bg-primary text-white" aria-label="Call">
                <Phone className="h-4 w-4" />
              </a>
            )}
          </div>
        )}
        {city && (
          <div className="flex border-b border-slate-200 px-3 pt-2">
            {(['societies', 'listings'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn('-mb-px border-b-2 px-3 pb-2 text-[13.5px] font-semibold', tab === t ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800')}
              >
                {t === 'societies' ? `Societies${cityPlaces ? ` (${cityPlaces.length})` : ''}` : `Listings (${listCount.toLocaleString('en-PK')})`}
              </button>
            ))}
          </div>
        )}
        {city && tab === 'societies' ? (
          <SocietyList
            items={cityList}
            loading={cityPlaces === null}
            filter={societyFilter}
            onFilter={setSocietyFilter}
            onOpen={openPlace}
            cityName={city.name}
          />
        ) : (
        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {sortedVisible.length === 0 && !loading && zoomedOut && !society && !city ? (
            <>
              <p className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Choose a city</p>
              {[...places].sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
                <Link
                  key={p.slug}
                  href={`/emap/${p.slug}`}
                  className="flex items-center gap-2.5 rounded-xl px-2 py-2 text-[14px] font-semibold text-slate-900 hover:bg-slate-50 hover:text-primary"
                >
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                    <MapIcon className="h-4 w-4" />
                  </span>
                  {p.name} Map
                  <ChevronDown className="ml-auto h-4 w-4 -rotate-90 text-slate-300" />
                </Link>
              ))}
            </>
          ) : sortedVisible.length === 0 && moreRows.length === 0 && !loading && !scopeBusy ? (
            <p className="px-2 py-10 text-center text-[14px] text-slate-500">
              {zoomedOut && !scopeParams ? 'Tap a city on the map, then a society, to see the properties listed there.' : 'No listings here yet. Move the map or try another society.'}
            </p>
          ) : (
            <>
              {sortedVisible.slice(0, 120).map((item) => (
                <div key={item.id} onMouseEnter={() => setSelected(item)} onMouseLeave={() => setSelected(null)}>
                  <ListingCard item={item} />
                </div>
              ))}
              <ScopeMore
                rows={moreRows}
                title={sortedVisible.length ? `More in ${society?.name ?? city?.name ?? 'this area'}` : ''}
                busy={scopeBusy}
                hasMore={scopeRows.length < scopeTotal}
                onMore={() => setScopePage((n) => n + 1)}
              />
            </>
          )}
        </div>
        )}
      </aside>

      <div className="relative flex-1">
        <MapContainer center={[start.lat, start.lng]} zoom={start.zoom} minZoom={5} maxZoom={21} className="h-full w-full" zoomControl={false} preferCanvas>
          <TileLayer key={style} url={tiles.url} subdomains={tiles.subdomains} attribution={tiles.attribution} maxNativeZoom={tiles.maxZoom} maxZoom={21} />
          <PlaceLabels cities={places} focusSlug={society?.slug ?? null} />
          <SocietyLayers focus={society} opacity={planOpacity} visible={planOn} onCount={setPlanCount} onBlock={chooseBlock} activeBlock={block?.id ?? null} poisOn={poisOn} poiOff={poiOff} />
          {/* Under a scanned master plan the plan already shows the plots and their numbers: drawn only without one. */}
          <PlotsLayer enabled={plotsOn && !(planOn && planCount > 0)} onCount={setPlotsShown} />
          <Viewport onChange={load} />
          <FlyTo target={target} />
          <FitTo bounds={fit} />
          <Resize dep={full} />
          <ClickInfo enabled={!measure} onClick={onMapClick} />
          {plot && plot.ring.length > 2 && (
            <Polygon positions={plot.ring} pathOptions={{ color: '#f59e0b', weight: 3, fillColor: '#fbbf24', fillOpacity: 0.35 }} interactive={false} />
          )}
          {measure && <MeasureLayer points={points} mode={measure} onAdd={(p) => setPoints((list) => [...list, p])} />}
          {me && (
            <>
              <Circle center={[me.lat, me.lng]} radius={me.acc} pathOptions={{ color: '#2563eb', weight: 1, fillOpacity: 0.08 }} interactive={false} />
              <Marker position={[me.lat, me.lng]} icon={meIcon} interactive={false} zIndexOffset={2000} />
            </>
          )}
          {clickAt && !measure && (
            <Popup
              key={plot ? `plot:${plot.id}` : `pt:${clickAt.join(',')}`}
              position={plot ? [plot.lat, plot.lng] : clickAt}
              eventHandlers={{
                remove: () => {
                  setClickAt(null);
                  setPlot(null);
                  if (window.location.hash.includes('plot=')) {
                    try {
                      window.history.replaceState(null, '', window.location.pathname + window.location.search);
                    } catch {
                      // ignore
                    }
                  }
                },
              }}
            >
              {plot ? (
                <PlotCard plot={plot} at={[plot.lat, plot.lng]} onClose={() => setClickAt(null)} />
              ) : (
                <div className="min-w-[200px] text-[13px]">
                  {plotBusy && <p className="mb-1 flex items-center gap-1 text-[12px] text-slate-500"><Loader2 className="h-3 w-3 animate-spin" /> Looking for the plot…</p>}
                  <p className="font-mono text-[12px] text-slate-600">
                    {clickAt[0].toFixed(6)}, {clickAt[1].toFixed(6)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <a href={directions(clickAt)} target="_blank" rel="noopener" className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[12px] font-semibold !text-white">
                      <Navigation className="h-3 w-3" /> Directions
                    </a>
                    <a href={streetView(clickAt)} target="_blank" rel="noopener" className="rounded-full border border-slate-200 px-3 py-1 text-[12px] font-semibold !text-slate-700">
                      Street view
                    </a>
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard?.writeText(`${clickAt[0].toFixed(6)}, ${clickAt[1].toFixed(6)}`)}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-[12px] font-semibold text-slate-700"
                    >
                      <Copy className="h-3 w-3" /> Copy
                    </button>
                  </div>
                </div>
              )}
            </Popup>
          )}
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

        {/* Filters */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] p-2 sm:p-3">
          <div className="pointer-events-auto flex flex-wrap items-center gap-2 pr-12 sm:pr-14">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-white pl-3 pr-4 text-[13.5px] font-semibold text-slate-700 shadow-md ring-1 ring-slate-200"
            >
              <Search className="h-4 w-4" /> {society ? 'Search' : 'Society or city'}
            </button>
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
            {block && (
              <button
                type="button"
                onClick={() => setBlock(null)}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary pl-3 pr-2 text-[12.5px] font-semibold text-white shadow-md"
              >
                {block.name} <X className="h-3.5 w-3.5" />
              </button>
            )}
            {loading && (
              <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3 text-[12.5px] font-medium text-slate-700 shadow-md ring-1 ring-slate-200">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading
              </span>
            )}
          </div>
        </div>

        {/* Tools */}
        <div className="absolute right-2 top-2 z-[500] flex flex-col gap-2 sm:right-3 sm:top-3">
          <div className="relative">
            <button type="button" onClick={() => setShowLayers((v) => !v)} className={cn(ctrl, showLayers && 'text-primary')} aria-label="Map type and layers" title="Map type">
              <Layers className="h-5 w-5" />
            </button>
            {showLayers && (
              <div className="absolute right-12 top-0 w-[210px] rounded-2xl bg-white p-2 shadow-lg ring-1 ring-slate-200">
                <p className="px-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Map type</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['street', 'satellite', 'hybrid'] as MapStyle[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStyle(st)}
                      className={cn('rounded-xl border px-1 py-2 text-[12px] font-semibold', style === st ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 text-slate-700 hover:border-slate-400')}
                    >
                      {st === 'street' ? 'Map' : st === 'satellite' ? 'Satellite' : 'Hybrid'}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => setPlotsOn((v) => !v)} className="mt-2 flex w-full items-center justify-between rounded-xl px-1.5 py-1.5 text-[13px] font-medium text-slate-800 hover:bg-slate-50">
                  Plot outlines &amp; numbers
                  <span className={cn('grid h-5 w-5 place-items-center rounded-md border', plotsOn ? 'border-primary bg-primary text-white' : 'border-slate-300')}>
                    {plotsOn && <Check className="h-3.5 w-3.5" />}
                  </span>
                </button>
                {society && society.pois.length > 0 && (
                  <>
                    <button type="button" onClick={() => setPoisOn((v) => !v)} className="flex w-full items-center justify-between rounded-xl px-1.5 py-1.5 text-[13px] font-medium text-slate-800 hover:bg-slate-50">
                      Landmarks ({society.pois.length})
                      <span className={cn('grid h-5 w-5 place-items-center rounded-md border', poisOn ? 'border-primary bg-primary text-white' : 'border-slate-300')}>
                        {poisOn && <Check className="h-3.5 w-3.5" />}
                      </span>
                    </button>
                    {poisOn && (
                      <div className="flex flex-wrap gap-1 px-1 pb-1">
                        {[...new Set(society.pois.map((p) => p.kind))].map((k) => (
                          <button
                            key={k}
                            type="button"
                            onClick={() => setPoiOff((cur) => { const n = new Set(cur); if (n.has(k)) n.delete(k); else n.add(k); return n; })}
                            className={cn('rounded-full border px-2 py-0.5 text-[11.5px] font-medium', poiOff.has(k) ? 'border-slate-200 text-slate-400' : 'border-primary/40 bg-primary/5 text-slate-800')}
                          >
                            {POI_ICONS[k] ?? '📍'} {POI_LABELS[k] ?? k}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
                <p className="mt-1.5 px-1.5 text-[11px] leading-snug text-slate-500">Hybrid shows street names on the satellite view.</p>
              </div>
            )}
          </div>
          {planCount > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => (planOn ? setShowOpacity((v) => !v) : setPlanOn(true))}
                className={cn(ctrl, planOn && 'text-primary')}
                aria-label="Society plan"
                title="Society plan"
              >
                {planOn ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
              </button>
              {showOpacity && planOn && (
                <div className="absolute right-12 top-0 w-[200px] rounded-2xl bg-white p-3 shadow-lg ring-1 ring-slate-200">
                  <div className="flex items-center justify-between">
                    <p className="text-[12.5px] font-semibold text-slate-900">Society plan</p>
                    <button type="button" onClick={() => { setPlanOn(false); setShowOpacity(false); }} className="text-[12px] font-semibold text-primary">
                      Hide
                    </button>
                  </div>
                  <input
                    type="range"
                    min={0.15}
                    max={1}
                    step={0.05}
                    value={planOpacity}
                    onChange={(e) => setPlanOpacity(Number(e.target.value))}
                    className="mt-2 w-full accent-[var(--primary)]"
                    aria-label="Plan transparency"
                  />
                  <p className="text-[11px] text-slate-500">Slide left to see the ground under the plan.</p>
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setMeasure((m) => (m ? null : 'distance'));
              setPoints([]);
              setClickAt(null);
            }}
            className={cn(ctrl, measure && 'bg-orange-500 text-white ring-orange-500 hover:bg-orange-500')}
            aria-label="Measure"
            title="Measure distance or area"
          >
            <Ruler className="h-5 w-5" />
          </button>
          <button type="button" onClick={toggleLocate} className={cn(ctrl, me && 'text-blue-600')} aria-label="My location" title="My location">
            <Crosshair className="h-5 w-5" />
          </button>
          <button type="button" onClick={share} className={ctrl} aria-label="Share this view" title={copied ? 'Link copied' : 'Share'}>
            <Share2 className="h-5 w-5" />
          </button>
          {mode === 'page' && (
            <button type="button" onClick={() => setFull((v) => !v)} className={ctrl} aria-label={full ? 'Exit full screen' : 'Full screen'}>
              {full ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </button>
          )}
          <button type="button" onClick={() => setShowList((v) => !v)} className={cn(ctrl, 'lg:hidden')} aria-label="List">
            <List className="h-5 w-5" />
          </button>
        </div>

        {plotsOn && plotsShown > 0 && !(planOn && planCount > 0) && (
          <div className="pointer-events-none absolute bottom-3 left-2 z-[450] hidden flex-wrap gap-x-2.5 gap-y-1 rounded-xl bg-white/95 px-2.5 py-1.5 text-[11px] text-slate-700 shadow-md ring-1 ring-slate-200 sm:flex">
            {['residential', 'commercial', 'park', 'mosque', 'school', 'utility'].map((k) => (
              <span key={k} className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: PLOT_COLORS[k]!.fill, outline: `1px solid ${PLOT_COLORS[k]!.stroke}` }} />
                {PLOT_COLORS[k]!.label}
              </span>
            ))}
            <span className="text-slate-500">· tap a plot for details</span>
          </div>
        )}

        {copied && (
          <div className="absolute left-1/2 top-16 z-[600] -translate-x-1/2 rounded-full bg-slate-900 px-3 py-1.5 text-[12.5px] font-semibold text-white">Link copied</div>
        )}

        {/* Measuring */}
        {measure && (
          <div className="absolute inset-x-2 top-16 z-[550] mx-auto max-w-md rounded-2xl bg-white p-2.5 shadow-lg ring-1 ring-slate-200 sm:top-[4.5rem]">
            <div className="flex items-center gap-2">
              <div className="flex rounded-full bg-slate-100 p-0.5">
                {(['distance', 'area'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setMeasure(m); setPoints([]); }}
                    className={cn('h-8 rounded-full px-3 text-[12.5px] font-semibold', measure === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600')}
                  >
                    {m === 'distance' ? 'Distance' : 'Area'}
                  </button>
                ))}
              </div>
              <p className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-slate-900">{measured}</p>
              <button type="button" onClick={() => setPoints((p) => p.slice(0, -1))} className="grid h-8 w-8 place-items-center rounded-full hover:bg-slate-100" aria-label="Undo">
                <Undo2 className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => { setMeasure(null); setPoints([]); }} className="grid h-8 w-8 place-items-center rounded-full hover:bg-slate-100" aria-label="Stop measuring">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Phone: sponsor, then the selected listing or a row of what is in view */}
        <div
          className={cn(
            'absolute inset-x-0 z-[500] space-y-2 lg:bottom-4 lg:left-auto lg:right-4 lg:w-[380px]',
            full ? 'bottom-[calc(1rem+env(safe-area-inset-bottom))]' : mode === 'page' ? 'bottom-3' : 'bottom-[calc(5.75rem+env(safe-area-inset-bottom))]',
          )}
        >
          {sponsor && !selected && (
            <div className="mx-2 flex items-center gap-2 rounded-2xl bg-white/95 p-1.5 pl-2 shadow-md ring-1 ring-slate-200 lg:hidden">
              {sponsor.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={sponsor.logoUrl} alt="" className="h-8 w-8 shrink-0 rounded-lg object-contain" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-bold text-slate-900">{sponsor.name}</p>
                {sponsor.tagline && <p className="truncate text-[11px] text-slate-600">{sponsor.tagline}</p>}
              </div>
              {wa && (
                <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener nofollow" className="inline-flex h-8 items-center gap-1 rounded-full bg-[#25D366] px-3 text-[12px] font-semibold text-white">
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                </a>
              )}
              {sponsor.phone && (
                <a href={`tel:${sponsor.phone}`} className="grid h-8 w-8 place-items-center rounded-full bg-primary text-white" aria-label="Call">
                  <Phone className="h-4 w-4" />
                </a>
              )}
            </div>
          )}
          {selected ? (
            <div className="px-2 lg:px-0">
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
              {city ? (
                <div className="flex gap-1 rounded-full bg-slate-100 p-0.5">
                  {(['societies', 'listings'] as const).map((t) => (
                    <button key={t} type="button" onClick={() => setTab(t)} className={cn('h-8 rounded-full px-3 text-[13px] font-semibold', tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600')}>
                      {t === 'societies' ? `Societies${cityPlaces ? ` (${cityPlaces.length})` : ''}` : `Listings (${listCount.toLocaleString('en-PK')})`}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-[15px] font-bold text-slate-900">
                  {listCount.toLocaleString('en-PK')} listings {block ? `in ${block.name}` : society ? `in ${society.name}` : 'in view'}
                </p>
              )}
              <button type="button" onClick={() => setShowList(false)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-slate-100" aria-label="Back to map">
                <X className="h-5 w-5" />
              </button>
            </div>
            {city && tab === 'societies' ? (
              <div className="flex min-h-0 flex-1 flex-col pb-24">
                <SocietyList
                  items={cityList}
                  loading={cityPlaces === null}
                  filter={societyFilter}
                  onFilter={setSocietyFilter}
                  onOpen={(p) => { setShowList(false); openPlace(p); }}
                  cityName={city.name}
                />
              </div>
            ) : (
              <div className="flex-1 space-y-2 overflow-y-auto p-2 pb-28">
                {sortedVisible.slice(0, 150).map((item) => (
                  <ListingCard key={item.id} item={item} />
                ))}
                <ScopeMore
                  rows={moreRows}
                  title={sortedVisible.length ? `More in ${society?.name ?? city?.name ?? 'this area'}` : ''}
                  busy={scopeBusy}
                  hasMore={scopeRows.length < scopeTotal}
                  onMore={() => setScopePage((n) => n + 1)}
                />
              </div>
            )}
          </div>
        )}

        {/* Search: cities, societies with maps, this society's blocks */}
        {searchOpen && (
          <div className="absolute inset-0 z-[650] flex flex-col bg-white sm:inset-auto sm:left-3 sm:top-3 sm:max-h-[min(560px,calc(100%-1.5rem))] sm:w-[380px] sm:rounded-2xl sm:shadow-xl sm:ring-1 sm:ring-slate-200">
            <div className="flex items-center gap-2 border-b border-slate-200 p-2">
              <Search className="ml-1.5 h-4 w-4 shrink-0 text-slate-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={plotSearchable ? "Plot (L 215), block, society or city" : "Society, block, city or coordinates"}
                className="h-10 min-w-0 flex-1 bg-transparent text-[15px] text-slate-900 outline-none placeholder:text-slate-400"
              />
              <button type="button" onClick={() => { setSearchOpen(false); setQuery(''); }} className="grid h-9 w-9 place-items-center rounded-full hover:bg-slate-100" aria-label="Close search">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {results.point && (
                <button
                  type="button"
                  onClick={() => { const p = results.point!; setTarget({ lat: p[0], lng: p[1], zoom: 18 }); setClickAt(p); setPlot(null); setSearchOpen(false); setQuery(''); }}
                  className="flex w-full items-center gap-2 rounded-xl bg-primary/5 px-2 py-2.5 text-left text-[14px] font-semibold text-primary hover:bg-primary/10"
                >
                  <MapPin className="h-4 w-4" /> Go to {results.point[0].toFixed(5)}, {results.point[1].toFixed(5)}
                </button>
              )}
              {plotSearchable && (
                <>
                  <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Plots in {society!.name}</p>
                  {!/\d/.test(query) ? (
                    <p className="px-2 pb-1 text-[12.5px] text-slate-500">Type a sector and plot number, e.g. <span className="font-semibold text-slate-700">L 215</span>.</p>
                  ) : plotHits === null ? (
                    <p className="px-2 py-1 text-[13px] text-slate-500">Searching…</p>
                  ) : plotHits.length === 0 ? (
                    <p className="px-2 py-1 text-[13px] text-slate-500">No plot by that number. Try sector and number, e.g. “L 215”.</p>
                  ) : (
                    plotHits.slice(0, 20).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => { showPlot(p); setSearchOpen(false); setQuery(''); }}
                        className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left hover:bg-slate-50"
                      >
                        <span className="grid h-7 w-7 place-items-center rounded-lg bg-amber-100 text-amber-700"><Hash className="h-3.5 w-3.5" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-semibold text-slate-900">
                            {[p.sector && `Sector ${p.sector}`, `Plot ${p.no}`].filter(Boolean).join(' · ')}
                          </span>
                          <span className="block text-[12px] text-slate-500">{[plotSizeLabel(p.sqft), PLOT_USE[p.kind], p.house].filter(Boolean).join(' · ')}</span>
                        </span>
                      </button>
                    ))
                  )}
                </>
              )}
              {results.blockHits.length > 0 && (
                <>
                  <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Blocks in {society!.name}</p>
                  {results.blockHits.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => { chooseBlock(b); setSearchOpen(false); setQuery(''); }}
                      className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-[14px] font-medium text-slate-900 hover:bg-slate-50"
                    >
                      <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-[11px] font-bold text-primary">{b.name.slice(-2)}</span>
                      {b.name}
                    </button>
                  ))}
                </>
              )}
              <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Society maps</p>
              {societies === null ? (
                <p className="px-2 py-2 text-[13px] text-slate-500">Loading…</p>
              ) : results.socHits.length === 0 ? (
                <p className="px-2 py-2 text-[13px] text-slate-500">{q ? 'No society map by that name yet.' : 'Society maps appear here as they are added.'}</p>
              ) : (
                results.socHits.map((s) => (
                  <Link
                    key={`${s.citySlug}/${s.slug}`}
                    href={`/emap/${s.citySlug}/${s.slug}`}
                    className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-slate-50"
                  >
                    <span className="h-9 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                      {s.thumb && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-semibold text-slate-900">{s.name}</span>
                      <span className="block text-[12px] text-slate-500">{s.cityName}</span>
                    </span>
                  </Link>
                ))
              )}
              {results.areaHits.length > 0 && (
                <>
                  <p className="px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">More places in {results.areaHits[0]!.cityName ?? 'this city'}</p>
                  {results.areaHits.map((p) => (
                    <button
                      key={p.slug}
                      type="button"
                      onClick={() => { openPlace(p); setSearchOpen(false); setQuery(''); }}
                      className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-[14px] font-medium text-slate-900 hover:bg-slate-50"
                    >
                      <MapPin className="h-4 w-4 text-slate-400" /> {p.name}
                      {p.listings ? <span className="ml-auto text-[12px] text-slate-500">{p.listings}</span> : null}
                    </button>
                  ))}
                </>
              )}
              <p className="px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Cities</p>
              {results.cityHits.map((p) => (
                <button
                  key={p.slug}
                  type="button"
                  // A city opens its own map page — the city is then selected, with its societies listed.
                  onClick={() => { setSearchOpen(false); setQuery(''); if (p.slug !== cityslug || society) router.push(`/emap/${p.slug}`); else setTarget({ lat: p.lat, lng: p.lng, zoom: p.zoom }); }}
                  className="block w-full rounded-xl px-2 py-2 text-left text-[14px] font-medium text-slate-900 hover:bg-slate-50"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


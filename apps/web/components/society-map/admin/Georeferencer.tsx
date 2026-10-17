'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ImageOverlay, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, Search, Trash2 } from 'lucide-react';
import { MAP_TILES, geocodeAddress } from '@/lib/map-tiles';
import { applyAffine, cornersOf, fitAffine, fromMerc, residuals } from '@/lib/society-geo';
import { cn } from '@/lib/utils';
import { AffineImageLayer } from './AffineImageLayer';

/*
 * Placing a scanned master plan on the ground.
 *
 * The plan on the left, the satellite on the right. Click a spot on the plan
 * (a road junction, a roundabout, the corner of a park), then the same spot on
 * the satellite: that is one point. Three points place the plan; four to six
 * spread to the edges place it well. From the third point on, the plan is
 * drawn over the satellite so the fit can be judged, the satellite jumps to
 * where the next point should be, and each point shows how far off it is.
 */

export interface ControlPoint {
  px: number;
  py: number;
  lat: number;
  lng: number;
}

export interface GeoLayer {
  previewUrl: string;
  previewWidth: number;
  previewHeight: number;
  width: number;
  height: number;
}

const pinIcon = (label: string, pending = false) =>
  L.divIcon({
    className: '',
    html: `<div class="pd-gcp${pending ? ' pd-gcp--pending' : ''}">${label}</div>`,
    iconSize: [0, 0],
  });

function Clicks({ onClick }: { onClick: (e: L.LeafletMouseEvent) => void }) {
  useMapEvents({ click: onClick });
  return null;
}

function Fit({ bounds }: { bounds: L.LatLngBoundsExpression }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds, { padding: [10, 10] });
  }, [map]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function Pan({ to }: { to: { lat: number; lng: number; zoom?: number; n: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (to) map.setView([to.lat, to.lng], to.zoom ?? Math.max(map.getZoom(), 17), { animate: true });
  }, [map, to]);
  return null;
}

export function Preview({ url, corners, opacity }: { url: string; corners: number[][] | null; opacity: number }) {
  const map = useMap();
  const layer = useRef<AffineImageLayer | null>(null);
  const has = !!corners;
  // Create with the first corners, remove on unmount (and on React's dev double-mount).
  useEffect(() => {
    if (!corners) return;
    const l = new AffineImageLayer(url, corners, opacity);
    l.addTo(map);
    layer.current = l;
    return () => {
      l.remove();
      layer.current = null;
    };
  }, [map, url, has]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (corners) layer.current?.setCorners(corners);
  }, [corners]);
  useEffect(() => {
    layer.current?.setOpacity(opacity);
  }, [opacity]);
  return null;
}

export default function Georeferencer({
  layer,
  points,
  onChange,
  start,
}: {
  layer: GeoLayer;
  points: ControlPoint[];
  onChange: (points: ControlPoint[]) => void;
  /** Where the satellite opens when there are no points yet. */
  start: { lat: number; lng: number; zoom: number };
}) {
  const pw = layer.previewWidth;
  const ph = layer.previewHeight;
  const sx = layer.width / pw; // preview px → source px
  const sy = layer.height / ph;
  const [pending, setPending] = useState<{ px: number; py: number } | null>(null);
  const [opacity, setOpacity] = useState(0.6);
  const [showPlan, setShowPlan] = useState(true);
  const [pan, setPan] = useState<{ lat: number; lng: number; zoom?: number; n: number } | null>(null);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<{ label: string; lat: number; lng: number }[]>([]);
  const panN = useRef(0);

  const fit = useMemo(() => fitAffine(points), [points]);
  const corners = useMemo(() => (fit ? cornersOf(fit, layer.width, layer.height) : null), [fit, layer.width, layer.height]);
  const errors = useMemo(() => (fit ? residuals(fit, points) : []), [fit, points]);

  // Plan (CRS.Simple): preview pixel (x, y) ↔ latlng (-y, x).
  const toPlan = (p: { px: number; py: number }): [number, number] => [-(p.py / sy), p.px / sx];
  const fromPlan = (ll: L.LatLng) => ({
    px: Math.min(layer.width, Math.max(0, ll.lng * sx)),
    py: Math.min(layer.height, Math.max(0, -ll.lat * sy)),
  });
  const planBounds: L.LatLngBoundsExpression = [[-ph, 0], [0, pw]];

  const predict = (p: { px: number; py: number }) => {
    if (!fit) return null;
    const [x, y] = applyAffine(fit, p.px, p.py);
    const [lat, lng] = fromMerc(x, y);
    return { lat, lng };
  };

  const onPlanClick = (e: L.LeafletMouseEvent) => {
    const p = fromPlan(e.latlng);
    setPending(p);
    const guess = predict(p);
    if (guess) setPan({ ...guess, n: ++panN.current });
  };

  const onGroundClick = (e: L.LeafletMouseEvent) => {
    if (!pending) return;
    onChange([...points, { ...pending, lat: e.latlng.lat, lng: e.latlng.lng }]);
    setPending(null);
  };

  const move = (i: number, patch: Partial<ControlPoint>) => onChange(points.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const search = async () => {
    const r = await geocodeAddress(q).catch(() => []);
    setHits(r);
    if (r[0]) setPan({ lat: r[0].lat, lng: r[0].lng, zoom: 16, n: ++panN.current });
  };

  const sat = MAP_TILES.satellite;
  const guess = pending ? predict(pending) : null;
  const worst = errors.length ? Math.max(...errors) : 0;

  return (
    <div className="space-y-3">
      <div className={cn('rounded-lg px-3 py-2 text-sm', pending ? 'bg-orange-50 text-orange-900' : 'bg-slate-50 text-slate-700')}>
        {pending
          ? `Now click the same spot on the satellite (right) for point ${points.length + 1}.`
          : points.length < 3
            ? `Click a clear spot on the plan (left) — a junction, roundabout or park corner. ${3 - points.length} more point${3 - points.length === 1 ? '' : 's'} needed.`
            : 'Placed. Add points near the edges for a better fit, or drag any numbered pin to adjust it.'}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="overflow-hidden rounded-xl border">
          <div className="flex h-9 items-center border-b bg-white px-3 text-xs font-semibold text-slate-600">Master plan</div>
          <MapContainer
            crs={L.CRS.Simple}
            bounds={planBounds}
            minZoom={-4}
            maxZoom={4}
            zoomSnap={0.25}
            className="h-[460px] w-full bg-slate-100"
            attributionControl={false}
          >
            <ImageOverlay url={layer.previewUrl} bounds={planBounds} />
            <Fit bounds={planBounds} />
            <Clicks onClick={onPlanClick} />
            {points.map((p, i) => (
              <Marker
                key={`p${i}`}
                position={toPlan(p)}
                icon={pinIcon(String(i + 1))}
                draggable
                eventHandlers={{ dragend: (e) => move(i, fromPlan((e.target as L.Marker).getLatLng())) }}
              />
            ))}
            {pending && <Marker position={toPlan(pending)} icon={pinIcon(String(points.length + 1), true)} />}
          </MapContainer>
        </div>

        <div className="overflow-hidden rounded-xl border">
          <div className="flex h-9 items-center gap-2 border-b bg-white px-2">
            <span className="px-1 text-xs font-semibold text-slate-600">Satellite</span>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void search();
              }}
              className="relative ml-auto flex items-center"
            >
              <Search className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Find a place"
                className="h-7 w-44 rounded-md border pl-7 pr-2 text-xs outline-none focus:border-primary"
              />
            </form>
          </div>
          <div className="relative">
            <MapContainer center={[start.lat, start.lng]} zoom={start.zoom} maxZoom={21} className="h-[460px] w-full" attributionControl={false}>
              <TileLayer url={sat.url} subdomains={sat.subdomains} maxNativeZoom={sat.maxZoom} maxZoom={21} />
              {showPlan && <Preview url={layer.previewUrl} corners={corners} opacity={opacity} />}
              <Pan to={pan} />
              <Clicks onClick={onGroundClick} />
              {points.map((p, i) => (
                <Marker
                  key={`g${i}`}
                  position={[p.lat, p.lng]}
                  icon={pinIcon(String(i + 1))}
                  draggable
                  eventHandlers={{
                    dragend: (e) => {
                      const ll = (e.target as L.Marker).getLatLng();
                      move(i, { lat: ll.lat, lng: ll.lng });
                    },
                  }}
                />
              ))}
              {guess && <Marker position={[guess.lat, guess.lng]} icon={pinIcon('?', true)} interactive={false} />}
            </MapContainer>
            {hits.length > 1 && (
              <div className="absolute left-2 top-2 z-[500] max-w-[260px] rounded-lg bg-white p-1 text-xs shadow-md">
                {hits.slice(0, 4).map((h) => (
                  <button
                    key={`${h.lat},${h.lng}`}
                    type="button"
                    className="block w-full truncate rounded px-2 py-1 text-left hover:bg-slate-100"
                    onClick={() => {
                      setPan({ lat: h.lat, lng: h.lng, zoom: 16, n: ++panN.current });
                      setHits([]);
                    }}
                  >
                    {h.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {corners && (
            <div className="flex items-center gap-3 border-t bg-white px-3 py-2 text-xs">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={showPlan} onChange={(e) => setShowPlan(e.target.checked)} /> Show plan
              </label>
              <input type="range" min={0.1} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="w-32" aria-label="Plan transparency" />
              <span className="text-muted-foreground">Fade the plan to check roads line up.</span>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-semibold">Points ({points.length})</p>
          {points.length >= 3 && (
            <p className={cn('text-xs font-medium', worst > 25 ? 'text-red-600' : worst > 8 ? 'text-amber-600' : 'text-emerald-600')}>
              {worst > 25 ? 'A point looks wrong — check the red one.' : worst > 8 ? 'Fair fit. Adjust the amber points for better.' : 'Good fit.'}
            </p>
          )}
        </div>
        {points.length === 0 ? (
          <p className="px-3 py-3 text-sm text-muted-foreground">No points yet.</p>
        ) : (
          <ul className="divide-y text-sm">
            {points.map((p, i) => {
              const err = errors[i];
              return (
                <li key={i} className="flex items-center gap-3 px-3 py-1.5">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-900 text-[11px] font-bold text-white">{i + 1}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {p.lat.toFixed(6)}, {p.lng.toFixed(6)}
                  </span>
                  {err !== undefined && (
                    <span className={cn('text-xs font-semibold', err > 25 ? 'text-red-600' : err > 8 ? 'text-amber-600' : 'text-emerald-600')}>
                      {err < 1 ? '< 1 m' : `${err.toFixed(1)} m off`}
                    </span>
                  )}
                  <button type="button" className="ml-auto grid h-7 w-7 place-items-center rounded hover:bg-slate-100" onClick={() => setPan({ lat: p.lat, lng: p.lng, n: ++panN.current })} aria-label="Show on satellite">
                    <Crosshair className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" className="grid h-7 w-7 place-items-center rounded hover:bg-red-50" onClick={() => onChange(points.filter((_, j) => j !== i))} aria-label="Delete point">
                    <Trash2 className="h-3.5 w-3.5 text-red-600" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {pending && (
          <div className="border-t px-3 py-2 text-right">
            <button type="button" className="text-xs font-semibold text-slate-600 hover:text-slate-900" onClick={() => setPending(null)}>
              Cancel this point
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

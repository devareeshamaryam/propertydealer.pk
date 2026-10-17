'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Circle, Marker, Polygon, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import api from '@/lib/api';
import {
  POI_ICONS,
  POI_LABELS,
  type SocietyBlock,
  type SocietyInView,
  type SocietyMapPage,
} from '@/lib/society-map';

/*
 * The society plans on a map.
 *
 * Every published society map inside the view is drawn as its own tile
 * layer (only the tiles on screen are fetched), so moving around Lahore shows
 * each society's master plan merged into the street or satellite map. On a
 * society's own page its blocks and landmarks are drawn too. (The names on the
 * map come from PlaceLabels.)
 */

const poiIcon = (kind: string) =>
  L.divIcon({
    className: '',
    html: `<div class="pd-poi" title="${POI_LABELS[kind] ?? ''}">${POI_ICONS[kind] ?? '📍'}</div>`,
    iconSize: [0, 0],
  });

export default function SocietyLayers({
  focus,
  opacity,
  visible,
  onCount,
  onBlock,
  activeBlock,
  poisOn = true,
  poiOff,
}: {
  /** The society whose page this is: its blocks and landmarks are drawn. */
  focus?: SocietyMapPage | null;
  /** Multiplies each layer's own opacity (the slider). */
  opacity: number;
  visible: boolean;
  /** How many plans are in view — the overlay controls show only when there are some. */
  onCount?: (n: number) => void;
  onBlock?: (block: SocietyBlock) => void;
  activeBlock?: string | null;
  /** Landmarks on or off (the layers menu). */
  poisOn?: boolean;
  /** Landmark kinds switched off. */
  poiOff?: Set<string>;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  const [inView, setInView] = useState<SocietyInView[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const req = useRef(0);

  const load = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setZoom(map.getZoom());
      if (map.getZoom() < 10) {
        setInView([]);
        return;
      }
      const b = map.getBounds().pad(0.3);
      const id = ++req.current;
      try {
        const res = await api.get('/society-maps/in-view', {
          params: {
            minLat: b.getSouth().toFixed(3),
            maxLat: b.getNorth().toFixed(3),
            minLng: b.getWest().toFixed(3),
            maxLng: b.getEast().toFixed(3),
          },
        });
        if (id === req.current) setInView(Array.isArray(res.data?.data) ? res.data.data : []);
      } catch {
        // The API may not have society maps yet; the map works without them.
      }
    }, 200);
  }, [map]);

  useMapEvents({ moveend: load, zoomend: load });
  useEffect(() => {
    load();
  }, [load]);

  // The page's own society first (always drawn), then the rest in view.
  const societies = useMemo(() => {
    const list: SocietyInView[] = [];
    if (focus) {
      list.push({ id: focus.id, name: focus.name, slug: focus.slug, citySlug: focus.citySlug, center: focus.center, boundary: focus.boundary, layers: focus.layers });
    }
    for (const s of inView) if (!list.some((x) => x.id === s.id)) list.push(s);
    return list;
  }, [focus, inView]);

  const layerCount = societies.reduce((n, s) => n + s.layers.length, 0);
  useEffect(() => {
    onCount?.(layerCount);
  }, [layerCount, onCount]);

  return (
    <>
      {visible &&
        societies.flatMap((s) =>
          s.layers.map((l) => (
            <TileLayer
              key={`${s.id}:${l.id}:${l.url}`}
              url={l.url}
              bounds={L.latLngBounds([l.bounds[0], l.bounds[1]], [l.bounds[2], l.bounds[3]])}
              minZoom={Math.max(10, l.minZoom - 2)}
              minNativeZoom={l.minZoom}
              maxNativeZoom={l.maxZoom}
              maxZoom={22}
              opacity={Math.max(0, Math.min(1, l.opacity * opacity))}
              zIndex={5}
              keepBuffer={1}
            />
          )),
        )}

      {/* Outlines: the society's edge, and other societies' edges faintly. */}
      {societies.map((s) =>
        s.boundary.length > 2 ? (
          <Polygon
            key={`b:${s.id}`}
            positions={s.boundary}
            pathOptions={{
              color: s.id === focus?.id ? '#0f172a' : '#475569',
              weight: s.id === focus?.id ? 2.5 : 1.5,
              dashArray: s.id === focus?.id ? undefined : '6 6',
              fill: false,
            }}
            interactive={false}
          />
        ) : null,
      )}

      {/* Only roughly placed (no outline yet): a soft circle around where it is. */}
      {focus && focus.boundary.length < 3 && focus.center && focus.info?.location && (
        <Circle
          center={[focus.center.lat, focus.center.lng]}
          radius={700}
          pathOptions={{ color: '#0f172a', weight: 2, dashArray: '6 6', fillOpacity: 0.05 }}
          interactive={false}
        />
      )}

      {/* The page's own society: blocks and landmarks. */}
      {focus?.blocks.map((b) =>
        b.polygon.length > 2 ? (
          <Polygon
            key={`blk:${b.id}`}
            positions={b.polygon}
            pathOptions={{
              color: b.color || '#0e7c66',
              weight: activeBlock === b.id ? 3 : 1.5,
              fillOpacity: activeBlock === b.id ? 0.18 : 0.04,
              fillColor: b.color || '#0e7c66',
            }}
            eventHandlers={{ click: () => onBlock?.(b) }}
          >
            {zoom >= 15 && (
              <Tooltip permanent direction="center" className="pd-block-label" interactive={false}>
                {b.name}
              </Tooltip>
            )}
          </Polygon>
        ) : null,
      )}
      {focus && poisOn && zoom >= 15 &&
        focus.pois.filter((p) => !poiOff?.has(p.kind)).map((p) => (
          <Marker key={`poi:${p.id}`} position={[p.lat, p.lng]} icon={poiIcon(p.kind)}>
            <Tooltip direction="top" offset={[0, -14]}>{p.name}</Tooltip>
          </Marker>
        ))}
    </>
  );
}

/** Distance / area measuring: click to add points. */
export function MeasureLayer({
  points,
  mode,
  onAdd,
}: {
  points: [number, number][];
  mode: 'distance' | 'area';
  onAdd: (p: [number, number]) => void;
}) {
  useMapEvents({ click: (e) => onAdd([e.latlng.lat, e.latlng.lng]) });
  const dot = useMemo(
    () => L.divIcon({ className: '', html: '<div class="pd-measure-dot"></div>', iconSize: [0, 0] }),
    [],
  );
  return (
    <>
      {points.length > 1 &&
        (mode === 'area' && points.length > 2 ? (
          <Polygon positions={points} pathOptions={{ color: '#f97316', weight: 2.5, fillOpacity: 0.15, dashArray: '6 4' }} interactive={false} />
        ) : (
          <Polyline positions={points} pathOptions={{ color: '#f97316', weight: 3, dashArray: '6 4' }} interactive={false} />
        ))}
      {points.map((p, i) => (
        <Marker key={i} position={p} icon={dot} interactive={false} />
      ))}
    </>
  );
}


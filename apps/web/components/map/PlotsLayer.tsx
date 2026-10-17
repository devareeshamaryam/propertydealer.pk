'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Marker, Polygon, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import api from '@/lib/api';

/*
 * Plots from a society's GIS, drawn street by street: every plot's outline,
 * coloured by what it is (residential, commercial, park, mosque…), and its
 * number once you are close enough to read it — the way a society map is
 * read on site. Works where there is no scanned master plan as well.
 *
 * Only the plots in view are fetched (from zoom 17), on a canvas, so a block
 * of a thousand plots stays smooth on a phone. Taps go through to the map,
 * which looks the plot up and shows its card.
 */

type Row = [string, string, string, string, [number, number][]];

export const PLOT_COLORS: Record<string, { stroke: string; fill: string; label: string }> = {
  residential: { stroke: '#b45309', fill: '#fde68a', label: 'Residential' },
  commercial: { stroke: '#1d4ed8', fill: '#93c5fd', label: 'Commercial' },
  park: { stroke: '#15803d', fill: '#86efac', label: 'Park / green' },
  mosque: { stroke: '#0f766e', fill: '#5eead4', label: 'Mosque' },
  school: { stroke: '#7c3aed', fill: '#c4b5fd', label: 'School' },
  hospital: { stroke: '#be123c', fill: '#fda4af', label: 'Health' },
  utility: { stroke: '#475569', fill: '#cbd5e1', label: 'Utility' },
  parking: { stroke: '#475569', fill: '#e2e8f0', label: 'Parking' },
  graveyard: { stroke: '#57534e', fill: '#d6d3d1', label: 'Graveyard' },
  apartments: { stroke: '#9333ea', fill: '#e9d5ff', label: 'Apartments' },
};

const MIN_ZOOM = 17;
const LABEL_ZOOM = 18;

const labelIcon = (text: string) =>
  L.divIcon({ className: '', html: `<div class="pd-plot-no">${text.replace(/[<>&"]/g, '')}</div>`, iconSize: [0, 0] });

const centre = (ring: [number, number][]): [number, number] => {
  let lat = 0;
  let lng = 0;
  const n = Math.max(1, ring.length - 1);
  for (let i = 0; i < n; i++) {
    lat += ring[i]![0];
    lng += ring[i]![1];
  }
  return [lat / n, lng / n];
};

export default function PlotsLayer({ enabled, onCount }: { enabled: boolean; onCount?: (n: number) => void }) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  const [rows, setRows] = useState<Row[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const req = useRef(0);
  const renderer = useMemo(() => L.canvas({ padding: 0.3 }), []);

  const load = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const z = map.getZoom();
      setZoom(z);
      if (!enabled || z < MIN_ZOOM) {
        setRows([]);
        return;
      }
      const b = map.getBounds().pad(0.15);
      const id = ++req.current;
      try {
        const res = await api.get('/society-maps/plots/in-view', {
          params: {
            minLat: b.getSouth().toFixed(5),
            maxLat: b.getNorth().toFixed(5),
            minLng: b.getWest().toFixed(5),
            maxLng: b.getEast().toFixed(5),
          },
        });
        if (id === req.current) setRows(Array.isArray(res.data?.data?.plots) ? res.data.data.plots : []);
      } catch {
        // plots are an extra: the map works without them
      }
    }, 250);
  }, [map, enabled]);

  useMapEvents({ moveend: load, zoomend: load });
  useEffect(() => {
    load();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [load]);
  useEffect(() => {
    onCount?.(rows.length);
  }, [rows.length, onCount]);

  if (!enabled || zoom < MIN_ZOOM || !rows.length) return null;

  // Numbers only when close enough to read, and not more than the screen can hold.
  const labels = zoom >= LABEL_ZOOM && rows.length <= 900;

  return (
    <>
      {rows.map(([id, , , kind, ring]) =>
        ring.length > 2 ? (
          <Polygon
            key={id}
            positions={ring}
            interactive={false}
            pathOptions={{
              renderer,
              color: (PLOT_COLORS[kind] ?? PLOT_COLORS.residential!).stroke,
              weight: zoom >= 19 ? 1.2 : 0.8,
              fillColor: (PLOT_COLORS[kind] ?? PLOT_COLORS.residential!).fill,
              fillOpacity: 0.35,
            }}
          />
        ) : null,
      )}
      {labels &&
        rows.map(([id, no, , , ring]) =>
          no && ring.length > 2 ? <Marker key={`n:${id}`} position={centre(ring)} icon={labelIcon(no)} interactive={false} keyboard={false} /> : null,
        )}
    </>
  );
}

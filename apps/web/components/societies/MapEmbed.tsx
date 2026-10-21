'use client';

import { useState } from 'react';
import { Map as MapIcon } from 'lucide-react';
import MapExplorerClient from '@/components/map/MapExplorerClient';
import type { MapPlace } from '@/components/map/MapExplorer';
import type { SocietyMapPage } from '@/lib/society-map';

/**
 * The satellite map inside a page (a society guide, a city's results): a
 * preview first, the live map on a tap. Leaflet and its tiles are heavy,
 * and most visitors scroll past — so they only load for those who want it.
 */
export default function MapEmbed({
  places,
  society,
  focus,
  city,
  preview,
  label,
}: {
  places: MapPlace[];
  society?: SocietyMapPage | null;
  focus?: { lat: number; lng: number; zoom: number } | null;
  city?: { slug: string; name: string } | null;
  /** An image to show until the map opens — the society's master plan. */
  preview?: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  if (open) return <MapExplorerClient places={places} society={society ?? null} focus={focus ?? null} city={city ?? null} mode="embed" />;
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="group relative grid h-[260px] w-full place-items-center overflow-hidden rounded-2xl bg-slate-200 ring-1 ring-slate-200 sm:h-[340px]"
    >
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
      ) : (
        <span
          aria-hidden
          className="absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              'linear-gradient(rgba(148,163,184,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.35) 1px, transparent 1px), radial-gradient(circle at 30% 40%, #bbf7d0 0, transparent 35%), radial-gradient(circle at 70% 65%, #bfdbfe 0, transparent 30%)',
            backgroundSize: '28px 28px, 28px 28px, 100% 100%, 100% 100%',
          }}
        />
      )}
      <span className="absolute inset-0 bg-slate-900/25 transition-colors group-hover:bg-slate-900/15" />
      <span className="relative inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-[15px] font-bold text-slate-900 shadow-lg">
        <MapIcon className="h-5 w-5 text-primary" /> {label}
      </span>
    </button>
  );
}

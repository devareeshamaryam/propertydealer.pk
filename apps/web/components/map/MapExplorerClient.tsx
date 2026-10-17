'use client';

import dynamic from 'next/dynamic';
import type { MapPlace } from './MapExplorer';
import type { SocietyMapPage } from '@/lib/society-map';
import { cn } from '@/lib/utils';

type Props = {
  places: MapPlace[];
  focus?: { lat: number; lng: number; zoom: number } | null;
  society?: SocietyMapPage | null;
  city?: { slug: string; name: string } | null;
  mode?: 'full' | 'page';
};

// Leaflet needs the browser.
const MapExplorer = dynamic(() => import('./MapExplorer'), {
  ssr: false,
  loading: () => <div className="grid h-[72dvh] place-items-center bg-slate-100 text-sm text-slate-500 lg:h-[calc(100dvh-64px)]">Loading map…</div>,
});

export default function MapExplorerClient(props: Props) {
  return (
    <div className={cn(props.mode === 'page' ? 'min-h-[480px]' : '')}>
      {/* A new map for each city / society, so choosing a city always opens on that city. */}
      <MapExplorer key={props.society ? `s:${props.society.citySlug}/${props.society.slug}` : props.city ? `c:${props.city.slug}` : 'all'} {...props} />
    </div>
  );
}

'use client';

import dynamic from 'next/dynamic';
import type { MapPlace } from './MapExplorer';

// Leaflet needs the browser.
const MapExplorer = dynamic(() => import('./MapExplorer'), {
  ssr: false,
  loading: () => <div className="grid h-[calc(100dvh-64px)] place-items-center bg-slate-100 text-sm text-slate-500">Loading map…</div>,
});

export default function MapExplorerClient(props: { places: MapPlace[]; focus?: { lat: number; lng: number; zoom: number } | null }) {
  return <MapExplorer {...props} />;
}

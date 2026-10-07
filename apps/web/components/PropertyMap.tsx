'use client';

import { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ExternalLink } from 'lucide-react';

import { MAP_TILES, type MapStyle } from '@/lib/map-tiles';

// Fix for default marker icon in Leaflet with Next.js
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface PropertyMapProps {
  latitude: number;
  longitude: number;
  title: string;
}

export default function PropertyMap({ latitude, longitude, title }: PropertyMapProps) {
  const position: [number, number] = [latitude, longitude];
  const [style, setStyle] = useState<MapStyle>('street');
  const tile = MAP_TILES[style];

  return (
    <div className="relative h-[350px] w-full overflow-hidden rounded-xl border border-border shadow-inner">
      <MapContainer
        center={position}
        zoom={16}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          key={style}
          attribution={tile.attribution}
          url={tile.url}
          maxZoom={tile.maxZoom}
          subdomains={tile.subdomains}
        />
        <Marker position={position}>
          <Popup>
            <div className="font-semibold">{title}</div>
          </Popup>
        </Marker>
      </MapContainer>

      {/* Satellite is what tells a buyer whether the plot is built up yet. */}
      <div className="absolute right-2 top-2 z-[400] flex overflow-hidden rounded-md border border-border bg-background shadow-sm">
        {(Object.keys(MAP_TILES) as MapStyle[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setStyle(key)}
            className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
              style === key
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {MAP_TILES[key].label}
          </button>
        ))}
      </div>

      {/* Directions belong in the app the phone already has. */}
      <a
        href={`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-2 right-2 z-[400] inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-semibold shadow-sm hover:bg-muted"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Directions
      </a>
    </div>
  );
}

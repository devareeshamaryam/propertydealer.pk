'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, Loader2, MapPin, Search } from 'lucide-react';

import {
  MAP_TILES,
  PAKISTAN_CENTER,
  cityCenter,
  geocodeAddress,
  type GeocodeHit,
  type MapStyle,
} from '@/lib/map-tiles';

// Fix for default marker icon in Leaflet with Next.js
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapPickerProps {
  onLocationSelect: (lat: number, lng: number) => void;
  initialLat?: number;
  initialLng?: number;
  /**
   * The address being typed into the form — the listing's own address, area and
   * city. "Find from address" searches this, so the pin and the address agree
   * instead of being two unrelated fields.
   */
  addressQuery?: string;
  /** The city picked in the form, used as the opening view for a new listing. */
  city?: string;
}

function LocationMarker({
  onLocationSelect,
  position,
}: {
  onLocationSelect: (lat: number, lng: number) => void;
  position: [number, number] | null;
}) {
  useMapEvents({
    click(event) {
      onLocationSelect(event.latlng.lat, event.latlng.lng);
    },
  });

  return position === null ? null : (
    <Marker
      position={position}
      draggable
      eventHandlers={{
        // Dragging the pin is how you correct a near-miss; before this the only
        // way to adjust was to click again and hope.
        dragend(event) {
          const { lat, lng } = (event.target as L.Marker).getLatLng();
          onLocationSelect(lat, lng);
        },
      }}
    />
  );
}

/** Keeps the map looking at the pin when something else moves it. */
function ChangeView({ center, zoom }: { center: [number, number]; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom ?? map.getZoom());
  }, [center, zoom, map]);
  return null;
}

export default function MapPicker({
  onLocationSelect,
  initialLat,
  initialLng,
  addressQuery,
  city,
}: MapPickerProps) {
  const hasInitial = Boolean(initialLat && initialLng);

  const [position, setPosition] = useState<[number, number] | null>(
    hasInitial ? [initialLat as number, initialLng as number] : null,
  );
  const [style, setStyle] = useState<MapStyle>('street');
  const [search, setSearch] = useState('');
  const [hits, setHits] = useState<GeocodeHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [zoom, setZoom] = useState(hasInitial ? 16 : 5);
  const abort = useRef<AbortController | null>(null);

  // A new listing opens on the city that was chosen, not on the whole country.
  const center = useMemo<[number, number]>(
    () => position ?? cityCenter(city) ?? PAKISTAN_CENTER,
    [position, city],
  );

  useEffect(() => {
    if (!position && cityCenter(city)) setZoom(12);
  }, [city, position]);

  /*
   * Adopt coordinates that arrive after mount.
   *
   * `initialLat`/`initialLng` were read once, in the useState initialisers
   * above. That is right for the add form, where they are known from the
   * start, and wrong for the edit form, which renders the whole form straight
   * away and fills it in when the fetch resolves — so the map mounted with
   * nothing, the real pin landed a moment later as a prop, and the map never
   * looked at it. The listing opened with no marker, and saving the form
   * wrote back whatever that empty map held. That is the "the map resets when
   * I edit" report.
   *
   * Guarded on `position` being null, so this only ever fills an empty map:
   * once there is a pin — placed by the fetch or by the person using it — a
   * re-render with the same props can never move it back.
   */
  useEffect(() => {
    if (position) return;
    if (!initialLat || !initialLng) return;

    setPosition([initialLat, initialLng]);
    setZoom(16);
  }, [initialLat, initialLng, position]);

  const place = useCallback(
    (lat: number, lng: number, nextZoom = 17) => {
      setPosition([lat, lng]);
      setZoom(nextZoom);
      onLocationSelect(lat, lng);
    },
    [onLocationSelect],
  );

  const runSearch = async (query: string) => {
    const text = query.trim();
    if (text.length < 3) return;

    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;

    try {
      setSearching(true);
      const found = await geocodeAddress(text, controller.signal);
      setHits(found);
      // One confident answer needs no list — just go there.
      if (found.length === 1 && found[0]) {
        place(found[0].lat, found[0].lng);
        setHits([]);
      }
    } catch {
      // Aborted, offline, or Nominatim throttling us. The map still works by
      // clicking, which is the important part.
    } finally {
      setSearching(false);
    }
  };

  const locateMe = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => place(pos.coords.latitude, pos.coords.longitude, 18),
      () => {},
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const tile = MAP_TILES[style];
  const addressReady = Boolean(addressQuery && addressQuery.trim().length > 3);

  return (
    <div className="space-y-2">
      {/* Address → pin. The whole point: the map follows what was typed. */}
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void runSearch(search);
              }
            }}
            placeholder="Search a society, block or landmark…"
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm focus:border-transparent focus:ring-2 focus:ring-gray-800"
          />
        </div>

        <button
          type="button"
          onClick={() => void runSearch(search)}
          disabled={searching || search.trim().length < 3}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
        >
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Search
        </button>

        {addressReady && (
          <button
            type="button"
            onClick={() => {
              setSearch(addressQuery!.trim());
              void runSearch(addressQuery!);
            }}
            disabled={searching}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            title="Use the address, area and city entered above"
          >
            <MapPin className="h-4 w-4" />
            Find from address
          </button>
        )}

        <button
          type="button"
          onClick={locateMe}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-medium hover:bg-gray-50"
          title="Use my current location — handy when standing at the property"
        >
          <Crosshair className="h-4 w-4" />
          I&apos;m here
        </button>
      </div>

      {hits.length > 1 && (
        <ul className="divide-y rounded-lg border bg-white text-sm">
          {hits.map((hit) => (
            <li key={`${hit.lat},${hit.lng}`}>
              <button
                type="button"
                onClick={() => {
                  place(hit.lat, hit.lng);
                  setHits([]);
                }}
                className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-gray-50"
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                <span className="line-clamp-2">{hit.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative h-[300px] w-full overflow-hidden rounded-lg border border-gray-300">
        <MapContainer
          center={center}
          zoom={zoom}
          scrollWheelZoom
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            key={style}
            attribution={tile.attribution}
            url={tile.url}
            maxZoom={tile.maxZoom}
            subdomains={tile.subdomains}
          />
          <ChangeView center={center} zoom={zoom} />
          <LocationMarker onLocationSelect={place} position={position} />
        </MapContainer>

        {/* Satellite is how a plot in a new society gets identified. */}
        <div className="absolute right-2 top-2 z-[400] flex overflow-hidden rounded-md border border-gray-300 bg-white shadow-sm">
          {(Object.keys(MAP_TILES) as MapStyle[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setStyle(key)}
              className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                style === key ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {MAP_TILES[key].label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-500">
        {position
          ? `Pinned at ${position[0].toFixed(5)}, ${position[1].toFixed(5)} — drag the pin to adjust.`
          : 'Search the address, or tap the map to drop a pin.'}
      </p>
    </div>
  );
}

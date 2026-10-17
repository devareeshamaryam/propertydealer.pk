'use client';

import { useEffect, useState } from 'react';
import { MapContainer, Marker, Polygon, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Check, Crosshair, MapPin, Pencil, Plus, Square, Trash2, Undo2, X } from 'lucide-react';
import { MAP_TILES } from '@/lib/map-tiles';
import { POI_ICONS, POI_LABELS, polygonSqft, marlaLabel } from '@/lib/society-map';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Preview } from './Georeferencer';

/*
 * Drawing on the placed plan: the society's outline, its blocks (each a
 * polygon visitors can tap to see that block's listings) and landmarks —
 * gates, mosques, parks — plus the view the public page opens on.
 *
 * Click to add corners; Finish closes the shape. Pick a block in the list to
 * drag its corners.
 */

export interface EditorBlock {
  id?: string;
  name: string;
  polygon: [number, number][];
  color?: string;
}

export interface EditorPoi {
  id?: string;
  name: string;
  kind: string;
  lat: number;
  lng: number;
}

export interface EditorLayer {
  previewUrl: string;
  corners?: number[][];
  opacity: number;
  tiles?: { status: string; url?: string; bounds?: number[]; minZoom?: number; maxZoom?: number };
}

type Mode = 'idle' | 'boundary' | 'block' | 'poi';

const vertexIcon = L.divIcon({ className: '', html: '<div class="pd-vertex"></div>', iconSize: [0, 0] });
const poiIcon = (kind: string) => L.divIcon({ className: '', html: `<div class="pd-poi">${POI_ICONS[kind] ?? '📍'}</div>`, iconSize: [0, 0] });

function Clicks({ onClick }: { onClick: (ll: [number, number]) => void }) {
  useMapEvents({ click: (e) => onClick([e.latlng.lat, e.latlng.lng]) });
  return null;
}

function ViewGrabber({ onReady }: { onReady: (m: L.Map) => void }) {
  const map = useMap();
  useEffect(() => onReady(map), [map]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Drag handles on a polygon's corners. */
function Vertices({ polygon, onChange }: { polygon: [number, number][]; onChange: (p: [number, number][]) => void }) {
  return (
    <>
      {polygon.map((p, i) => (
        <Marker
          key={i}
          position={p}
          icon={vertexIcon}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const ll = (e.target as L.Marker).getLatLng();
              onChange(polygon.map((q, j) => (j === i ? [ll.lat, ll.lng] : q)));
            },
            contextmenu: () => polygon.length > 3 && onChange(polygon.filter((_, j) => j !== i)),
          }}
        />
      ))}
    </>
  );
}

export default function ShapeEditor({
  layers,
  boundary,
  blocks,
  pois,
  center,
  zoom,
  onChange,
}: {
  layers: EditorLayer[];
  boundary: [number, number][];
  blocks: EditorBlock[];
  pois: EditorPoi[];
  center: { lat: number; lng: number };
  zoom: number;
  onChange: (patch: { boundary?: [number, number][]; blocks?: EditorBlock[]; pois?: EditorPoi[]; center?: { lat: number; lng: number }; zoom?: number }) => void;
}) {
  const [mode, setMode] = useState<Mode>('idle');
  const [draft, setDraft] = useState<[number, number][]>([]);
  const [draftName, setDraftName] = useState('');
  const [poiDraft, setPoiDraft] = useState<EditorPoi | null>(null);
  const [selected, setSelected] = useState<number | 'boundary' | null>(null);
  const [map, setMap] = useState<L.Map | null>(null);
  const [opacity, setOpacity] = useState(0.8);

  const start = (m: Mode) => {
    setMode(m);
    setDraft([]);
    setPoiDraft(null);
    setSelected(null);
    if (m === 'block') setDraftName(`Block ${String.fromCharCode(65 + (blocks.length % 26))}`);
  };

  const onClick = (ll: [number, number]) => {
    if (mode === 'boundary' || mode === 'block') setDraft((d) => [...d, ll]);
    else if (mode === 'poi') setPoiDraft({ name: poiDraft?.name ?? '', kind: poiDraft?.kind ?? 'gate', lat: ll[0], lng: ll[1] });
  };

  const finish = () => {
    if (draft.length < 3) return;
    if (mode === 'boundary') onChange({ boundary: draft });
    if (mode === 'block') onChange({ blocks: [...blocks, { name: draftName.trim() || `Block ${blocks.length + 1}`, polygon: draft }] });
    setMode('idle');
    setDraft([]);
  };

  const sat = MAP_TILES.satellite;

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="overflow-hidden rounded-xl border">
        <div className="flex flex-wrap items-center gap-1.5 border-b bg-white p-2">
          <Button size="sm" variant={mode === 'boundary' ? 'default' : 'outline'} onClick={() => start('boundary')}>
            <Square className="mr-1 h-3.5 w-3.5" /> {boundary.length ? 'Redraw outline' : 'Draw outline'}
          </Button>
          <Button size="sm" variant={mode === 'block' ? 'default' : 'outline'} onClick={() => start('block')}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Block
          </Button>
          <Button size="sm" variant={mode === 'poi' ? 'default' : 'outline'} onClick={() => start('poi')}>
            <MapPin className="mr-1 h-3.5 w-3.5" /> Landmark
          </Button>
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            Plan
            <input type="range" min={0} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="w-24" aria-label="Plan transparency" />
          </div>
        </div>

        {(mode === 'boundary' || mode === 'block') && (
          <div className="flex flex-wrap items-center gap-2 border-b bg-orange-50 px-3 py-2 text-sm text-orange-900">
            <span>Click each corner on the map ({draft.length} so far).</span>
            {mode === 'block' && <Input value={draftName} onChange={(e) => setDraftName(e.target.value)} className="h-8 w-40 bg-white" placeholder="Block name" />}
            <div className="ml-auto flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => setDraft((d) => d.slice(0, -1))} disabled={!draft.length}>
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => start('idle')}>
                <X className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" onClick={finish} disabled={draft.length < 3}>
                <Check className="mr-1 h-3.5 w-3.5" /> Finish
              </Button>
            </div>
          </div>
        )}
        {mode === 'poi' && (
          <div className="flex flex-wrap items-center gap-2 border-b bg-orange-50 px-3 py-2 text-sm text-orange-900">
            {poiDraft ? (
              <>
                <select
                  value={poiDraft.kind}
                  onChange={(e) => setPoiDraft({ ...poiDraft, kind: e.target.value })}
                  className="h-8 rounded-md border bg-white px-2 text-sm"
                >
                  {Object.entries(POI_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{POI_ICONS[k]} {v}</option>
                  ))}
                </select>
                <Input value={poiDraft.name} onChange={(e) => setPoiDraft({ ...poiDraft, name: e.target.value })} className="h-8 w-48 bg-white" placeholder="Name, e.g. Main Gate" autoFocus />
                <Button
                  size="sm"
                  className="ml-auto"
                  disabled={!poiDraft.name.trim()}
                  onClick={() => {
                    onChange({ pois: [...pois, { ...poiDraft, name: poiDraft.name.trim() }] });
                    setPoiDraft(null);
                  }}
                >
                  Add
                </Button>
              </>
            ) : (
              <span>Click the landmark&apos;s spot on the map.</span>
            )}
            <Button size="sm" variant="ghost" onClick={() => start('idle')}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        <MapContainer center={[center.lat, center.lng]} zoom={zoom} maxZoom={21} className="h-[540px] w-full" attributionControl={false} doubleClickZoom={mode === 'idle'}>
          <TileLayer url={sat.url} subdomains={sat.subdomains} maxNativeZoom={sat.maxZoom} maxZoom={21} />
          {layers.map((l, i) =>
            l.tiles?.status === 'ready' && l.tiles.url && l.tiles.bounds ? (
              <TileLayer
                key={`t${i}${l.tiles.url}`}
                url={l.tiles.url}
                bounds={L.latLngBounds([l.tiles.bounds[0]!, l.tiles.bounds[1]!], [l.tiles.bounds[2]!, l.tiles.bounds[3]!])}
                minNativeZoom={l.tiles.minZoom}
                maxNativeZoom={l.tiles.maxZoom}
                maxZoom={22}
                opacity={opacity}
                zIndex={5}
              />
            ) : l.corners?.length === 4 ? (
              <Preview key={`p${i}`} url={l.previewUrl} corners={l.corners} opacity={opacity} />
            ) : null,
          )}
          <ViewGrabber onReady={setMap} />
          {mode !== 'idle' && <Clicks onClick={onClick} />}

          {boundary.length > 2 && mode !== 'boundary' && (
            <Polygon positions={boundary} pathOptions={{ color: '#0f172a', weight: 2.5, fill: false }} eventHandlers={{ click: () => mode === 'idle' && setSelected('boundary') }} />
          )}
          {blocks.map((b, i) => (
            <Polygon
              key={b.id ?? `n${i}`}
              positions={b.polygon}
              pathOptions={{ color: b.color || '#0e7c66', weight: selected === i ? 3 : 1.5, fillOpacity: selected === i ? 0.25 : 0.1 }}
              eventHandlers={{ click: () => mode === 'idle' && setSelected(i) }}
            >
              <Tooltip permanent direction="center" className="pd-block-label">{b.name}</Tooltip>
            </Polygon>
          ))}
          {pois.map((p, i) => (
            <Marker
              key={p.id ?? `poi${i}`}
              position={[p.lat, p.lng]}
              icon={poiIcon(p.kind)}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const ll = (e.target as L.Marker).getLatLng();
                  onChange({ pois: pois.map((q, j) => (j === i ? { ...q, lat: ll.lat, lng: ll.lng } : q)) });
                },
              }}
            >
              <Tooltip direction="top" offset={[0, -14]}>{p.name}</Tooltip>
            </Marker>
          ))}
          {poiDraft && <Marker position={[poiDraft.lat, poiDraft.lng]} icon={poiIcon(poiDraft.kind)} />}

          {draft.length > 0 && (
            <>
              <Polyline positions={draft.length > 2 ? [...draft, draft[0]!] : draft} pathOptions={{ color: '#f97316', weight: 2.5, dashArray: '6 4' }} />
              {draft.map((p, i) => <Marker key={`d${i}`} position={p} icon={vertexIcon} interactive={false} />)}
            </>
          )}

          {selected === 'boundary' && <Vertices polygon={boundary} onChange={(p) => onChange({ boundary: p })} />}
          {typeof selected === 'number' && blocks[selected] && (
            <Vertices
              polygon={blocks[selected]!.polygon}
              onChange={(p) => onChange({ blocks: blocks.map((b, j) => (j === selected ? { ...b, polygon: p } : b)) })}
            />
          )}
        </MapContainer>
        <div className="flex flex-wrap items-center gap-3 border-t bg-white px-3 py-2 text-xs text-muted-foreground">
          <span>Click a block to drag its corners; right-click a corner to remove it.</span>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto"
            onClick={() => {
              if (!map) return;
              const c = map.getCenter();
              onChange({ center: { lat: c.lat, lng: c.lng }, zoom: map.getZoom() });
            }}
          >
            <Crosshair className="mr-1 h-3.5 w-3.5" /> Open the page on this view
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <p className="text-sm font-semibold">Outline</p>
            {boundary.length > 2 && (
              <button type="button" className="text-xs font-semibold text-red-600" onClick={() => onChange({ boundary: [] })}>
                Remove
              </button>
            )}
          </div>
          <p className="px-3 py-2 text-sm text-muted-foreground">
            {boundary.length > 2 ? `${boundary.length} corners · about ${marlaLabel(polygonSqft(boundary))}` : 'Not drawn. The outline frames the society on every map.'}
          </p>
        </div>

        <div className="rounded-xl border">
          <p className="border-b px-3 py-2 text-sm font-semibold">Blocks ({blocks.length})</p>
          {blocks.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">None yet. Each block becomes a tappable area with its own listings.</p>
          ) : (
            <ul className="max-h-[260px] divide-y overflow-y-auto">
              {blocks.map((b, i) => (
                <li key={b.id ?? `n${i}`} className={cn('flex items-center gap-2 px-2 py-1.5', selected === i && 'bg-primary/5')}>
                  <input
                    type="color"
                    value={b.color || '#0e7c66'}
                    onChange={(e) => onChange({ blocks: blocks.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)) })}
                    className="h-6 w-6 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
                    aria-label="Block colour"
                  />
                  <Input
                    value={b.name}
                    onChange={(e) => onChange({ blocks: blocks.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })}
                    className="h-8"
                  />
                  <button
                    type="button"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded hover:bg-slate-100"
                    aria-label="Edit corners"
                    onClick={() => {
                      setSelected(i);
                      if (map && b.polygon.length) map.fitBounds(L.latLngBounds(b.polygon), { padding: [40, 40], maxZoom: 18 });
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded hover:bg-red-50"
                    aria-label="Delete block"
                    onClick={() => {
                      setSelected(null);
                      onChange({ blocks: blocks.filter((_, j) => j !== i) });
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-600" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border">
          <p className="border-b px-3 py-2 text-sm font-semibold">Landmarks ({pois.length})</p>
          {pois.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Gates, mosques, parks, commercial areas — shown as icons when zoomed in.</p>
          ) : (
            <ul className="max-h-[220px] divide-y overflow-y-auto text-sm">
              {pois.map((p, i) => (
                <li key={p.id ?? `poi${i}`} className="flex items-center gap-2 px-3 py-1.5">
                  <span>{POI_ICONS[p.kind]}</span>
                  <button type="button" className="min-w-0 flex-1 truncate text-left hover:text-primary" onClick={() => map?.setView([p.lat, p.lng], Math.max(map.getZoom(), 17))}>
                    {p.name}
                  </button>
                  <button type="button" className="grid h-7 w-7 place-items-center rounded hover:bg-red-50" aria-label="Delete landmark" onClick={() => onChange({ pois: pois.filter((_, j) => j !== i) })}>
                    <Trash2 className="h-3.5 w-3.5 text-red-600" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

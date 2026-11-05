'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Box, BrickWall, Home, Layers, LayoutGrid, PaintRoller } from 'lucide-react';
import { brickwork, concrete, coveredAreas, plaster, PLOTS, rateRange, rsShort, rupees, CONCRETE_MIXES, type ConcreteMix, type ConstructionData } from '@/lib/tools';
import { cn } from '@/lib/utils';
import MaterialList from './MaterialList';
import { Card, Disclosure, ResultHero, Row, Segment, SliderField, Stepper, StickyAnswer, Tiles, ToolLayout, useOnScreen } from './ui';

/*
 * Cement bags — starting from the job people are actually pricing: a roof
 * (lenter), plaster for a room, a floor, columns and beams, brickwork, or a
 * whole house. Counted the way Pakistani engineers do (see MASONRY_DEFAULTS),
 * priced on today's rates, with the list ready to WhatsApp to a supplier.
 */

type Job = 'roof' | 'plaster' | 'floor' | 'rcc' | 'mortar' | 'house';
const JOBS: { v: Job; label: string; sub: string; icon: typeof Home }[] = [
  { v: 'roof', label: 'Roof (lenter)', sub: 'Slab of a room or floor', icon: Layers },
  { v: 'plaster', label: 'Plaster', sub: 'Walls & ceiling', icon: PaintRoller },
  { v: 'floor', label: 'Floor base', sub: 'Under tiles', icon: LayoutGrid },
  { v: 'rcc', label: 'Columns & beams', sub: 'Footings too', icon: Box },
  { v: 'mortar', label: 'Brickwork', sub: 'Mortar for walls', icon: BrickWall },
  { v: 'house', label: 'Whole house', sub: 'By plot size', icon: Home },
];
type Shape = 'column' | 'beam' | 'footing';
const SHAPES: { v: Shape; label: string; sub: string; mix: ConcreteMix; dims: [number, number, number]; count: number }[] = [
  // Usual sizes: a 9" × 12" column 10 ft tall; a 9" × 15" beam; a 4' × 4' footing 1' deep.
  { v: 'column', label: 'Column', sub: '9" × 12" usual', mix: '1:1.5:3', dims: [0.75, 1, 10], count: 8 },
  { v: 'beam', label: 'Beam', sub: '9" × 15" usual', mix: '1:2:4', dims: [0.75, 1.25, 20], count: 4 },
  { v: 'footing', label: 'Footing', sub: 'Under a column', mix: '1:2:4', dims: [4, 4, 1], count: 8 },
];
const PLASTER_THICK = [
  { v: 0.375, label: '3/8"', sub: 'Ceiling' },
  { v: 0.5, label: '1/2"', sub: 'Inside wall' },
  { v: 0.75, label: '3/4"', sub: 'Outside wall' },
];
const PLASTER_MIX = [
  { v: 3, label: '1 : 3', sub: 'Ceiling' },
  { v: 4, label: '1 : 4', sub: 'Outside' },
  { v: 5, label: '1 : 5', sub: '' },
  { v: 6, label: '1 : 6', sub: 'Inside' },
];
const MORTAR_MIX = [
  { v: 4, label: '1 : 4', sub: 'For 4.5" walls' },
  { v: 5, label: '1 : 5', sub: '' },
  { v: 6, label: '1 : 6', sub: 'Usual for 9"' },
];
const THICK = [
  { v: 4.5, label: '4.5"', sub: 'Inside walls' },
  { v: 9, label: '9"', sub: 'Outer walls' },
  { v: 13.5, label: '13.5"', sub: '' },
];
const ROOMS: [number, number][] = [
  [10, 10],
  [12, 10],
  [14, 12],
  [16, 14],
  [20, 15],
];
/** A door is about 3' × 7', a window 4' × 4'. */
const DOOR = 21;
const WINDOW = 16;

const n0 = (n: number) => Math.round(n).toLocaleString('en-PK');
const n1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('en-PK');

function JobPicker({ value, onChange }: { value: Job; onChange: (j: Job) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {JOBS.map((j) => (
        <button
          key={j.v}
          type="button"
          onClick={() => onChange(j.v)}
          aria-pressed={value === j.v}
          className={cn(
            'flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition-colors',
            value === j.v ? 'border-primary bg-primary/5' : 'border-slate-200 bg-white hover:border-slate-300',
          )}
        >
          <j.icon className={cn('h-5 w-5', value === j.v ? 'text-primary' : 'text-slate-500')} />
          <span className="text-[15px] font-bold leading-tight text-slate-900">{j.label}</span>
          <span className="text-[12.5px] leading-tight text-slate-500">{j.sub}</span>
        </button>
      ))}
    </div>
  );
}

function Chips<T extends string>({ label, items, value, onChange }: { label?: string; items: { v: T; label: string }[]; value: T | null; onChange: (v: T) => void }) {
  return (
    <div>
      {label && <p className="mb-2 text-[14px] font-semibold text-slate-800">{label}</p>}
      <div className="flex flex-wrap gap-1.5">
        {items.map((i) => (
          <button
            key={i.v}
            type="button"
            onClick={() => onChange(i.v)}
            className={cn('h-9 rounded-full border px-3.5 text-[14px] font-semibold', value === i.v ? 'border-primary bg-primary text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400')}
          >
            {i.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (b: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-[14.5px] leading-snug text-slate-700">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]" />
      <span>{children}</span>
    </label>
  );
}

function MixPicker({ value, onChange }: { value: ConcreteMix; onChange: (m: ConcreteMix) => void }) {
  return (
    <div>
      <p className="mb-2 text-[14px] font-semibold text-slate-800">Mix (cement : sand : crush)</p>
      <div className="space-y-1.5">
        {CONCRETE_MIXES.map((x) => (
          <label key={x.v} className={cn('flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5', value === x.v ? 'border-primary bg-primary/5' : 'border-slate-300')}>
            <input type="radio" checked={value === x.v} onChange={() => onChange(x.v)} className="accent-[var(--primary)]" />
            <span className="text-[15px] font-bold tabular-nums text-slate-900">{x.label}</span>
            <span className="text-[13px] text-slate-600">{x.use}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default function CementCalculator({ data }: { data: ConstructionData }) {
  const cities = data.config.cities.map((c) => c.name);
  const m = data.config.masonry;
  const [city, setCity] = useState(cities[0] ?? 'Lahore');
  const [job, setJob] = useState<Job>('roof');
  // A room (roof, plaster, floor)
  const [roomL, setRoomL] = useState(14);
  const [roomW, setRoomW] = useState(12);
  const [roomH, setRoomH] = useState(10);
  const [rooms, setRooms] = useState(1);
  // Roof
  const [roofOf, setRoofOf] = useState<'room' | 'floor'>('room');
  const [plotKey, setPlotKey] = useState('5m');
  const [slabIn, setSlabIn] = useState(5);
  const [beams, setBeams] = useState(true);
  const [mix, setMix] = useState<ConcreteMix>('1:2:4');
  // Plaster
  const [plasterOf, setPlasterOf] = useState<'room' | 'area'>('room');
  const [ceiling, setCeiling] = useState(true);
  const [doors, setDoors] = useState(1);
  const [windows, setWindows] = useState(1);
  const [area, setArea] = useState(1000);
  const [pThick, setPThick] = useState(0.5);
  const [pMix, setPMix] = useState(6);
  // Floor
  const [floorIn, setFloorIn] = useState(3);
  const [floorMix, setFloorMix] = useState<ConcreteMix>('1:4:8');
  // Columns & beams
  const [shape, setShape] = useState<Shape>('column');
  const [d1, setD1] = useState(0.75);
  const [d2, setD2] = useState(1);
  const [d3, setD3] = useState(10);
  const [count, setCount] = useState(8);
  const [rccMix, setRccMix] = useState<ConcreteMix>('1:1.5:3');
  // Brickwork
  const [wLen, setWLen] = useState(100);
  const [wHeight, setWHeight] = useState(10);
  const [wThick, setWThick] = useState(9);
  const [mMix, setMMix] = useState(6);
  // House
  const [floors, setFloors] = useState(2);
  const [heroRef, heroOn] = useOnScreen<HTMLElement>();

  const plot = PLOTS.find((p) => p.key === plotKey) ?? PLOTS[1]!;
  const floorArea = coveredAreas(plot.marla * 225, { floors: 1, basement: false })[0]?.sqft ?? 0;
  const sh = SHAPES.find((s) => s.v === shape)!;
  const pickShape = (v: Shape) => {
    const s = SHAPES.find((x) => x.v === v)!;
    setShape(v);
    setD1(s.dims[0]);
    setD2(s.dims[1]);
    setD3(s.dims[2]);
    setCount(s.count);
    setRccMix(s.mix);
  };
  const roomName = rooms > 1 ? `${rooms} rooms of ${roomL}' × ${roomW}'` : `${roomL}' × ${roomW}' room`;

  type Result = { label: string; cementBags: number; sandCft: number; crushCft: number; waterLitres: number; sand: string; steps: { label: string; note?: string; value: string }[] };
  const r: Result = useMemo(() => {
    if (job === 'roof') {
      const slabArea = roofOf === 'room' ? roomL * roomW * rooms : floorArea;
      const slab = slabArea * (slabIn / 12);
      // Beams under a slab add roughly an eighth to its concrete.
      const vol = slab * (beams ? 1.12 : 1);
      const c = concrete(vol, mix, m);
      return {
        label: roofOf === 'room' ? `Roof of ${roomName}` : `Roof of a ${plot.label} floor`,
        ...c,
        sand: 'Coarse sand — Chenab / Lawrencepur',
        steps: [
          { label: 'Roof area', note: roofOf === 'floor' ? `${plot.label}, covered part of the plot` : undefined, value: `${n0(slabArea)} sq ft` },
          { label: 'Slab concrete', note: `× ${slabIn}" thick${beams ? ' + 12% for beams' : ''}`, value: `${n1(vol)} cft` },
          { label: 'Dry materials', note: `× ${m.concreteDryFactor} — they shrink when mixed`, value: `${n1(c.dryCft)} cft` },
        ],
      };
    }
    if (job === 'plaster') {
      let wall = area;
      let ceil = 0;
      if (plasterOf === 'room') {
        const n = Math.max(1, rooms);
        wall = Math.max(0, 2 * (roomL + roomW) * roomH - (doors * DOOR + windows * WINDOW)) * n;
        ceil = ceiling ? roomL * roomW * n : 0;
      }
      const total = wall + ceil;
      const p = plaster(total, pThick, pMix, m);
      return {
        label: plasterOf === 'room' ? `Plaster, ${roomName}` : `Plaster, ${n0(area)} sq ft`,
        ...p,
        waterLitres: 0,
        sand: 'Chenab sand, sieved',
        steps: [
          ...(plasterOf === 'room'
            ? [
                { label: 'Walls', note: 'All four walls, doors and windows taken out', value: `${n0(wall)} sq ft` },
                ...(ceil ? [{ label: 'Ceiling', value: `${n0(ceil)} sq ft` }] : []),
              ]
            : [{ label: 'Area', value: `${n0(total)} sq ft` }]),
          { label: 'Plaster (finished)', note: `× ${pThick}" thick`, value: `${n1(p.wetCft)} cft` },
          { label: 'Dry materials', note: `× ${m.plasterDryFactor} — joints, uneven walls, spill`, value: `${n1(p.dryCft)} cft` },
        ],
      };
    }
    if (job === 'floor') {
      const a = roomL * roomW * rooms;
      const vol = a * (floorIn / 12);
      const c = concrete(vol, floorMix, m);
      return {
        label: `Floor base, ${roomName}`,
        ...c,
        sand: 'Coarse sand — Chenab',
        steps: [
          { label: 'Floor area', value: `${n0(a)} sq ft` },
          { label: 'Concrete (PCC)', note: `× ${floorIn}" thick`, value: `${n1(vol)} cft` },
          { label: 'Dry materials', note: `× ${m.concreteDryFactor}`, value: `${n1(c.dryCft)} cft` },
        ],
      };
    }
    if (job === 'rcc') {
      const each = d1 * d2 * d3;
      const c = concrete(each * count, rccMix, m);
      return {
        label: `${count} ${sh.label.toLowerCase()}${count > 1 ? 's' : ''}`,
        ...c,
        sand: 'Coarse sand — Lawrencepur / Chenab',
        steps: [
          { label: `Each ${sh.label.toLowerCase()}`, note: `${d1}' × ${d2}' × ${d3}'`, value: `${n1(each)} cft` },
          { label: 'Concrete', note: `× ${count}`, value: `${n1(c.volumeCft)} cft` },
          { label: 'Dry materials', note: `× ${m.concreteDryFactor}`, value: `${n1(c.dryCft)} cft` },
        ],
      };
    }
    if (job === 'mortar') {
      const b = brickwork({ lengthFt: wLen, heightFt: wHeight, thicknessIn: wThick, openingsSqft: 0, mortar: mMix }, m);
      return {
        label: `Mortar, ${n0(wLen)} ft of ${wThick}" wall`,
        ...b,
        waterLitres: 0,
        sand: 'Clean sand — Chenab or Ravi',
        steps: [
          { label: 'Brickwork', note: `${wLen}' × ${wHeight}' × ${wThick}"`, value: `${n1(b.volumeCft)} cft` },
          { label: 'Dry mortar', note: `${m.dryMortarPer100Cft} cft per 100 cft of brickwork`, value: `${n1(b.dryMortarCft)} cft` },
        ],
      };
    }
    // Whole house: per sq ft of covered area, as the construction calculator counts it.
    const covered = coveredAreas(plot.marla * 225, { floors, basement: false }).reduce((s, f) => s + f.sqft, 0);
    const q = data.config.qty;
    return {
      label: `${plot.label} house, ${floors === 1 ? 'single' : floors === 2 ? 'double' : 'triple'} storey`,
      cementBags: covered * q.cement,
      sandCft: covered * q.sand,
      crushCft: covered * q.crush,
      waterLitres: 0,
      sand: 'Chenab sand (coarse for concrete)',
      steps: [
        { label: 'Covered area', note: `${plot.label}, ${floors} storey${floors > 1 ? 's' : ''}`, value: `${n0(covered)} sq ft` },
        { label: 'Cement', note: `${q.cement} bags per sq ft — foundations to plaster`, value: `${n0(covered * q.cement)} bags` },
        { label: 'Sand', note: `${q.sand} cft per sq ft`, value: `${n0(covered * q.sand)} cft` },
        { label: 'Crush', note: `${q.crush} cft per sq ft`, value: `${n0(covered * q.crush)} cft` },
      ],
    };
  }, [job, roofOf, roomL, roomW, roomH, rooms, floorArea, slabIn, beams, mix, m, roomName, plot, area, plasterOf, doors, windows, ceiling, pThick, pMix, floorIn, floorMix, d1, d2, d3, count, rccMix, sh, wLen, wHeight, wThick, mMix, floors, data]);

  const bags = Math.ceil(r.cementBags);
  const cement = rateRange(data, 'cement', city).mid;
  const sand = rateRange(data, 'sand', city).mid;
  const crush = rateRange(data, 'crush', city).mid;
  const items = [
    { name: 'Cement (50 kg bags)', qty: `${n0(bags)} bags`, note: `${rupees(cement)} a bag`, cost: bags * cement },
    { name: 'Sand', qty: `${n0(r.sandCft)} cft`, note: r.sand, cost: r.sandCft * sand },
    ...(r.crushCft > 0 ? [{ name: 'Crush (bajri)', qty: `${n0(r.crushCft)} cft`, note: 'Margalla / Sargodha, ½"–¾"', cost: r.crushCft * crush }] : []),
  ];
  const total = items.reduce((s, i) => s + i.cost, 0);
  const roomPicker = (
    <>
      <Chips items={ROOMS.map(([l, w]) => ({ v: `${l}x${w}`, label: `${l}' × ${w}'` }))} value={`${roomL}x${roomW}`} onChange={(v) => (setRoomL(Number(v.split('x')[0])), setRoomW(Number(v.split('x')[1])))} />
      <SliderField label="Length" value={roomL} onChange={setRoomL} min={4} max={60} step={0.5} suffix="ft" />
      <SliderField label="Width" value={roomW} onChange={setRoomW} min={4} max={60} step={0.5} suffix="ft" />
      <Stepper label="How many rooms" sub="Same size" value={rooms} onChange={setRooms} min={1} max={20} />
    </>
  );
  const plotPicker = <Chips label="Plot size" items={PLOTS.map((p) => ({ v: p.key, label: p.label }))} value={plotKey} onChange={setPlotKey} />;

  return (
    <>
      <StickyAnswer show={!heroOn} label="Cement bags" value={n0(bags)} onTap={() => (heroRef.current as HTMLElement | null)?.scrollIntoView({ behavior: 'smooth', block: 'center' })} />
      <ToolLayout
        inputs={
          <>
            <Card>
              <p className="mb-2.5 text-[14px] font-semibold text-slate-800">What are you making?</p>
              <JobPicker value={job} onChange={setJob} />
            </Card>

            {job === 'roof' && (
              <Card title="The roof (lenter)">
                <div className="space-y-5">
                  <Segment
                    label="Roof over"
                    value={roofOf}
                    onChange={setRoofOf}
                    options={[
                      { v: 'room' as const, label: 'A room', sub: 'Or a few' },
                      { v: 'floor' as const, label: 'A whole floor', sub: 'By plot size' },
                    ]}
                  />
                  {roofOf === 'room' ? roomPicker : plotPicker}
                  <Segment
                    label="Slab thickness"
                    value={slabIn}
                    onChange={setSlabIn}
                    options={[
                      { v: 4, label: '4"', sub: 'Small span' },
                      { v: 5, label: '5"', sub: 'Usual' },
                      { v: 6, label: '6"', sub: 'Big rooms' },
                    ]}
                  />
                  <Check checked={beams} onChange={setBeams}>
                    Beams under the slab (adds about 12%)
                  </Check>
                  <MixPicker value={mix} onChange={setMix} />
                </div>
              </Card>
            )}

            {job === 'plaster' && (
              <Card title="Plaster">
                <div className="space-y-5">
                  <Segment
                    label="Plaster for"
                    value={plasterOf}
                    onChange={setPlasterOf}
                    options={[
                      { v: 'room' as const, label: 'A room', sub: 'Inside walls' },
                      { v: 'area' as const, label: 'An area', sub: 'Any sq ft' },
                    ]}
                  />
                  {plasterOf === 'room' ? (
                    <>
                      {roomPicker}
                      <SliderField label="Height" value={roomH} onChange={setRoomH} min={6} max={20} step={0.5} suffix="ft" hint="Usual: 10–11 ft" />
                      <div className="space-y-2.5">
                        <Stepper label="Doors per room" sub="About 3' × 7'" value={doors} onChange={setDoors} max={6} />
                        <Stepper label="Windows per room" sub="About 4' × 4'" value={windows} onChange={setWindows} max={8} />
                      </div>
                      <Check checked={ceiling} onChange={setCeiling}>
                        Plaster the ceiling too
                      </Check>
                    </>
                  ) : (
                    <SliderField label="Area to plaster" value={area} onChange={setArea} min={10} max={20000} step={10} suffix="sq ft" hint="Both sides of a wall count twice" />
                  )}
                  <Segment label="Thickness" value={pThick} onChange={setPThick} options={PLASTER_THICK} />
                  <Segment label="Mix (cement : sand)" value={pMix} onChange={setPMix} options={PLASTER_MIX} />
                </div>
              </Card>
            )}

            {job === 'floor' && (
              <Card title="Floor base (PCC under tiles)">
                <div className="space-y-5">
                  {roomPicker}
                  <Segment
                    label="Thickness"
                    value={floorIn}
                    onChange={setFloorIn}
                    options={[
                      { v: 2, label: '2"', sub: '' },
                      { v: 3, label: '3"', sub: 'Usual' },
                      { v: 4, label: '4"', sub: 'Porch / car' },
                    ]}
                  />
                  <MixPicker value={floorMix} onChange={setFloorMix} />
                </div>
              </Card>
            )}

            {job === 'rcc' && (
              <Card title="Columns, beams & footings">
                <div className="space-y-5">
                  <Segment value={shape} onChange={pickShape} options={SHAPES.map((s) => ({ v: s.v, label: s.label, sub: s.sub }))} />
                  <div className="grid grid-cols-2 gap-3">
                    <SliderField label={shape === 'footing' ? 'Length' : 'Width'} value={d1} onChange={setD1} min={0.5} max={10} step={0.25} suffix="ft" />
                    <SliderField label={shape === 'footing' ? 'Width' : 'Depth'} value={d2} onChange={setD2} min={0.5} max={10} step={0.25} suffix="ft" />
                  </div>
                  <SliderField
                    label={shape === 'column' ? 'Height' : shape === 'beam' ? 'Length' : 'Depth'}
                    value={d3}
                    onChange={setD3}
                    min={0.5}
                    max={shape === 'beam' ? 100 : 30}
                    step={0.5}
                    suffix="ft"
                    hint={shape === 'column' ? '9" = 0.75 ft, 12" = 1 ft, 15" = 1.25 ft' : undefined}
                  />
                  <Stepper label={`How many ${sh.label.toLowerCase()}s`} value={count} onChange={setCount} min={1} max={200} />
                  <MixPicker value={rccMix} onChange={setRccMix} />
                </div>
              </Card>
            )}

            {job === 'mortar' && (
              <Card title="Brick walls (mortar)">
                <div className="space-y-5">
                  <SliderField label="Total length of walls" value={wLen} onChange={setWLen} min={1} max={1000} step={1} suffix="ft" />
                  <SliderField label="Height" value={wHeight} onChange={setWHeight} min={1} max={30} step={0.5} suffix="ft" />
                  <Segment label="Thickness" value={wThick} onChange={setWThick} options={THICK} />
                  <Segment label="Mix (cement : sand)" value={mMix} onChange={setMMix} options={MORTAR_MIX} />
                  <p className="text-[13.5px] text-slate-600">
                    Need the bricks too — for a room or boundary wall? Use the <Link href="/tools/bricks-calculator" className="font-semibold text-primary hover:underline">bricks calculator</Link>.
                  </p>
                </div>
              </Card>
            )}

            {job === 'house' && (
              <Card title="The house">
                <div className="space-y-5">
                  {plotPicker}
                  <Segment
                    label="Storeys"
                    value={floors}
                    onChange={setFloors}
                    options={[
                      { v: 1, label: 'Single', sub: '' },
                      { v: 2, label: 'Double', sub: 'Most common' },
                      { v: 3, label: 'Triple', sub: '' },
                    ]}
                  />
                  <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-[13.5px] text-slate-600">
                    Everything from foundations to plaster: about {data.config.qty.cement} bags per sq ft of covered area. The{' '}
                    <Link href="/tools/construction-cost-calculator" className="font-semibold text-primary hover:underline">construction cost calculator</Link> adds steel, labour and finishing.
                  </p>
                </div>
              </Card>
            )}

            <Disclosure title="City" sub={`Rates for ${city}`}>
              <select value={city} onChange={(e) => setCity(e.target.value)} className="mt-1 h-11 w-full rounded-lg border border-slate-400 bg-white px-3 text-[16px] text-slate-900 outline-none focus:border-primary">
                {cities.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Disclosure>
          </>
        }
        summary={
          <>
            <ResultHero
              heroRef={heroRef}
              label={`Cement for: ${r.label}`}
              value={`${n0(bags)} bags`}
              sub={[`${n0(r.sandCft)} cft sand`, r.crushCft ? `${n0(r.crushCft)} cft crush` : '', r.waterLitres ? `${n0(r.waterLitres)} litres water` : ''].filter(Boolean).join(' · ')}
            >
              <Tiles
                onBrand
                items={[
                  { label: 'Cement', value: rsShort(items[0]!.cost) },
                  { label: r.crushCft ? 'Sand + crush' : 'Sand', value: rsShort(items.slice(1).reduce((s, i) => s + i.cost, 0)) },
                  { label: 'Total', value: rsShort(total) },
                ]}
              />
            </ResultHero>
            <MaterialList
              title={r.label}
              items={items}
              city={city}
              footnote={`${job === 'roof' || job === 'rcc' || job === 'house' ? 'Steel, ' : ''}Labour, water and transport are extra. Cement includes ${m.cementWastagePct}% for spill.`}
            />
          </>
        }
        details={
          <>
            <Card title="How it's worked out">
              <div className="divide-y divide-slate-100">
                {r.steps.map((s) => (
                  <Row key={s.label} label={s.label} note={s.note} value={s.value} />
                ))}
                <Row label="Cement" note={job === 'house' ? undefined : `${m.cementBagCft} cft a bag + ${m.cementWastagePct}% wastage`} value={`${n1(r.cementBags)} → ${n0(bags)} bags`} strong />
                <Row label="Sand" value={`${n1(r.sandCft)} cft`} />
                {r.crushCft > 0 && <Row label="Crush (bajri)" value={`${n1(r.crushCft)} cft`} />}
                {r.waterLitres > 0 && <Row label="Water" note={`${m.waterCementRatio} litre per kg of cement`} value={`${n0(r.waterLitres)} litres`} />}
              </div>
            </Card>
            <Card title="Good to know">
              <ul className="list-disc space-y-1.5 pl-5 text-[14px] leading-relaxed text-slate-700">
                {(job === 'roof' || job === 'rcc' || job === 'floor') && <li>Keep concrete wet (curing) for at least 7 days — 14 for a roof. Don&apos;t remove roof shuttering before about 14 days.</li>}
                {job === 'roof' && <li>Pour a roof in one go: order all the cement, sand and crush before the day, and keep a few spare bags.</li>}
                {job === 'plaster' && <li>Wet the wall before plastering and cure the plaster for about 7 days so it doesn&apos;t crack.</li>}
                <li>Use cement within about 3 months of the date printed on the bag, and store it off the floor, away from damp.</li>
                <li>
                  Today&apos;s rates: <Link href="/today-cement-rate-in-pakistan" className="font-semibold text-primary hover:underline">cement</Link>,{' '}
                  <Link href="/today-sand-rate-in-pakistan" className="font-semibold text-primary hover:underline">sand</Link>,{' '}
                  <Link href="/today-bajri-rate-in-pakistan" className="font-semibold text-primary hover:underline">crush</Link>.
                </li>
              </ul>
            </Card>
          </>
        }
      />
    </>
  );
}

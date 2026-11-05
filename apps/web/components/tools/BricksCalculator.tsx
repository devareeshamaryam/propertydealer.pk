'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { BrickWall, DoorOpen, Fence, Home } from 'lucide-react';
import { boundaryLength, brickwork, coveredAreas, PLOTS, rateRange, roomsWallLength, rsShort, rupees, type ConstructionData } from '@/lib/tools';
import { cn } from '@/lib/utils';
import MaterialList from './MaterialList';
import { Card, Disclosure, ResultHero, Row, Segment, SliderField, Stepper, StickyAnswer, Tiles, ToolLayout, useOnScreen } from './ui';

/*
 * How many bricks — starting from what people actually build: a room, a
 * boundary wall round their plot, a whole house, or just a wall. Counted the
 * way Pakistani engineers do (1,350 bricks per 100 cft with joints — see
 * MASONRY_DEFAULTS), priced as first- or second-class bricks on today's rates,
 * with the list ready to WhatsApp to a supplier.
 */

type Job = 'room' | 'boundary' | 'house' | 'wall';
const JOBS: { v: Job; label: string; sub: string; icon: typeof Home }[] = [
  { v: 'room', label: 'Room', sub: 'One or more rooms', icon: DoorOpen },
  { v: 'boundary', label: 'Boundary wall', sub: 'Round your plot', icon: Fence },
  { v: 'house', label: 'Whole house', sub: 'By plot size', icon: Home },
  { v: 'wall', label: 'One wall', sub: 'Any length', icon: BrickWall },
];
const THICK = [
  { v: 4.5, label: '4.5"', sub: 'Inside walls' },
  { v: 9, label: '9"', sub: 'Outer walls' },
  { v: 13.5, label: '13.5"', sub: 'Heavy / tall' },
];
const MORTAR = [
  { v: 4, label: '1 : 4', sub: 'For 4.5" walls' },
  { v: 5, label: '1 : 5', sub: '' },
  { v: 6, label: '1 : 6', sub: 'Usual for 9"' },
];
type Quality = 'awwal' | 'doum';
/** A door is about 3' × 7', a window 4' × 4'. */
const DOOR = 21;
const WINDOW = 16;
/** Foundation of a boundary wall: about 2' deep, 13.5" wide, below ground. */
const FOUND_DEPTH = 2;
const FOUND_THICK = 13.5;

const n0 = (n: number) => Math.round(n).toLocaleString('en-PK');
const n1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('en-PK');

function JobPicker({ value, onChange }: { value: Job; onChange: (j: Job) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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

function PlotChips({ value, onChange }: { value: string; onChange: (k: string) => void }) {
  return (
    <div>
      <p className="mb-2 text-[14px] font-semibold text-slate-800">Plot size</p>
      <div className="flex flex-wrap gap-1.5">
        {PLOTS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onChange(p.key)}
            className={cn('h-9 rounded-full border px-3.5 text-[14px] font-semibold', value === p.key ? 'border-primary bg-primary text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400')}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function BricksCalculator({ data }: { data: ConstructionData }) {
  const cities = data.config.cities.map((c) => c.name);
  const m = data.config.masonry;
  const [city, setCity] = useState(cities[0] ?? 'Lahore');
  const [job, setJob] = useState<Job>('room');
  const [quality, setQuality] = useState<Quality>('awwal');
  const [mortar, setMortar] = useState(6);
  // Room
  const [roomL, setRoomL] = useState(14);
  const [roomW, setRoomW] = useState(12);
  const [rooms, setRooms] = useState(1);
  const [shared, setShared] = useState(true);
  // Boundary
  const [plotKey, setPlotKey] = useState('5m');
  const [front, setFront] = useState(25);
  const [depth, setDepth] = useState(45);
  const [sides, setSides] = useState<4 | 3 | 1>(4);
  const [gate, setGate] = useState(10);
  const [withFoundation, setWithFoundation] = useState(true);
  // House
  const [floors, setFloors] = useState(2);
  // Common
  const [height, setHeight] = useState(10);
  const [thickness, setThickness] = useState(9);
  const [doors, setDoors] = useState(1);
  const [windows, setWindows] = useState(1);
  const [length, setLength] = useState(30);
  const [heroRef, heroOn] = useOnScreen<HTMLElement>();

  const pickJob = (j: Job) => {
    setJob(j);
    if (j === 'boundary') {
      setHeight(7);
      setThickness(9);
    } else if (j === 'room' || j === 'wall') {
      setHeight(10);
    }
  };
  const pickPlot = (k: string) => {
    const p = PLOTS.find((x) => x.key === k)!;
    setPlotKey(k);
    setFront(p.front);
    setDepth(p.depth);
  };

  const plot = PLOTS.find((p) => p.key === plotKey) ?? PLOTS[1]!;

  const r = useMemo(() => {
    if (job === 'house') {
      // A whole house: bricks per sq ft of covered area, as the construction calculator uses.
      const covered = coveredAreas(plot.marla * 225, { floors, basement: false }).reduce((s, f) => s + f.sqft, 0);
      const bricks = Math.ceil(covered * data.config.qty.bricks);
      // Mortar in proportion to the bricks (same per-cft standard).
      const volumeCft = (bricks / (1 + m.brickWastagePct / 100) / m.bricksPer100Cft) * 100;
      const b = brickwork({ lengthFt: volumeCft, heightFt: 1, thicknessIn: 12, openingsSqft: 0, mortar }, m);
      return { ...b, bricks, faceSqft: 0, wallLength: 0, covered, label: `${plot.label} house, ${floors === 1 ? 'single' : floors === 2 ? 'double' : 'triple'} storey` };
    }
    let len = length;
    let openings = (doors * DOOR + windows * WINDOW) * (job === 'room' ? rooms : 1);
    let label = `${n0(length)} ft wall`;
    if (job === 'room') {
      len = roomsWallLength(roomL, roomW, rooms, shared && rooms > 1);
      label = rooms > 1 ? `${rooms} rooms of ${roomL}' × ${roomW}'` : `${roomL}' × ${roomW}' room`;
    } else if (job === 'boundary') {
      len = boundaryLength(front, depth, sides, gate);
      openings = 0;
      const preset = PLOTS.find((p) => p.front === front && p.depth === depth);
      label = `Boundary wall, ${preset ? preset.label : `${front}' × ${depth}'`} plot`;
    }
    const wall = brickwork({ lengthFt: len, heightFt: height, thicknessIn: thickness, openingsSqft: openings, mortar }, m);
    if (job === 'boundary' && withFoundation) {
      const f = brickwork({ lengthFt: len, heightFt: FOUND_DEPTH, thicknessIn: FOUND_THICK, openingsSqft: 0, mortar }, m);
      return {
        ...wall,
        bricks: wall.bricks + f.bricks,
        bricksNet: wall.bricksNet + f.bricksNet,
        volumeCft: wall.volumeCft + f.volumeCft,
        dryMortarCft: wall.dryMortarCft + f.dryMortarCft,
        cementBags: wall.cementBags + f.cementBags,
        cementKg: wall.cementKg + f.cementKg,
        sandCft: wall.sandCft + f.sandCft,
        foundationBricks: f.bricks,
        wallLength: len,
        covered: 0,
        label,
      };
    }
    return { ...wall, wallLength: len, covered: 0, label };
  }, [job, plot, floors, data, m, mortar, length, doors, windows, rooms, roomL, roomW, shared, front, depth, sides, gate, height, thickness, withFoundation]);

  const brick = rateRange(data, 'bricks', city);
  const brickRate = quality === 'awwal' ? brick.high : brick.low;
  const cement = rateRange(data, 'cement', city).mid;
  const sand = rateRange(data, 'sand', city).mid;
  const bags = Math.ceil(r.cementBags);
  const items = [
    { name: `Bricks (${quality === 'awwal' ? 'first class / awwal' : 'second class / doum'})`, qty: n0(r.bricks), note: `${rupees(brickRate * 1000)} per 1,000`, cost: r.bricks * brickRate },
    { name: 'Cement (50 kg)', qty: `${bags} bags`, note: `for 1:${mortar} mortar`, cost: bags * cement },
    { name: 'Sand', qty: `${n0(r.sandCft)} cft`, note: 'clean sand for mortar', cost: r.sandCft * sand },
  ];
  const total = items.reduce((s, i) => s + i.cost, 0);

  return (
    <>
      <StickyAnswer show={!heroOn} label="Bricks needed" value={n0(r.bricks)} onTap={() => (heroRef.current as HTMLElement | null)?.scrollIntoView({ behavior: 'smooth', block: 'center' })} />
      <ToolLayout
        inputs={
          <>
            <Card>
              <p className="mb-2.5 text-[14px] font-semibold text-slate-800">What are you building?</p>
              <JobPicker value={job} onChange={pickJob} />
            </Card>

            {job === 'room' && (
              <Card title="The room">
                <div className="space-y-5">
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      [10, 10],
                      [12, 10],
                      [14, 12],
                      [16, 14],
                      [20, 15],
                    ].map(([l, w]) => (
                      <button
                        key={`${l}x${w}`}
                        type="button"
                        onClick={() => (setRoomL(l!), setRoomW(w!))}
                        className={cn('h-9 rounded-full border px-3.5 text-[14px] font-semibold', roomL === l && roomW === w ? 'border-primary bg-primary text-white' : 'border-slate-300 bg-white text-slate-700')}
                      >
                        {l}&apos; × {w}&apos;
                      </button>
                    ))}
                  </div>
                  <SliderField label="Length" value={roomL} onChange={setRoomL} min={4} max={60} step={0.5} suffix="ft" />
                  <SliderField label="Width" value={roomW} onChange={setRoomW} min={4} max={60} step={0.5} suffix="ft" />
                  <SliderField label="Height" value={height} onChange={setHeight} min={6} max={20} step={0.5} suffix="ft" hint="Usual: 10–11 ft" />
                  <Stepper label="How many rooms" sub="Same size" value={rooms} onChange={setRooms} min={1} max={20} />
                  {rooms > 1 && (
                    <label className="flex cursor-pointer items-center gap-2.5 text-[14.5px] text-slate-700">
                      <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
                      Rooms side by side (they share a wall)
                    </label>
                  )}
                  <div className="space-y-2.5">
                    <Stepper label="Doors per room" sub="About 3' × 7'" value={doors} onChange={setDoors} max={6} />
                    <Stepper label="Windows per room" sub="About 4' × 4'" value={windows} onChange={setWindows} max={8} />
                  </div>
                  <Segment label="Wall thickness" value={thickness} onChange={setThickness} options={THICK} />
                </div>
              </Card>
            )}

            {job === 'boundary' && (
              <Card title="The boundary wall">
                <div className="space-y-5">
                  <PlotChips value={plotKey} onChange={pickPlot} />
                  <div className="grid grid-cols-2 gap-3">
                    <SliderField label="Front" value={front} onChange={setFront} min={10} max={200} step={1} suffix="ft" />
                    <SliderField label="Depth" value={depth} onChange={setDepth} min={10} max={300} step={1} suffix="ft" />
                  </div>
                  <Segment
                    label="Which sides?"
                    value={sides}
                    onChange={setSides}
                    options={[
                      { v: 4 as const, label: 'All 4', sub: 'Open plot' },
                      { v: 3 as const, label: '3 sides', sub: 'Back is shared' },
                      { v: 1 as const, label: 'Front only', sub: 'Neighbours built' },
                    ]}
                  />
                  <SliderField label="Height above ground" value={height} onChange={setHeight} min={3} max={14} step={0.5} suffix="ft" hint="Usual: 7 ft" />
                  <SliderField label="Gate opening" value={gate} onChange={setGate} min={0} max={30} step={1} suffix="ft" hint="Left without bricks" />
                  <Segment label="Wall thickness" value={thickness} onChange={setThickness} options={THICK} />
                  <label className="flex cursor-pointer items-center gap-2.5 text-[14.5px] text-slate-700">
                    <input type="checkbox" checked={withFoundation} onChange={(e) => setWithFoundation(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
                    Include the foundation below ground (2&apos; deep, 13.5&quot; wide)
                  </label>
                </div>
              </Card>
            )}

            {job === 'house' && (
              <Card title="The house">
                <div className="space-y-5">
                  <PlotChips value={plotKey} onChange={pickPlot} />
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
                    A whole-house figure: about {data.config.qty.bricks} bricks per sq ft of covered area — walls, boundary and foundations. For an exact count, add the walls room by room.
                  </p>
                </div>
              </Card>
            )}

            {job === 'wall' && (
              <Card title="The wall">
                <div className="space-y-5">
                  <SliderField label="Length" value={length} onChange={setLength} min={1} max={1000} step={1} suffix="ft" hint="Several walls? Add their lengths" />
                  <SliderField label="Height" value={height} onChange={setHeight} min={1} max={30} step={0.5} suffix="ft" />
                  <Segment label="Thickness" value={thickness} onChange={setThickness} options={THICK} />
                  <div className="space-y-2.5">
                    <Stepper label="Doors" sub="About 3' × 7'" value={doors} onChange={setDoors} max={60} />
                    <Stepper label="Windows" sub="About 4' × 4'" value={windows} onChange={setWindows} max={80} />
                  </div>
                </div>
              </Card>
            )}

            <Disclosure title="Brick quality, mortar & city" sub={`${quality === 'awwal' ? 'First class' : 'Second class'} · 1:${mortar} · ${city}`}>
              <div className="space-y-5 pt-1">
                <Segment
                  label="Brick quality"
                  value={quality}
                  onChange={setQuality}
                  options={[
                    { v: 'awwal' as const, label: 'First class (awwal)', sub: `${rupees(brick.high)} each` },
                    { v: 'doum' as const, label: 'Second class (doum)', sub: `${rupees(brick.low)} each` },
                  ]}
                />
                <Segment label="Mortar (cement : sand)" value={mortar} onChange={setMortar} options={MORTAR} />
                <label className="block">
                  <span className="mb-2 block text-[14px] font-semibold text-slate-800">Rates for</span>
                  <select value={city} onChange={(e) => setCity(e.target.value)} className="h-11 w-full rounded-lg border border-slate-400 bg-white px-3 text-[16px] text-slate-900 outline-none focus:border-primary">
                    {cities.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
              </div>
            </Disclosure>
          </>
        }
        summary={
          <>
            <ResultHero heroRef={heroRef} label={`Bricks for: ${r.label}`} value={n0(r.bricks)} sub={`${bags} bags of cement · ${n0(r.sandCft)} cft sand · ${m.brickWastagePct}% extra for breakage included`}>
              <Tiles
                onBrand
                items={[
                  { label: 'Bricks', value: rsShort(items[0]!.cost) },
                  { label: 'Cement', value: rsShort(items[1]!.cost) },
                  { label: 'Total', value: rsShort(total) },
                ]}
              />
            </ResultHero>
            <MaterialList
              title={r.label}
              items={items}
              city={city}
              footnote={`Bricks are usually sold per 1,000 — order ${n0(Math.ceil(r.bricks / 500) * 500)}. Labour, water and transport are extra.`}
            />
          </>
        }
        details={
          <>
            <Card title="How it's worked out">
              <div className="divide-y divide-slate-100">
                {job === 'house' ? (
                  <>
                    <Row label="Covered area" note={`${plot.label}, ${floors} storey${floors > 1 ? 's' : ''}`} value={`${n0(r.covered)} sq ft`} />
                    <Row label="Bricks" note={`${data.config.qty.bricks} per sq ft of covered area`} value={n0(r.bricks)} strong />
                  </>
                ) : (
                  <>
                    <Row label="Wall length" note={job === 'room' && rooms > 1 && shared ? 'Shared walls counted once' : undefined} value={`${n1(r.wallLength)} ft`} />
                    <Row label="Wall area" note={job === 'boundary' ? `× ${height} ft high, above ground` : 'Doors and windows taken out'} value={`${n0(r.faceSqft)} sq ft`} />
                    <Row label="Brickwork" note={`× ${thickness}" thick${'foundationBricks' in r && r.foundationBricks ? ' + foundation' : ''}`} value={`${n1(r.volumeCft)} cft`} />
                    <Row label="Bricks" note={`${n0(m.bricksPer100Cft)} per 100 cft + ${m.brickWastagePct}%`} value={n0(r.bricks)} strong />
                    {'foundationBricks' in r && r.foundationBricks ? <Row label="…of which foundation" value={n0(r.foundationBricks as number)} /> : null}
                    {r.faceSqft > 0 && !('foundationBricks' in r && r.foundationBricks) && <Row label="Per sq ft of wall" value={`${(r.bricksNet / r.faceSqft).toFixed(1)} bricks`} />}
                  </>
                )}
                <Row label="Dry mortar" note={`${m.dryMortarPer100Cft} cft per 100 cft of brickwork`} value={`${n1(r.dryMortarCft)} cft`} />
                <Row label="Cement" note={`1 part in ${1 + mortar} · ${m.cementBagCft} cft a bag`} value={`${n1(r.cementBags)} bags`} />
                <Row label="Sand" note={`${mortar} parts in ${1 + mortar}`} value={`${n0(r.sandCft)} cft`} />
              </div>
            </Card>
            <Card title="Good to know">
              <ul className="list-disc space-y-1.5 pl-5 text-[14px] leading-relaxed text-slate-700">
                <li>Soak bricks in water before laying — dry bricks suck the water out of the mortar and the joints stay weak.</li>
                <li>First-class (awwal) bricks are evenly red, ring when struck and have sharp edges; use them for outer walls left exposed.</li>
                <li>9&quot; outer walls usually take 1:6 mortar; thin 4.5&quot; walls 1:4.</li>
                <li>
                  Today&apos;s rates: <Link href="/today-bricks-rate-in-pakistan" className="font-semibold text-primary hover:underline">bricks</Link>,{' '}
                  <Link href="/today-cement-rate-in-pakistan" className="font-semibold text-primary hover:underline">cement</Link>,{' '}
                  <Link href="/today-sand-rate-in-pakistan" className="font-semibold text-primary hover:underline">sand</Link>.
                </li>
                <li>
                  Building the whole house? The <Link href="/tools/construction-cost-calculator" className="font-semibold text-primary hover:underline">construction cost calculator</Link> adds steel, concrete, labour and finishing; the{' '}
                  <Link href="/tools/cement-bags-calculator" className="font-semibold text-primary hover:underline">cement calculator</Link> does slabs and plaster.
                </li>
              </ul>
            </Card>
          </>
        }
      />
    </>
  );
}

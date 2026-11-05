'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { brickwork, rateOf, rsShort, rupees, type ConstructionData } from '@/lib/tools';
import { Card, Disclosure, ResultHero, Row, Segment, SliderField, Stepper, StickyAnswer, Tiles, ToolLayout, useOnScreen } from './ui';

/*
 * How many bricks a wall takes — and the cement and sand for its mortar —
 * counted the way Pakistani engineers do (see MASONRY_DEFAULTS), priced on
 * today's rates in the chosen city.
 */

const THICK = [
  { v: 4.5, label: '4.5"', sub: 'Half brick · inside' },
  { v: 9, label: '9"', sub: 'One brick · outer' },
  { v: 13.5, label: '13.5"', sub: 'Boundary · load' },
];
const MORTAR = [
  { v: 4, label: '1 : 4', sub: 'Strong' },
  { v: 5, label: '1 : 5', sub: '' },
  { v: 6, label: '1 : 6', sub: 'Usual' },
];
/** A door is about 3' × 7', a window 4' × 4'. */
const DOOR = 21;
const WINDOW = 16;

const n0 = (n: number) => Math.round(n).toLocaleString('en-PK');
const n1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('en-PK');

export default function BricksCalculator({ data }: { data: ConstructionData }) {
  const cities = data.config.cities.map((c) => c.name);
  const m = data.config.masonry;
  const [city, setCity] = useState(cities[0] ?? 'Lahore');
  const [length, setLength] = useState(100);
  const [height, setHeight] = useState(10);
  const [thickness, setThickness] = useState(9);
  const [mortar, setMortar] = useState(6);
  const [doors, setDoors] = useState(2);
  const [windows, setWindows] = useState(2);
  const [heroRef, heroOn] = useOnScreen<HTMLElement>();

  const openings = doors * DOOR + windows * WINDOW;
  const r = useMemo(() => brickwork({ lengthFt: length, heightFt: height, thicknessIn: thickness, openingsSqft: openings, mortar }, m), [length, height, thickness, openings, mortar, m]);

  const brickRate = rateOf(data, 'bricks', city);
  const cementRate = rateOf(data, 'cement', city);
  const sandRate = rateOf(data, 'sand', city);
  const cost = { bricks: r.bricks * brickRate, cement: Math.ceil(r.cementBags) * cementRate, sand: r.sandCft * sandRate };
  const total = cost.bricks + cost.cement + cost.sand;

  return (
    <>
      <StickyAnswer show={!heroOn} label="Bricks needed" value={n0(r.bricks)} onTap={() => (heroRef.current as HTMLElement | null)?.scrollIntoView({ behavior: 'smooth', block: 'center' })} />
      <ToolLayout
        inputs={
          <>
            <Card title="The wall">
              <div className="space-y-5">
                <SliderField label="Total length of walls" value={length} onChange={setLength} min={1} max={1000} step={1} suffix="ft" hint="All the walls, end to end" />
                <SliderField label="Height" value={height} onChange={setHeight} min={1} max={30} step={0.5} suffix="ft" hint="Usual room height: 10–11 ft" />
                <Segment label="Thickness" value={thickness} onChange={setThickness} options={THICK} />
              </div>
            </Card>
            <Card title="Doors & windows" action={`${n0(openings)} sq ft taken out`}>
              <div className="space-y-2.5">
                <Stepper label="Doors" sub="About 3' × 7'" value={doors} onChange={setDoors} max={60} />
                <Stepper label="Windows" sub="About 4' × 4'" value={windows} onChange={setWindows} max={80} />
              </div>
            </Card>
            <Disclosure title="Mortar & city" sub="Cement : sand mix, and whose rates">
              <div className="space-y-5 pt-1">
                <Segment label="Mortar mix (cement : sand)" value={mortar} onChange={setMortar} options={MORTAR} />
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
            <ResultHero heroRef={heroRef} label="Bricks needed" value={n0(r.bricks)} sub={`${n1(r.cementBags)} bags of cement · ${n0(r.sandCft)} cft sand · incl. ${m.brickWastagePct}% wastage`}>
              <Tiles
                onBrand
                items={[
                  { label: 'Bricks', value: rsShort(cost.bricks), hint: `${rupees(brickRate)} each` },
                  { label: 'Cement', value: rsShort(cost.cement), hint: `${Math.ceil(r.cementBags)} bags × ${rupees(cementRate)}` },
                  { label: 'Sand', value: rsShort(cost.sand), hint: `${rupees(sandRate)}/cft` },
                ]}
              />
            </ResultHero>
            <p className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-[14px] text-slate-700">
              Material total <b className="text-slate-900">{rupees(total)}</b> in {city} on today&apos;s rates — about{' '}
              <b className="text-slate-900">{rupees(r.faceSqft ? total / r.faceSqft : 0)}</b> per sq ft of wall. Labour is extra.
            </p>
          </>
        }
        details={
          <>
            <Card title="How it's worked out">
              <div className="divide-y divide-slate-100">
                <Row label="Wall area" note={`${n0(length)} ft × ${height} ft − ${n0(openings)} sq ft of openings`} value={`${n0(r.faceSqft)} sq ft`} />
                <Row label="Brickwork" note={`× ${thickness}" thick`} value={`${n1(r.volumeCft)} cft`} />
                <Row label="Bricks" note={`${n0(m.bricksPer100Cft)} per 100 cft (9" × 4.5" × 3" with joints) + ${m.brickWastagePct}%`} value={n0(r.bricks)} strong />
                <Row label="Dry mortar" note={`${m.dryMortarPer100Cft} cft per 100 cft of brickwork`} value={`${n1(r.dryMortarCft)} cft`} />
                <Row label="Cement" note={`1 part in ${1 + mortar} · ${m.cementBagCft} cft a bag`} value={`${n1(r.cementBags)} bags`} />
                <Row label="Sand" note={`${mortar} parts in ${1 + mortar}`} value={`${n0(r.sandCft)} cft`} />
                <Row label="Per sq ft of wall" value={`${r.faceSqft ? (r.bricksNet / r.faceSqft).toFixed(1) : '0'} bricks`} />
              </div>
            </Card>
            <Card title="Today's rates">
              <div className="divide-y divide-slate-100 text-[14.5px]">
                <Row label={<Link href="/today-bricks-rate-in-pakistan" className="text-primary hover:underline">Bricks</Link>} value={`${rupees(brickRate)} each`} />
                <Row label={<Link href="/today-cement-rate-in-pakistan" className="text-primary hover:underline">Cement</Link>} value={`${rupees(cementRate)} a bag`} />
                <Row label={<Link href="/today-sand-rate-in-pakistan" className="text-primary hover:underline">Sand</Link>} value={`${rupees(sandRate)} a cft`} />
              </div>
              <p className="mt-3 text-[13px] text-slate-600">
                Building a whole house? The <Link href="/tools/construction-cost-calculator" className="font-semibold text-primary hover:underline">construction cost calculator</Link> adds steel, concrete, labour and finishing.
              </p>
            </Card>
          </>
        }
      />
    </>
  );
}

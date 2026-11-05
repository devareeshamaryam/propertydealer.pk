'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { brickwork, concrete, plaster, rateOf, rsShort, rupees, CONCRETE_MIXES, type ConcreteMix, type ConstructionData } from '@/lib/tools';
import { Card, Disclosure, ResultHero, Row, Segment, SliderField, Stepper, StickyAnswer, Tiles, ToolLayout, useOnScreen } from './ui';

/*
 * Cement bags (and sand, crush, water) for concrete, plaster or brick
 * mortar — the way Pakistani engineers count them (see MASONRY_DEFAULTS),
 * priced on today's rates in the chosen city.
 */

type Work = 'concrete' | 'plaster' | 'mortar';
type Shape = 'slab' | 'beam' | 'column' | 'footing';

const WORKS = [
  { v: 'concrete' as const, label: 'Concrete', sub: 'Slab, beam, column' },
  { v: 'plaster' as const, label: 'Plaster', sub: 'Walls, ceilings' },
  { v: 'mortar' as const, label: 'Brickwork', sub: 'Mortar only' },
];
const SHAPES: { v: Shape; label: string; sub: string; mix: ConcreteMix; dims: [number, number, number]; thickIn: boolean }[] = [
  { v: 'slab', label: 'Slab', sub: 'Roof / floor', mix: '1:2:4', dims: [30, 25, 5], thickIn: true },
  { v: 'beam', label: 'Beam', sub: 'Lintel too', mix: '1:2:4', dims: [20, 0.75, 1.5], thickIn: false },
  { v: 'column', label: 'Column', sub: '', mix: '1:1.5:3', dims: [10, 1, 1.25], thickIn: false },
  { v: 'footing', label: 'Footing', sub: 'Base', mix: '1:2:4', dims: [4, 4, 12], thickIn: true },
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
  { v: 4, label: '1 : 4', sub: 'Strong' },
  { v: 5, label: '1 : 5', sub: '' },
  { v: 6, label: '1 : 6', sub: 'Usual' },
];
const THICK = [
  { v: 4.5, label: '4.5"', sub: '' },
  { v: 9, label: '9"', sub: '' },
  { v: 13.5, label: '13.5"', sub: '' },
];

const n0 = (n: number) => Math.round(n).toLocaleString('en-PK');
const n1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('en-PK');

export default function CementCalculator({ data }: { data: ConstructionData }) {
  const cities = data.config.cities.map((c) => c.name);
  const m = data.config.masonry;
  const [city, setCity] = useState(cities[0] ?? 'Lahore');
  const [work, setWork] = useState<Work>('concrete');
  // Concrete
  const [shape, setShape] = useState<Shape>('slab');
  const [len, setLen] = useState(30);
  const [wid, setWid] = useState(25);
  const [thick, setThick] = useState(5);
  const [count, setCount] = useState(1);
  const [mix, setMix] = useState<ConcreteMix>('1:2:4');
  // Plaster
  const [area, setArea] = useState(1000);
  const [pThick, setPThick] = useState(0.5);
  const [pMix, setPMix] = useState(6);
  // Brick mortar
  const [wLen, setWLen] = useState(100);
  const [wHeight, setWHeight] = useState(10);
  const [wThick, setWThick] = useState(9);
  const [mMix, setMMix] = useState(6);
  const [heroRef, heroOn] = useOnScreen<HTMLElement>();

  const sh = SHAPES.find((s) => s.v === shape)!;
  const pickShape = (v: Shape) => {
    const s = SHAPES.find((x) => x.v === v)!;
    setShape(v);
    setLen(s.dims[0]);
    setWid(s.dims[1]);
    setThick(s.dims[2]);
    setMix(s.mix);
  };

  const r = useMemo(() => {
    if (work === 'concrete') {
      const depthFt = sh.thickIn ? thick / 12 : thick;
      return { kind: 'concrete' as const, ...concrete(len * wid * depthFt * count, mix, m) };
    }
    if (work === 'plaster') return { kind: 'plaster' as const, waterLitres: 0, ...plaster(area, pThick, pMix, m) };
    const b = brickwork({ lengthFt: wLen, heightFt: wHeight, thicknessIn: wThick, openingsSqft: 0, mortar: mMix }, m);
    return { kind: 'mortar' as const, waterLitres: 0, ...b };
  }, [work, sh, len, wid, thick, count, mix, area, pThick, pMix, wLen, wHeight, wThick, mMix, m]);

  const bags = Math.ceil(r.cementBags);
  const cementRate = rateOf(data, 'cement', city);
  const sandRate = rateOf(data, 'sand', city);
  const crushRate = rateOf(data, 'crush', city);
  const cost = { cement: bags * cementRate, sand: r.sandCft * sandRate, crush: r.crushCft * crushRate };
  const total = cost.cement + cost.sand + cost.crush;

  return (
    <>
      <StickyAnswer show={!heroOn} label="Cement bags" value={n0(bags)} onTap={() => (heroRef.current as HTMLElement | null)?.scrollIntoView({ behavior: 'smooth', block: 'center' })} />
      <ToolLayout
        inputs={
          <>
            <Card>
              <Segment label="What are you making?" value={work} onChange={setWork} options={WORKS} />
            </Card>

            {work === 'concrete' && (
              <Card title="Concrete">
                <div className="space-y-5">
                  <Segment value={shape} onChange={pickShape} options={SHAPES.map((s) => ({ v: s.v, label: s.label, sub: s.sub }))} />
                  <SliderField label="Length" value={len} onChange={setLen} min={0.5} max={200} step={0.5} suffix="ft" />
                  <SliderField label="Width" value={wid} onChange={setWid} min={0.25} max={200} step={0.25} suffix="ft" />
                  {sh.thickIn ? (
                    <SliderField label="Thickness" value={thick} onChange={setThick} min={2} max={36} step={0.5} suffix="in" hint={shape === 'slab' ? 'Roof slab: usually 5–6"' : undefined} />
                  ) : (
                    <SliderField label="Depth" value={thick} onChange={setThick} min={0.25} max={6} step={0.25} suffix="ft" hint={shape === 'beam' ? "9\" × 18\" beam = 0.75' × 1.5'" : undefined} />
                  )}
                  {shape !== 'slab' && <Stepper label={`How many ${sh.label.toLowerCase()}s`} value={count} onChange={setCount} min={1} max={200} />}
                  <div>
                    <p className="mb-2 text-[14px] font-semibold text-slate-800">Mix (cement : sand : crush)</p>
                    <div className="space-y-1.5">
                      {CONCRETE_MIXES.map((x) => (
                        <label key={x.v} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 ${mix === x.v ? 'border-primary bg-primary/5' : 'border-slate-300'}`}>
                          <input type="radio" name="mix" checked={mix === x.v} onChange={() => setMix(x.v)} className="accent-[var(--primary)]" />
                          <span className="text-[15px] font-bold tabular-nums text-slate-900">{x.label}</span>
                          <span className="text-[13px] text-slate-600">{x.use}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {work === 'plaster' && (
              <Card title="Plaster">
                <div className="space-y-5">
                  <SliderField label="Area to plaster" value={area} onChange={setArea} min={10} max={20000} step={10} suffix="sq ft" hint="Both sides of a wall count twice" />
                  <Segment label="Thickness" value={pThick} onChange={setPThick} options={PLASTER_THICK} />
                  <Segment label="Mix (cement : sand)" value={pMix} onChange={setPMix} options={PLASTER_MIX} />
                </div>
              </Card>
            )}

            {work === 'mortar' && (
              <Card title="Brick wall (mortar)">
                <div className="space-y-5">
                  <SliderField label="Total length of walls" value={wLen} onChange={setWLen} min={1} max={1000} step={1} suffix="ft" />
                  <SliderField label="Height" value={wHeight} onChange={setWHeight} min={1} max={30} step={0.5} suffix="ft" />
                  <Segment label="Thickness" value={wThick} onChange={setWThick} options={THICK} />
                  <Segment label="Mix (cement : sand)" value={mMix} onChange={setMMix} options={MORTAR_MIX} />
                  <p className="text-[13px] text-slate-600">
                    Need the bricks too? Use the <Link href="/tools/bricks-calculator" className="font-semibold text-primary hover:underline">bricks calculator</Link>.
                  </p>
                </div>
              </Card>
            )}

            <Disclosure title="City" sub="Whose rates to price it on">
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
              label="Cement bags (50 kg)"
              value={n0(bags)}
              sub={[`${n0(r.sandCft)} cft sand`, r.crushCft ? `${n0(r.crushCft)} cft crush (bajri)` : '', r.waterLitres ? `${n0(r.waterLitres)} litres water` : ''].filter(Boolean).join(' · ')}
            >
              <Tiles
                onBrand
                items={[
                  { label: 'Cement', value: rsShort(cost.cement), hint: `${rupees(cementRate)} a bag` },
                  { label: 'Sand', value: rsShort(cost.sand), hint: `${rupees(sandRate)}/cft` },
                  ...(r.crushCft ? [{ label: 'Crush', value: rsShort(cost.crush), hint: `${rupees(crushRate)}/cft` }] : []),
                ]}
              />
            </ResultHero>
            <p className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-[14px] text-slate-700">
              Material total <b className="text-slate-900">{rupees(total)}</b> in {city} on today&apos;s rates. Steel and labour are extra.
            </p>
          </>
        }
        details={
          <>
            <Card title="How it's worked out">
              <div className="divide-y divide-slate-100">
                {r.kind === 'concrete' && (
                  <>
                    <Row label="Concrete (finished)" note={`${len}' × ${wid}' × ${sh.thickIn ? `${thick}"` : `${thick}'`}${count > 1 ? ` × ${count}` : ''}`} value={`${n1(r.volumeCft)} cft`} />
                    <Row label="Dry materials" note={`× ${m.concreteDryFactor} — they shrink when mixed`} value={`${n1(r.dryCft)} cft`} />
                  </>
                )}
                {r.kind === 'plaster' && (
                  <>
                    <Row label="Plaster (finished)" note={`${n0(area)} sq ft × ${pThick}"`} value={`${n1(r.wetCft)} cft`} />
                    <Row label="Dry materials" note={`× ${m.plasterDryFactor} — joints, uneven walls, spill`} value={`${n1(r.dryCft)} cft`} />
                  </>
                )}
                {r.kind === 'mortar' && (
                  <>
                    <Row label="Brickwork" note={`${wLen}' × ${wHeight}' × ${wThick}"`} value={`${n1(r.volumeCft)} cft`} />
                    <Row label="Dry mortar" note={`${m.dryMortarPer100Cft} cft per 100 cft of brickwork`} value={`${n1(r.dryMortarCft)} cft`} />
                  </>
                )}
                <Row label="Cement" note={`${m.cementBagCft} cft a bag + ${m.cementWastagePct}% wastage`} value={`${n1(r.cementBags)} bags → ${n0(bags)}`} strong />
                <Row label="Sand" value={`${n1(r.sandCft)} cft`} />
                {r.crushCft > 0 && <Row label="Crush (bajri)" value={`${n1(r.crushCft)} cft`} />}
                {r.waterLitres > 0 && <Row label="Water" note={`${m.waterCementRatio} litre per kg of cement`} value={`${n0(r.waterLitres)} litres`} />}
              </div>
            </Card>
            <Card title="Today's rates">
              <div className="divide-y divide-slate-100 text-[14.5px]">
                <Row label={<Link href="/today-cement-rate-in-pakistan" className="text-primary hover:underline">Cement</Link>} value={`${rupees(cementRate)} a bag`} />
                <Row label={<Link href="/today-sand-rate-in-pakistan" className="text-primary hover:underline">Sand</Link>} value={`${rupees(sandRate)} a cft`} />
                <Row label={<Link href="/today-bajri-rate-in-pakistan" className="text-primary hover:underline">Crush (bajri)</Link>} value={`${rupees(crushRate)} a cft`} />
              </div>
            </Card>
          </>
        }
      />
    </>
  );
}

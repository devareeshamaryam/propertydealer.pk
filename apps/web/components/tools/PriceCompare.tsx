'use client';

import { useState } from 'react';
import { Plus, Trophy, X } from 'lucide-react';
import { MARLA_STANDARDS, convert, nice, type UnitKey } from '@/lib/area-units';
import { rsShort, rupees } from '@/lib/tools';
import { cn } from '@/lib/utils';
import { Card, MoneyField, ResultHero, Row, Segment, StickyAnswer, Tiles, ToolLayout, useOnScreen } from './ui';

type SizeUnit = Extract<UnitKey, 'marla' | 'kanal' | 'sqft' | 'sqyd'>;
const SIZE_UNITS: { v: SizeUnit; label: string }[] = [
  { v: 'marla', label: 'Marla' },
  { v: 'kanal', label: 'Kanal' },
  { v: 'sqyd', label: 'Sq yd' },
  { v: 'sqft', label: 'Sq ft' },
];
const NAMES = ['Plot A', 'Plot B', 'Plot C'];
const COLORS = ['#2a78d6', '#eb6834', '#1baf7a'];

interface Option {
  price: number;
  size: string;
  unit: SizeUnit;
}

export default function PriceCompare() {
  const [marla, setMarla] = useState<number>(225);
  const [opts, setOpts] = useState<Option[]>([{ price: 15_000_000, size: '5', unit: 'marla' }]);
  const [heroRef, heroOn] = useOnScreen<HTMLElement>();

  const set = (i: number, p: Partial<Option>) => setOpts((o) => o.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const rows = opts.map((o, i) => {
    const sqft = (Number(o.size) || 0) > 0 ? convert(Number(o.size), o.unit, 'sqft', marla) : 0;
    const ok = sqft > 0 && o.price > 0;
    return {
      i,
      name: NAMES[i]!,
      ok,
      sqft,
      perMarla: ok ? o.price / (sqft / marla) : 0,
      perSqft: ok ? o.price / sqft : 0,
      perSqyd: ok ? o.price / (sqft / 9) : 0,
      perKanal: ok ? o.price / (sqft / (marla * 20)) : 0,
    };
  });
  const valid = rows.filter((r) => r.ok);
  const best = valid.length ? valid.reduce((a, b) => (b.perMarla < a.perMarla ? b : a)) : null;
  const worst = valid.length ? valid.reduce((a, b) => (b.perMarla > a.perMarla ? b : a)) : null;
  const comparing = valid.length > 1;
  const top = comparing ? best : valid[0] ?? null;

  return (
    <>
      <StickyAnswer show={!heroOn && !!top} label={comparing ? `${top?.name} is the better buy` : 'Price per marla'} value={top ? rsShort(top.perMarla) : '—'} onTap={() => (heroRef.current as HTMLElement | null)?.scrollIntoView({ behavior: 'smooth', block: 'center' })} />
      <ToolLayout
        inputs={
          <>
            {opts.map((o, i) => (
              <Card
                key={i}
                title={
                  <span className="inline-flex items-center gap-2">
                    <span className="h-3 w-3 rounded-[4px]" style={{ background: COLORS[i] }} />
                    {opts.length > 1 ? NAMES[i] : 'The plot'}
                  </span>
                }
                action={
                  opts.length > 1 ? (
                    <button type="button" onClick={() => setOpts((x) => x.filter((_, j) => j !== i))} className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200" aria-label={`Remove ${NAMES[i]}`}>
                      <X className="h-4 w-4" />
                    </button>
                  ) : undefined
                }
              >
                <div className="space-y-4">
                  <MoneyField label="Price" value={o.price} onChange={(price) => set(i, { price })} />
                  <div>
                    <p className="mb-1.5 text-[14px] font-semibold text-slate-700">Size</p>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      value={o.size}
                      onChange={(e) => set(i, { size: e.target.value })}
                      aria-label="Size"
                      className="mb-2 h-[52px] w-full rounded-2xl bg-slate-50 px-4 text-[20px] font-bold tabular-nums text-slate-900 outline-none ring-1 ring-slate-200 focus:bg-white focus:ring-2 focus:ring-primary/40"
                    />
                    <Segment value={o.unit} onChange={(unit) => set(i, { unit })} options={SIZE_UNITS} />
                  </div>
                </div>
              </Card>
            ))}
            {opts.length < 3 && (
              <button
                type="button"
                onClick={() => setOpts((x) => [...x, { price: 0, size: x[x.length - 1]?.size ?? '5', unit: x[x.length - 1]?.unit ?? 'marla' }])}
                className="flex w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-slate-300 py-4 text-[15px] font-bold text-slate-600 hover:border-primary hover:text-primary"
              >
                <Plus className="h-5 w-5" /> Compare with another plot
              </button>
            )}
            <Card>
              <Segment label="1 Marla =" value={marla} onChange={setMarla} options={MARLA_STANDARDS.map((m) => ({ v: m.sqft, label: `${nice(m.sqft)} ft²` }))} />
            </Card>
          </>
        }
        results={
          <>
            {!top ? (
              <p className="rounded-3xl bg-white p-6 text-center text-[15px] text-slate-500 ring-1 ring-slate-200/70">Enter a price and a size.</p>
            ) : comparing ? (
              <ResultHero
                heroRef={heroRef}
                label={`${best!.name} is the better buy`}
                value={`${rsShort(best!.perMarla)}/marla`}
                sub={worst && worst.i !== best!.i ? `${Math.round((1 - best!.perMarla / worst.perMarla) * 100)}% cheaper per marla than ${worst.name}` : 'The same rate'}
              >
                <Tiles
                  onBrand
                  items={[
                    { label: 'Per sq ft', value: rupees(best!.perSqft) },
                    { label: 'Per sq yd', value: rupees(best!.perSqyd) },
                    { label: 'Per kanal', value: rsShort(best!.perKanal) },
                  ]}
                />
              </ResultHero>
            ) : (
              <ResultHero heroRef={heroRef} label="Price per marla" value={rsShort(top.perMarla)} sub={`${nice(top.sqft / marla)} marla · ${nice(top.sqft)} sq ft`}>
                <Tiles
                  onBrand
                  items={[
                    { label: 'Per sq ft', value: rupees(top.perSqft) },
                    { label: 'Per sq yd', value: rupees(top.perSqyd) },
                    { label: 'Per kanal', value: rsShort(top.perKanal) },
                  ]}
                />
              </ResultHero>
            )}

            {comparing && (
              <Card title="Side by side" action={<span className="text-[12px] text-slate-400">Price per marla</span>}>
                <div className="space-y-3.5">
                  {rows.map((r) => (
                    <div key={r.i}>
                      <div className="flex items-baseline justify-between gap-3 text-[14px]">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
                          {r.name}
                          {best?.i === r.i && <Trophy className="h-4 w-4 text-amber-500" />}
                        </span>
                        <b className="tabular-nums text-slate-900">{r.ok ? rsShort(r.perMarla) : '—'}</b>
                      </div>
                      <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full" style={{ width: r.ok && worst ? `${(r.perMarla / worst.perMarla) * 100}%` : '0%', background: COLORS[r.i] }} />
                      </div>
                      <p className="mt-1 text-[12px] tabular-nums text-slate-500">
                        {r.ok ? `${rsShort(opts[r.i]!.price)} for ${nice(r.sqft / marla)} marla · ${rupees(r.perSqft)}/sq ft` : 'Add its price and size'}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {top && (
              <Card title={comparing ? `${best!.name} in every unit` : 'In every unit'}>
                <div className="divide-y divide-slate-100">
                  <Row label="Per marla" note={`${nice(marla)} sq ft`} value={rupees((comparing ? best! : top).perMarla)} />
                  <Row label="Per kanal" value={rupees((comparing ? best! : top).perKanal)} />
                  <Row label="Per square yard (gaz)" value={rupees((comparing ? best! : top).perSqyd)} />
                  <Row label="Per square foot" value={rupees((comparing ? best! : top).perSqft)} />
                  <Row label="Per square metre" value={rupees((comparing ? best! : top).perSqft * 10.7639104)} />
                </div>
              </Card>
            )}
            <p className={cn('px-1 text-[12.5px] leading-relaxed text-slate-500')}>
              Compare like with like: a corner, park-facing or main-road plot, or one in a better block, usually costs more per marla.
            </p>
          </>
        }
      />
    </>
  );
}

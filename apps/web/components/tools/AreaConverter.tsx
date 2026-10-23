'use client';

import { useState } from 'react';
import { ChevronDown, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { MARLA_STANDARDS, UNITS, convert, nice, unitDef, type UnitKey } from '@/lib/area-units';
import { cn } from '@/lib/utils';
import { Card, Disclosure, ResultHero, Segment, StickyAnswer, ToolLayout, useOnScreen } from './ui';

const QUICK: { v: number; u: UnitKey; label: string }[] = [
  { v: 3, u: 'marla', label: '3 Marla' },
  { v: 5, u: 'marla', label: '5 Marla' },
  { v: 7, u: 'marla', label: '7 Marla' },
  { v: 10, u: 'marla', label: '10 Marla' },
  { v: 1, u: 'kanal', label: '1 Kanal' },
  { v: 2, u: 'kanal', label: '2 Kanal' },
  { v: 120, u: 'sqyd', label: '120 Gaz' },
  { v: 240, u: 'sqyd', label: '240 Gaz' },
  { v: 1, u: 'acre', label: '1 Acre' },
];

const SIZES: { v: number; u: UnitKey }[] = [
  { v: 3, u: 'marla' },
  { v: 5, u: 'marla' },
  { v: 7, u: 'marla' },
  { v: 8, u: 'marla' },
  { v: 10, u: 'marla' },
  { v: 1, u: 'kanal' },
  { v: 2, u: 'kanal' },
  { v: 4, u: 'kanal' },
];

const DIMENSIONS = [
  [20, 45],
  [25, 45],
  [30, 60],
  [35, 65],
  [40, 80],
  [50, 90],
];

/** The four sizes people quote most — big, in the answer card. */
const HEADLINE: UnitKey[] = ['marla', 'kanal', 'sqft', 'sqyd'];
const LEN_UNITS = { ft: { label: 'Feet', sqft: 1 }, m: { label: 'Metres', sqft: 10.7639104 }, yd: { label: 'Yards', sqft: 9 } } as const;
type LenUnit = keyof typeof LEN_UNITS;

const copy = (text: string) =>
  navigator.clipboard?.writeText(text).then(
    () => toast.success(`Copied ${text}`),
    () => undefined,
  );

export default function AreaConverter() {
  const [tab, setTab] = useState<'convert' | 'dims'>('convert');
  const [value, setValue] = useState('5');
  const [from, setFrom] = useState<UnitKey>('marla');
  const [marla, setMarla] = useState<number>(225);
  const [len, setLen] = useState('25');
  const [wid, setWid] = useState('45');
  const [lenUnit, setLenUnit] = useState<LenUnit>('ft');
  const [heroRef, heroOn] = useOnScreen<HTMLElement>();

  const n = Number(value);
  const valid = Number.isFinite(n) && n > 0;
  const to = (u: UnitKey) => (valid ? convert(n, from, u, marla) : 0);

  const dimSqft = (Number(len) || 0) * (Number(wid) || 0) * LEN_UNITS[lenUnit].sqft;
  const sqft = tab === 'convert' ? to('sqft') : dimSqft;
  const inUnit = (u: UnitKey) => (sqft > 0 ? convert(sqft, 'sqft', u, marla) : 0);
  const std = MARLA_STANDARDS.find((m) => m.sqft === marla)!;

  const headline = tab === 'convert' ? `${valid ? nice(n) : '—'} ${unitDef(from).label}` : `${len || 0} × ${wid || 0} ${LEN_UNITS[lenUnit].label.toLowerCase()}`;

  return (
    <>
      <StickyAnswer show={!heroOn && sqft > 0} label={headline} value={`${nice(inUnit('marla'))} Marla`} onTap={() => (heroRef.current as HTMLElement | null)?.scrollIntoView({ behavior: 'smooth', block: 'center' })} />
      <ToolLayout
        inputs={
          <>
            <Segment
              value={tab}
              onChange={setTab}
              options={[
                { v: 'convert', label: 'Convert a size' },
                { v: 'dims', label: 'Length × width' },
              ]}
            />
            <Card>
              {tab === 'convert' ? (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      placeholder="0"
                      aria-label="Size"
                      className="h-14 min-w-0 flex-1 rounded-2xl bg-slate-50 px-4 text-[24px] font-extrabold tabular-nums text-slate-900 outline-none ring-1 ring-slate-200 focus:bg-white focus:ring-2 focus:ring-primary/40"
                    />
                    <span className="relative w-[44%] max-w-[180px] shrink-0">
                      <select
                        value={from}
                        onChange={(e) => setFrom(e.target.value as UnitKey)}
                        aria-label="Unit"
                        className="h-14 w-full appearance-none rounded-2xl bg-slate-50 pl-3.5 pr-8 text-[15px] font-bold text-slate-900 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-primary/40"
                      >
                        {UNITS.map((u) => (
                          <option key={u.key} value={u.key}>
                            {u.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    </span>
                  </div>
                  <div className="hide-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
                    {QUICK.map((q) => (
                      <button
                        key={q.label}
                        type="button"
                        onClick={() => {
                          setValue(String(q.v));
                          setFrom(q.u);
                        }}
                        className={cn('shrink-0 rounded-full px-3 py-1.5 text-[12.5px] font-semibold', n === q.v && from === q.u ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    {[
                      [len, setLen, 'Front'],
                      [wid, setWid, 'Depth'],
                    ].map(([v, set, l], i) => (
                      <label key={l as string} className={cn('block', i === 1 && 'col-start-3')}>
                        <span className="mb-1 block text-[12.5px] font-semibold text-slate-500">{l as string}</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          value={v as string}
                          onChange={(e) => (set as (s: string) => void)(e.target.value)}
                          className="h-14 w-full rounded-2xl bg-slate-50 px-4 text-[22px] font-extrabold tabular-nums text-slate-900 outline-none ring-1 ring-slate-200 focus:bg-white focus:ring-2 focus:ring-primary/40"
                        />
                      </label>
                    ))}
                    <span className="col-start-2 row-start-1 self-end pb-4 text-[20px] font-bold text-slate-300">×</span>
                  </div>
                  <Segment value={lenUnit} onChange={setLenUnit} options={(Object.keys(LEN_UNITS) as LenUnit[]).map((k) => ({ v: k, label: LEN_UNITS[k].label }))} />
                  <div className="flex flex-wrap gap-1.5">
                    {DIMENSIONS.map(([a, b]) => (
                      <button
                        key={`${a}x${b}`}
                        type="button"
                        onClick={() => {
                          setLen(String(a));
                          setWid(String(b));
                          setLenUnit('ft');
                        }}
                        className="rounded-full bg-slate-100 px-3 py-1.5 text-[12.5px] font-semibold text-slate-600 hover:bg-slate-200"
                      >
                        {a} × {b} ft
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Card>
            <Card>
              <Segment label="1 Marla =" value={marla} onChange={setMarla} options={MARLA_STANDARDS.map((m) => ({ v: m.sqft, label: `${nice(m.sqft)} ft²` }))} />
              <p className="mt-2 text-[12.5px] leading-snug text-slate-500">{std.hint}</p>
            </Card>
          </>
        }
        results={
          <>
            <ResultHero heroRef={heroRef} label={headline} value={sqft > 0 ? `${nice(inUnit('marla'))} Marla` : '—'} sub={sqft > 0 ? `${nice(sqft)} square feet` : 'Enter a size'}>
              <dl className="mt-4 grid grid-cols-2 gap-2">
                {HEADLINE.map((u) => (
                  <button key={u} type="button" onClick={() => sqft > 0 && copy(`${nice(inUnit(u))} ${unitDef(u).short}`)} className="rounded-2xl bg-white/12 px-3 py-2.5 text-left ring-1 ring-white/15 hover:bg-white/20">
                    <dt className="text-[11.5px] font-medium text-white/70">{unitDef(u).label}</dt>
                    <dd className="text-[19px] font-extrabold tabular-nums">{sqft > 0 ? nice(inUnit(u)) : '—'}</dd>
                  </button>
                ))}
              </dl>
            </ResultHero>

            <Card title="Every unit" action={<span className="text-[12px] text-slate-400">Tap to convert from it</span>}>
              <ul className="divide-y divide-slate-100">
                {UNITS.filter((u) => !HEADLINE.includes(u.key)).map((u) => {
                  const v = inUnit(u.key);
                  return (
                    <li key={u.key} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (!(v > 0)) return;
                          setTab('convert');
                          setValue(String(Number(v.toPrecision(8))));
                          setFrom(u.key);
                        }}
                        className="flex min-w-0 flex-1 items-baseline justify-between gap-3 py-3 text-left"
                      >
                        <span className="min-w-0">
                          <span className="block text-[14.5px] font-semibold text-slate-800">{u.label}</span>
                          {(u.hint || (u.local && marla !== 225)) && <span className="block text-[12px] text-slate-400">{u.local && marla !== 225 ? `on the ${nice(marla)} ft² marla` : u.hint}</span>}
                        </span>
                        <span className="shrink-0 text-[16px] font-bold tabular-nums text-slate-900">{v > 0 ? nice(v) : '—'}</span>
                      </button>
                      <button type="button" onClick={() => v > 0 && copy(`${nice(v)} ${u.short}`)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-primary" aria-label={`Copy ${u.label}`}>
                        <Copy className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>

            <Disclosure title="Common plot sizes" sub={`On the ${nice(marla)} ft² marla`}>
              <div className="-mx-1 overflow-x-auto">
                <table className="w-full min-w-[320px] text-[14px] tabular-nums">
                  <thead>
                    <tr className="text-left text-[11.5px] uppercase tracking-wide text-slate-400">
                      <th className="py-2 pr-2 font-semibold">Size</th>
                      <th className="py-2 pr-2 text-right font-semibold">Sq ft</th>
                      <th className="py-2 pr-2 text-right font-semibold">Sq yd</th>
                      <th className="py-2 text-right font-semibold">Sq m</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SIZES.map((s) => {
                      const f = convert(s.v, s.u, 'sqft', marla);
                      return (
                        <tr key={`${s.v}${s.u}`} className="border-t border-slate-100">
                          <td className="py-2 pr-2 font-semibold text-slate-800">
                            {s.v} {s.u === 'kanal' ? 'Kanal' : 'Marla'}
                          </td>
                          <td className="py-2 pr-2 text-right">{nice(f)}</td>
                          <td className="py-2 pr-2 text-right">{nice(f / 9)}</td>
                          <td className="py-2 text-right">{nice(f / 10.7639104)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Disclosure>
          </>
        }
      />
    </>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { ArrowLeftRight, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { MARLA_STANDARDS, UNITS, convert, nice, unitDef, type UnitKey } from '@/lib/area-units';
import { cn } from '@/lib/utils';

const QUICK: { v: number; u: UnitKey; label: string }[] = [
  { v: 3, u: 'marla', label: '3 Marla' },
  { v: 5, u: 'marla', label: '5 Marla' },
  { v: 7, u: 'marla', label: '7 Marla' },
  { v: 10, u: 'marla', label: '10 Marla' },
  { v: 1, u: 'kanal', label: '1 Kanal' },
  { v: 2, u: 'kanal', label: '2 Kanal' },
  { v: 120, u: 'sqyd', label: '120 Sq yd' },
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
  [25, 45],
  [30, 60],
  [35, 65],
  [40, 80],
  [50, 90],
];

const field =
  'h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-[17px] tabular-nums text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20';

export default function AreaConverter() {
  const [value, setValue] = useState('5');
  const [from, setFrom] = useState<UnitKey>('marla');
  const [to, setTo] = useState<UnitKey>('sqft');
  const [marla, setMarla] = useState<number>(225);
  const [len, setLen] = useState('25');
  const [wid, setWid] = useState('45');

  const n = Number(value);
  const valid = Number.isFinite(n) && n > 0;
  const results = useMemo(() => UNITS.map((u) => ({ u, v: valid ? convert(n, from, u.key, marla) : 0 })), [n, valid, from, marla]);
  const main = valid ? convert(n, from, to, marla) : 0;

  const dimSqft = (Number(len) || 0) * (Number(wid) || 0);

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).then(
      () => toast.success(`Copied: ${text}`),
      () => undefined,
    );
  };

  return (
    <div className="space-y-5">
      {/* Converter */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="grid items-end gap-3 md:grid-cols-[1fr_auto_1fr]">
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-slate-600" htmlFor="ac-value">
              Size
            </label>
            <div className="flex gap-2">
              <input id="ac-value" type="number" inputMode="decimal" min="0" step="any" value={value} onChange={(e) => setValue(e.target.value)} className={field} placeholder="0" />
              <select value={from} onChange={(e) => setFrom(e.target.value as UnitKey)} className={cn(field, 'w-[150px] shrink-0 text-[15px]')} aria-label="From unit">
                {UNITS.map((u) => (
                  <option key={u.key} value={u.key}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setFrom(to);
              setTo(from);
              if (valid) setValue(String(Number(main.toFixed(4))));
            }}
            className="mx-auto grid h-11 w-11 place-items-center rounded-full border border-slate-300 text-slate-600 hover:border-primary hover:text-primary md:mb-0.5"
            aria-label="Swap units"
            title="Swap"
          >
            <ArrowLeftRight className="h-5 w-5 rotate-90 md:rotate-0" />
          </button>
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-slate-600" htmlFor="ac-to">
              Equals
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => valid && copy(`${nice(main)} ${unitDef(to).short}`)}
                className={cn(field, 'flex items-center justify-between bg-slate-50 text-left font-bold')}
                title="Copy"
              >
                <span className="truncate">{valid ? nice(main) : '—'}</span>
                <Copy className="h-4 w-4 shrink-0 text-slate-400" />
              </button>
              <select id="ac-to" value={to} onChange={(e) => setTo(e.target.value as UnitKey)} className={cn(field, 'w-[150px] shrink-0 text-[15px]')}>
                {UNITS.map((u) => (
                  <option key={u.key} value={u.key}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="hide-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          {QUICK.map((q) => {
            const on = n === q.v && from === q.u;
            return (
              <button
                key={q.label}
                type="button"
                onClick={() => {
                  setValue(String(q.v));
                  setFrom(q.u);
                }}
                className={cn(
                  'btn-shape shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors',
                  on ? 'border-primary bg-primary text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-primary/50',
                )}
              >
                {q.label}
              </button>
            );
          })}
        </div>

        {/* Which marla */}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
          <span className="shrink-0 text-[13px] font-semibold text-slate-600">1 Marla =</span>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1" role="radiogroup" aria-label="Marla size">
            {MARLA_STANDARDS.map((m) => (
              <button
                key={m.sqft}
                type="button"
                role="radio"
                aria-checked={marla === m.sqft}
                onClick={() => setMarla(m.sqft)}
                title={m.hint}
                className={cn('rounded-lg px-3 py-1.5 text-[13.5px] font-bold tabular-nums transition-colors', marla === m.sqft ? 'bg-white text-primary shadow-sm' : 'text-slate-600 hover:text-slate-900')}
              >
                {m.label}
              </button>
            ))}
          </div>
          <span className="text-[12px] text-slate-500">{MARLA_STANDARDS.find((m) => m.sqft === marla)?.hint}</span>
        </div>
      </section>

      {/* Every unit at once */}
      <section>
        <h2 className="mb-2.5 text-[18px] font-bold text-slate-900">
          {valid ? `${nice(n)} ${unitDef(from).label} in every unit` : 'Every unit'}
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {results.map(({ u, v }) => (
            <button
              key={u.key}
              type="button"
              onClick={() => valid && copy(`${nice(v)} ${u.short}`)}
              className={cn(
                'group rounded-xl border bg-white p-3 text-left transition-colors hover:border-primary/50',
                u.key === from ? 'border-primary/50 ring-1 ring-primary/20' : 'border-slate-200',
              )}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="text-[19px] font-extrabold tabular-nums text-slate-900 [overflow-wrap:anywhere]">{valid ? nice(v) : '—'}</span>
                <Copy className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-300 group-hover:text-primary" />
              </span>
              <span className="block text-[13px] font-semibold text-slate-600">{u.label}</span>
              {u.hint && <span className="block text-[11.5px] text-slate-400">{u.hint}</span>}
              {u.local && marla !== 225 && <span className="block text-[11.5px] text-amber-700">on {nice(marla)} sq ft marla</span>}
            </button>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2">
        {/* Length × width */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <h2 className="text-[18px] font-bold text-slate-900">Plot size from length × width</h2>
          <p className="text-[13.5px] text-slate-500">Front and depth in feet — e.g. 25 × 45.</p>
          <div className="mt-3 flex items-center gap-2">
            <input type="number" inputMode="decimal" min="0" value={len} onChange={(e) => setLen(e.target.value)} className={field} aria-label="Length in feet" />
            <span className="text-[18px] font-bold text-slate-400">×</span>
            <input type="number" inputMode="decimal" min="0" value={wid} onChange={(e) => setWid(e.target.value)} className={field} aria-label="Width in feet" />
            <span className="text-[14px] text-slate-500">ft</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {DIMENSIONS.map(([a, b]) => (
              <button
                key={`${a}x${b}`}
                type="button"
                onClick={() => {
                  setLen(String(a));
                  setWid(String(b));
                }}
                className="btn-shape rounded-full border border-slate-200 px-2.5 py-1 text-[12.5px] font-medium text-slate-600 hover:border-primary/50"
              >
                {a} × {b}
              </button>
            ))}
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-center">
            {[
              { k: 'Square feet', v: nice(dimSqft) },
              { k: 'Marla', v: nice(dimSqft / marla) },
              { k: 'Kanal', v: nice(dimSqft / (marla * 20)) },
              { k: 'Square yards', v: nice(dimSqft / 9) },
            ].map((r) => (
              <div key={r.k} className="rounded-xl bg-slate-50 px-2 py-2.5">
                <dt className="text-[12px] text-slate-500">{r.k}</dt>
                <dd className="text-[18px] font-extrabold tabular-nums text-slate-900">{dimSqft > 0 ? r.v : '—'}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Common sizes */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <h2 className="text-[18px] font-bold text-slate-900">Common plot sizes</h2>
          <p className="text-[13.5px] text-slate-500">On the {nice(marla)} sq ft marla.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[340px] text-[14px]">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[12px] uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-2 font-semibold">Size</th>
                  <th className="py-2 pr-2 text-right font-semibold">Sq ft</th>
                  <th className="py-2 pr-2 text-right font-semibold">Sq yd</th>
                  <th className="py-2 text-right font-semibold">Sq m</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {SIZES.map((s) => {
                  const sqft = convert(s.v, s.u, 'sqft', marla);
                  return (
                    <tr key={`${s.v}${s.u}`} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-2 font-semibold text-slate-800">
                        {s.v} {s.u === 'kanal' ? 'Kanal' : 'Marla'}
                      </td>
                      <td className="py-2 pr-2 text-right">{nice(sqft)}</td>
                      <td className="py-2 pr-2 text-right">{nice(sqft / 9)}</td>
                      <td className="py-2 text-right">{nice(sqft / 10.7639104)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { rentalYield, rsShort, rupees } from '@/lib/tools';
import { cn } from '@/lib/utils';
import { Answer, MoneyField, NumberField, Panel } from './fields';

/** Colour-blind-safe series colours (rent, price rise, bank). */
const SERIES = ['#2a78d6', '#eb6834', '#1baf7a'];

export default function YieldCalculator() {
  const [price, setPrice] = useState(20_000_000);
  const [rent, setRent] = useState(80_000);
  const [more, setMore] = useState(false);
  const [buyingCostPct, setBuyingCostPct] = useState(4);
  const [vacancyMonths, setVacancyMonths] = useState(1);
  const [expenses, setExpenses] = useState(60_000);
  const [growthPct, setGrowthPct] = useState(8);
  const [rentGrowthPct, setRentGrowthPct] = useState(10);
  const [years, setYears] = useState(5);
  const [bankPct, setBankPct] = useState(10);

  const r = rentalYield({ price, buyingCostPct, rent, vacancyMonths, expenses, growthPct, rentGrowthPct, years, bankPct });
  const verdict =
    r.net >= 6
      ? { t: 'A strong rental return.', c: 'bg-emerald-50 text-emerald-800' }
      : r.net >= 4
        ? { t: 'A fair rental return.', c: 'bg-sky-50 text-sky-800' }
        : { t: 'The rent is low for the price.', c: 'bg-amber-50 text-amber-900' };

  // After N years: what the property earns (rent + price rise) against a bank deposit.
  const rentPart = Math.max(0, r.rentTotal);
  const pricePart = Math.max(0, r.value - r.invested);
  const max = Math.max(rentPart + pricePart, r.bank, 1);
  const bars = [
    {
      label: 'This property',
      total: r.gain,
      parts: [
        { label: 'Rent, after costs', value: rentPart, color: SERIES[0]! },
        { label: 'Price rise', value: pricePart, color: SERIES[1]! },
      ],
    },
    { label: 'Same money in a bank', total: r.bank, parts: [{ label: 'Bank profit', value: r.bank, color: SERIES[2]! }] },
  ];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start">
      <Panel className="space-y-4 lg:sticky lg:top-20">
        <MoneyField id="ry-price" label="Property price" value={price} onChange={setPrice} />
        <MoneyField id="ry-rent" label="Monthly rent" value={rent} onChange={setRent} />
        <button type="button" onClick={() => setMore((v) => !v)} className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-primary hover:underline" aria-expanded={more}>
          <SlidersHorizontal className="h-4 w-4" /> {more ? 'Fewer assumptions' : 'Change the assumptions'}
        </button>
        {more && (
          <div className="space-y-4 border-t border-slate-100 pt-4">
            <NumberField id="ry-buy" label="Buying costs" value={buyingCostPct} onChange={setBuyingCostPct} suffix="%" max={20} hint="Transfer fee, stamp duty, taxes, commission" />
            <MoneyField id="ry-exp" label="Yearly costs" value={expenses} onChange={setExpenses} hint="Repairs, property tax, society charges" />
            <div className="grid grid-cols-2 gap-3">
              <NumberField id="ry-vac" label="Empty months" value={vacancyMonths} onChange={setVacancyMonths} suffix="/ yr" max={12} />
              <NumberField id="ry-years" label="Keep it for" value={years} onChange={(n) => setYears(Math.max(1, Math.round(n)))} suffix="years" min={1} max={30} step={1} />
              <NumberField id="ry-g" label="Price rise" value={growthPct} onChange={setGrowthPct} suffix="% / yr" max={50} />
              <NumberField id="ry-rg" label="Rent rise" value={rentGrowthPct} onChange={setRentGrowthPct} suffix="% / yr" max={50} />
            </div>
            <NumberField id="ry-bank" label="Bank deposit rate" value={bankPct} onChange={setBankPct} suffix="% / yr" max={40} />
          </div>
        )}
      </Panel>

      <div className="min-w-0 space-y-4">
        <Answer
          label="Rental yield, after costs"
          value={`${r.net.toFixed(1)}% a year`}
          sentence={
            <>
              The rent brings in <b>{rupees(r.netYear)}</b> a year after costs and empty months — the property would pay for itself in{' '}
              <b>{Number.isFinite(r.payback) ? `${r.payback.toFixed(0)} years` : '—'}</b> from rent alone.
            </>
          }
        >
          {price > 0 && rent > 0 && (
            <p className={cn('mt-4 rounded-xl px-4 py-3 text-[14px]', verdict.c)}>
              <b>{verdict.t}</b> Homes in Pakistan usually rent for 3–6% of their price a year (before costs: {r.gross.toFixed(1)}% here).
            </p>
          )}
        </Answer>

        <Panel>
          <h2 className="text-[17px] font-bold text-slate-900">After {years} years</h2>
          <p className="text-[13.5px] text-slate-500">What you gain on {rsShort(r.invested)}, against keeping it in a bank.</p>
          <div className="mt-4 space-y-4">
            {bars.map((b) => (
              <div key={b.label}>
                <div className="flex items-baseline justify-between gap-3 text-[14px]">
                  <span className="font-semibold text-slate-700">{b.label}</span>
                  <b className="tabular-nums text-slate-900">{rsShort(b.total)}</b>
                </div>
                <div className="mt-1.5 flex h-6 gap-[2px] overflow-hidden rounded-md bg-slate-100">
                  {b.parts.map((p) => (
                    <div key={p.label} title={`${p.label}: ${rupees(p.value)}`} style={{ width: `${(p.value / max) * 100}%`, background: p.color }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-slate-600">
            {[...bars[0]!.parts, ...bars[1]!.parts].map((p) => (
              <li key={p.label} className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: p.color }} /> {p.label} <b className="tabular-nums text-slate-800">{rsShort(p.value)}</b>
              </li>
            ))}
          </ul>
          <p className={cn('mt-4 rounded-xl px-4 py-3 text-[14px] font-semibold', r.gain > r.bank ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900')}>
            {r.gain > r.bank
              ? `The property earns ${rsShort(r.gain - r.bank)} more than a bank deposit.`
              : `A bank deposit would earn ${rsShort(r.bank - r.gain)} more — the price may be high for the rent.`}
          </p>
        </Panel>
      </div>
    </div>
  );
}

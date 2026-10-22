'use client';

import { useState } from 'react';
import { amountShort } from '@/lib/pk';
import { rentalYield, rupees } from '@/lib/tools';
import { cn } from '@/lib/utils';
import { MoneyField, NumberField, Panel, Stat } from './fields';

export default function YieldCalculator() {
  const [price, setPrice] = useState(20_000_000);
  const [buyingCostPct, setBuyingCostPct] = useState(4);
  const [rent, setRent] = useState(80_000);
  const [vacancyMonths, setVacancyMonths] = useState(1);
  const [expenses, setExpenses] = useState(60_000);
  const [growthPct, setGrowthPct] = useState(8);
  const [rentGrowthPct, setRentGrowthPct] = useState(10);
  const [years, setYears] = useState(5);
  const [bankPct, setBankPct] = useState(10);

  const r = rentalYield({ price, buyingCostPct, rent, vacancyMonths, expenses, growthPct, rentGrowthPct, years, bankPct });
  const verdict = r.net >= 6 ? { t: 'Strong rental return', c: 'text-emerald-700 bg-emerald-50' } : r.net >= 4 ? { t: 'A fair rental return', c: 'text-sky-700 bg-sky-50' } : { t: 'Low rent for the price', c: 'text-amber-800 bg-amber-50' };
  const beatsBank = r.gain > r.bank;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:items-start">
      <Panel className="space-y-4">
        <MoneyField id="ry-price" label="Property price" value={price} onChange={setPrice} />
        <NumberField id="ry-buy" label="Buying costs" value={buyingCostPct} onChange={setBuyingCostPct} suffix="%" max={20} hint="Transfer fee, stamp duty, taxes and commission" />
        <MoneyField id="ry-rent" label="Monthly rent" value={rent} onChange={setRent} />
        <div className="grid grid-cols-2 gap-3">
          <NumberField id="ry-vac" label="Empty months" value={vacancyMonths} onChange={setVacancyMonths} suffix="/ year" max={12} />
          <NumberField id="ry-years" label="Hold for" value={years} onChange={(n) => setYears(Math.max(1, Math.round(n)))} suffix="years" min={1} max={30} step={1} />
        </div>
        <MoneyField id="ry-exp" label="Yearly costs" value={expenses} onChange={setExpenses} hint="Repairs, property tax, society charges" />
        <div className="grid grid-cols-2 gap-3">
          <NumberField id="ry-g" label="Price growth" value={growthPct} onChange={setGrowthPct} suffix="% / yr" max={50} />
          <NumberField id="ry-rg" label="Rent rise" value={rentGrowthPct} onChange={setRentGrowthPct} suffix="% / yr" max={50} />
        </div>
        <NumberField id="ry-bank" label="Bank deposit rate" value={bankPct} onChange={setBankPct} suffix="% / yr" max={40} hint="To compare: what the money would earn in a bank" />
      </Panel>

      <div className="min-w-0 space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <Stat strong label="Net rental yield" value={`${r.net.toFixed(2)}%`} sub={`${rupees(r.netYear)} a year after costs`} />
          <Stat label="Gross rental yield" value={`${r.gross.toFixed(2)}%`} sub={`${rupees(r.grossYear)} rent a year`} />
          <Stat label="Pays for itself in" value={Number.isFinite(r.payback) ? `${r.payback.toFixed(1)} years` : '—'} sub="from rent alone" />
          <Stat label={`Total return in ${years} years`} value={`${r.roi.toFixed(0)}%`} sub={`${r.yearly.toFixed(1)}% a year, with price growth`} />
        </div>
        {price > 0 && rent > 0 && <p className={cn('rounded-xl px-4 py-3 text-[14px] font-semibold', verdict.c)}>{verdict.t} — homes in Pakistan usually rent for 3–6% of their price a year.</p>}

        <Panel>
          <h3 className="text-[16px] font-bold text-slate-900">After {years} years</h3>
          <dl className="mt-2 divide-y divide-slate-100 text-[14px]">
            {[
              ['Money put in', rupees(r.invested)],
              ['Rent collected, after costs', rupees(r.rentTotal)],
              ['Property worth', `${rupees(r.value)} (${amountShort(r.value)})`],
              ['Your gain', rupees(r.gain)],
              ['Same money in a bank would earn', rupees(r.bank)],
            ].map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-3 py-2">
                <dt className="text-slate-600">{k}</dt>
                <dd className="text-right font-semibold tabular-nums text-slate-900">{v}</dd>
              </div>
            ))}
          </dl>
          <p className={cn('mt-3 rounded-lg px-3 py-2 text-[13.5px] font-semibold', beatsBank ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800')}>
            {beatsBank
              ? `The property earns ${rupees(r.gain - r.bank)} more than a bank deposit.`
              : `A bank deposit would earn ${rupees(r.bank - r.gain)} more — the price may be high for the rent.`}
          </p>
        </Panel>
      </div>
    </div>
  );
}

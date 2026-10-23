'use client';

import { useState } from 'react';
import { rentalYield, rsShort, rupees } from '@/lib/tools';
import { cn } from '@/lib/utils';
import { Card, Disclosure, MoneyField, ResultHero, Row, SliderField, StickyAnswer, Tiles, ToolLayout, useOnScreen } from './ui';

/** Colour-blind-safe series colours (rent, price rise, bank). */
const SERIES = ['#2a78d6', '#eb6834', '#1baf7a'];
const PRICE_CHIPS = [10_000_000, 20_000_000, 35_000_000, 50_000_000, 100_000_000];
const RENT_CHIPS = [40_000, 75_000, 120_000, 200_000, 350_000];
/** A fair rental yield for homes in Pakistan, after costs. */
const FAIR = 5;

export default function YieldCalculator() {
  const [price, setPrice] = useState(20_000_000);
  const [rent, setRent] = useState(80_000);
  const [buyingCostPct, setBuyingCostPct] = useState(4);
  const [vacancyMonths, setVacancyMonths] = useState(1);
  const [expenses, setExpenses] = useState(60_000);
  const [growthPct, setGrowthPct] = useState(8);
  const [rentGrowthPct, setRentGrowthPct] = useState(10);
  const [years, setYears] = useState(5);
  const [bankPct, setBankPct] = useState(10);
  const [heroRef, heroOn] = useOnScreen<HTMLElement>();

  const r = rentalYield({ price, buyingCostPct, rent, vacancyMonths, expenses, growthPct, rentGrowthPct, years, bankPct });
  const verdict =
    r.net >= 6
      ? { t: 'A strong rental return', c: 'bg-emerald-50 text-emerald-800 border-emerald-300' }
      : r.net >= 4
        ? { t: 'A fair rental return', c: 'bg-sky-50 text-sky-800 border-sky-300' }
        : { t: 'The rent is low for the price', c: 'bg-amber-50 text-amber-900 border-amber-300' };

  // What would make it a fair (5% net) deal.
  const occupied = Math.max(0, 12 - vacancyMonths);
  const fairRent = occupied ? ((r.invested * FAIR) / 100 + expenses) / occupied : 0;
  const fairPrice = r.netYear > 0 ? (r.netYear / (FAIR / 100)) / (1 + buyingCostPct / 100) : 0;

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
    <>
      <StickyAnswer show={!heroOn} label="Rental yield after costs" value={`${r.net.toFixed(1)}%`} onTap={() => (heroRef.current as HTMLElement | null)?.scrollIntoView({ behavior: 'smooth', block: 'center' })} />
      <ToolLayout
        inputs={
          <>
            <Card>
              <div className="space-y-5">
                <MoneyField label="Property price" value={price} onChange={setPrice} chips={PRICE_CHIPS} />
                <MoneyField label="Monthly rent" value={rent} onChange={setRent} chips={RENT_CHIPS} />
              </div>
            </Card>
            <Disclosure title="Costs & assumptions" sub="Buying costs, empty months, price growth…">
              <div className="space-y-5 pt-1">
                <SliderField label="Buying costs" value={buyingCostPct} onChange={setBuyingCostPct} min={0} max={12} step={0.5} suffix="%" hint="Transfer, taxes, commission" />
                <MoneyField label="Yearly running costs" value={expenses} onChange={setExpenses} hint="Repairs, property tax, society charges" />
                <SliderField label="Empty months a year" value={vacancyMonths} onChange={setVacancyMonths} min={0} max={6} step={0.5} suffix="mo" />
                <SliderField label="Price rise a year" value={growthPct} onChange={setGrowthPct} min={0} max={25} step={0.5} suffix="%" />
                <SliderField label="Rent rise a year" value={rentGrowthPct} onChange={setRentGrowthPct} min={0} max={25} step={0.5} suffix="%" />
                <SliderField label="Keep it for" value={years} onChange={setYears} min={1} max={20} step={1} suffix="yrs" />
                <SliderField label="Bank deposit rate" value={bankPct} onChange={setBankPct} min={0} max={25} step={0.5} suffix="%" hint="To compare against" />
              </div>
            </Disclosure>
          </>
        }
        results={
          <>
            <ResultHero heroRef={heroRef} label="Rental yield after costs" value={`${r.net.toFixed(1)}% a year`} sub={`${rupees(r.netYear)} a year in hand · ${r.gross.toFixed(1)}% before costs`}>
              <Tiles
                onBrand
                items={[
                  { label: 'Pays back in', value: Number.isFinite(r.payback) ? `${r.payback.toFixed(0)} yrs` : '—' },
                  { label: `Return in ${years} yrs`, value: `${r.roi.toFixed(0)}%` },
                  { label: 'A year, overall', value: `${r.yearly.toFixed(1)}%` },
                ]}
              />
            </ResultHero>

            {price > 0 && rent > 0 && (
              <p className={cn('rounded-lg px-4 py-3 text-[14px] border', verdict.c)}>
                <b>{verdict.t}.</b> Homes in Pakistan usually earn 3–6% a year from rent.
              </p>
            )}

            <Card title="What would be fair">
              <div className="divide-y divide-slate-100">
                <Row label="Rent for a 5% return" note="At this price, after costs" value={`${rsShort(fairRent)}/mo`} />
                <Row label="Price for a 5% return" note="At this rent, after costs" value={rsShort(fairPrice)} />
              </div>
            </Card>

            <Card title={`After ${years} years`}>
              <p className="-mt-2 mb-3 text-[13px] text-slate-600">What you gain on {rsShort(r.invested)}, against a bank deposit.</p>
              <div className="space-y-4">
                {bars.map((b) => (
                  <div key={b.label}>
                    <div className="flex items-baseline justify-between gap-3 text-[14px]">
                      <span className="font-semibold text-slate-700">{b.label}</span>
                      <b className="tabular-nums text-slate-900">{rsShort(b.total)}</b>
                    </div>
                    <div className="mt-1.5 flex h-5 gap-[2px] overflow-hidden rounded-lg bg-slate-100">
                      {b.parts.map((p) => (
                        <div key={p.label} title={`${p.label}: ${rupees(p.value)}`} style={{ width: `${(p.value / max) * 100}%`, background: p.color }} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-slate-600">
                {[...bars[0]!.parts, ...bars[1]!.parts].map((p) => (
                  <li key={p.label} className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: p.color }} /> {p.label} <b className="tabular-nums text-slate-800">{rsShort(p.value)}</b>
                  </li>
                ))}
              </ul>
              <p className={cn('mt-4 rounded-lg px-4 py-3 text-[14px] font-semibold', r.gain > r.bank ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900')}>
                {r.gain > r.bank
                  ? `The property earns ${rsShort(r.gain - r.bank)} more than a bank deposit.`
                  : `A bank deposit would earn ${rsShort(r.bank - r.gain)} more.`}
              </p>
            </Card>
          </>
        }
      />
    </>
  );
}

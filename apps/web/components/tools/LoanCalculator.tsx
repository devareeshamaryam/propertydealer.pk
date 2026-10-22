'use client';

import { useState } from 'react';
import { amountShort } from '@/lib/pk';
import { amortisation, emi, rupees } from '@/lib/tools';
import { MoneyField, NumberField, Panel, Stat } from './fields';

export default function LoanCalculator() {
  const [price, setPrice] = useState(15_000_000);
  const [downPct, setDownPct] = useState(30);
  const [rate, setRate] = useState(15);
  const [years, setYears] = useState(20);
  const [showAll, setShowAll] = useState(false);

  const loan = Math.max(0, price * (1 - downPct / 100));
  const months = Math.round(years * 12);
  const pay = emi(loan, rate, months);
  const total = pay * months;
  const interest = total - loan;
  const table = amortisation(loan, rate, months);
  const rows = showAll ? table : table.slice(0, 5);
  const interestShare = total ? (interest / total) * 100 : 0;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:items-start">
      <Panel className="space-y-4">
        <MoneyField id="ln-price" label="Property price" value={price} onChange={setPrice} />
        <NumberField id="ln-down" label="Down payment" value={downPct} onChange={setDownPct} suffix="%" max={95} hint={`${rupees((price * downPct) / 100)} — banks usually ask for 15–30%`} />
        <NumberField id="ln-rate" label="Profit / interest rate" value={rate} onChange={setRate} suffix="% a year" max={60} hint="KIBOR plus the bank's margin — check your bank's rate today" />
        <NumberField id="ln-years" label="Loan term" value={years} onChange={setYears} suffix="years" min={1} max={30} step={1} hint="Up to 20–25 years at most banks" />
      </Panel>

      <div className="min-w-0 space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <Stat strong label="Monthly instalment" value={rupees(pay)} sub={`for ${months} months`} />
          <Stat label="Loan amount" value={rupees(loan)} sub={amountShort(loan)} />
          <Stat label="Total interest" value={rupees(interest)} sub={`${interestShare.toFixed(0)}% of what you repay`} />
          <Stat label="Income banks look for" value={rupees(pay / 0.4)} sub="a month — the instalment is kept under ~40% of income" />
        </div>

        <Panel>
          <div className="flex h-3 overflow-hidden rounded-full bg-slate-100" aria-hidden>
            <div className="bg-primary" style={{ width: `${100 - interestShare}%` }} />
            <div className="bg-amber-400" style={{ width: `${interestShare}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap justify-between gap-2 text-[13px] text-slate-600">
            <span>
              <i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-primary" /> Loan {rupees(loan)}
            </span>
            <span>
              <i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-amber-400" /> Interest {rupees(interest)}
            </span>
          </div>
        </Panel>

        <Panel>
          <h3 className="text-[16px] font-bold text-slate-900">Year by year</h3>
          <div className="-mx-4 mt-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[440px] text-[13.5px] tabular-nums">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11.5px] uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-2 font-semibold">Year</th>
                  <th className="py-2 pr-2 text-right font-semibold">Principal</th>
                  <th className="py-2 pr-2 text-right font-semibold">Interest</th>
                  <th className="py-2 text-right font-semibold">Still owed</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.year} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-2 font-semibold text-slate-700">{r.year}</td>
                    <td className="py-2 pr-2 text-right">{rupees(r.principal)}</td>
                    <td className="py-2 pr-2 text-right text-amber-700">{rupees(r.interest)}</td>
                    <td className="py-2 text-right">{rupees(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {table.length > 5 && (
            <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-2 text-[13.5px] font-semibold text-primary hover:underline">
              {showAll ? 'Show less' : `Show all ${table.length} years`}
            </button>
          )}
        </Panel>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { amortisation, emi, rsShort, rupees } from '@/lib/tools';
import { Answer, MoneyField, More, NumberField, Panel } from './fields';

export default function LoanCalculator() {
  const [price, setPrice] = useState(15_000_000);
  const [downPct, setDownPct] = useState(30);
  const [rate, setRate] = useState(15);
  const [years, setYears] = useState(20);

  const down = (price * downPct) / 100;
  const loan = Math.max(0, price - down);
  const months = Math.round(years * 12);
  const pay = emi(loan, rate, months);
  const total = pay * months;
  const interest = Math.max(0, total - loan);
  const table = amortisation(loan, rate, months);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start">
      <Panel className="space-y-4 lg:sticky lg:top-20">
        <MoneyField id="ln-price" label="Property price" value={price} onChange={setPrice} />
        <NumberField id="ln-down" label="Your down payment" value={downPct} onChange={setDownPct} suffix="%" max={95} hint={`${rupees(down)} — banks usually ask for 15–30%`} />
        <NumberField id="ln-rate" label="Bank's yearly rate" value={rate} onChange={setRate} suffix="%" max={60} hint="KIBOR + the bank's margin — ask your bank for today's" />
        <NumberField id="ln-years" label="Years to repay" value={years} onChange={setYears} suffix="years" min={1} max={30} step={1} />
      </Panel>

      <div className="min-w-0 space-y-4">
        <Answer
          label="Monthly instalment"
          value={rupees(pay)}
          sentence={
            <>
              Borrow <b>{rsShort(loan)}</b> and pay <b>{rupees(pay)}</b> a month for {years} years — <b>{rsShort(total)}</b> in all, of which{' '}
              <b>{rsShort(interest)}</b> is the bank&apos;s profit.
            </>
          }
        >
          <dl className="mt-4 grid grid-cols-3 gap-2">
            {[
              ['Loan', rsShort(loan)],
              ['You repay', rsShort(total)],
              ["Bank's profit", rsShort(interest)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-slate-50 px-2 py-2.5 text-center">
                <dt className="text-[11.5px] text-slate-500">{k}</dt>
                <dd className="text-[14px] font-bold tabular-nums text-slate-900 sm:text-[15px]">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[13.5px] text-slate-600">
            Banks usually want a monthly income of at least <b className="tabular-nums text-slate-900">{rupees(pay / 0.4)}</b> for this instalment.
          </p>
        </Answer>


        <More title="Year by year">
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[420px] text-[13.5px] tabular-nums">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11.5px] uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-2 font-semibold">Year</th>
                  <th className="py-2 pr-2 text-right font-semibold">Loan repaid</th>
                  <th className="py-2 pr-2 text-right font-semibold">Profit paid</th>
                  <th className="py-2 text-right font-semibold">Still owed</th>
                </tr>
              </thead>
              <tbody>
                {table.map((r) => (
                  <tr key={r.year} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-2 font-semibold text-slate-700">{r.year}</td>
                    <td className="py-2 pr-2 text-right">{rupees(r.principal)}</td>
                    <td className="py-2 pr-2 text-right">{rupees(r.interest)}</td>
                    <td className="py-2 text-right">{rupees(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </More>
      </div>
    </div>
  );
}

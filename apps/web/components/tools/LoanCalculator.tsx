'use client';

import { useState } from 'react';
import { amortisation, emi, rsShort, rupees } from '@/lib/tools';
import { Card, Disclosure, MoneyField, ResultHero, Row, Segment, SliderField, StickyAnswer, Tiles, ToolLayout, useOnScreen } from './ui';

const PRICE_CHIPS = [5_000_000, 10_000_000, 15_000_000, 25_000_000, 50_000_000];
const INCOME_CHIPS = [150_000, 250_000, 400_000, 600_000, 1_000_000];

/** The most a payment buys: the loan whose instalment it is. */
function loanFor(payment: number, annualRate: number, months: number) {
  if (payment <= 0 || months <= 0) return 0;
  const r = annualRate / 100 / 12;
  return r === 0 ? payment * months : (payment * (1 - Math.pow(1 + r, -months))) / r;
}

export default function LoanCalculator() {
  const [mode, setMode] = useState<'emi' | 'afford'>('emi');
  const [price, setPrice] = useState(15_000_000);
  const [downPct, setDownPct] = useState(25);
  const [rate, setRate] = useState(15);
  const [years, setYears] = useState(20);
  const [income, setIncome] = useState(400_000);
  const [share, setShare] = useState(40);
  const [debts, setDebts] = useState(0);
  const [heroRef, heroOn] = useOnScreen<HTMLElement>();

  const months = Math.round(years * 12);

  // Instalment
  const down = (price * downPct) / 100;
  const loan = Math.max(0, price - down);
  const pay = emi(loan, rate, months);
  const total = pay * months;
  const profit = Math.max(0, total - loan);
  const payIfUp = emi(loan, rate + 2, months);
  const table = amortisation(loan, rate, months);

  // Affordability
  const room = Math.max(0, (income * share) / 100 - debts);
  const maxLoan = loanFor(room, rate, months);
  const maxPrice = downPct < 100 ? maxLoan / (1 - downPct / 100) : 0;
  const needDown = maxPrice - maxLoan;

  const answer = mode === 'emi' ? { label: 'Monthly instalment', value: rupees(pay) } : { label: 'You can borrow up to', value: rsShort(maxLoan) };

  return (
    <>
      <StickyAnswer show={!heroOn} label={answer.label} value={answer.value} onTap={() => (heroRef.current as HTMLElement | null)?.scrollIntoView({ behavior: 'smooth', block: 'center' })} />
      <ToolLayout
        inputs={
          <>
            <Segment
              value={mode}
              onChange={setMode}
              options={[
                { v: 'emi', label: 'Monthly instalment' },
                { v: 'afford', label: 'How much can I borrow' },
              ]}
            />
            <Card>
              <div className="space-y-5">
                {mode === 'emi' ? (
                  <MoneyField label="Property price" value={price} onChange={setPrice} chips={PRICE_CHIPS} />
                ) : (
                  <>
                    <MoneyField label="Your monthly income (take-home)" value={income} onChange={setIncome} chips={INCOME_CHIPS} />
                    <MoneyField label="Other loan instalments a month" value={debts} onChange={setDebts} hint="Car, personal or card instalments — banks count them." />
                    <SliderField label="Share of income for the instalment" value={share} onChange={setShare} min={20} max={50} step={5} suffix="%" hint="Most banks allow about 40%" />
                  </>
                )}
                <SliderField
                  label="Your down payment"
                  value={downPct}
                  onChange={setDownPct}
                  min={10}
                  max={90}
                  step={5}
                  suffix="%"
                  hint={mode === 'emi' ? rsShort(down) : 'Banks ask for 15–30%'}
                />
                <SliderField label="Bank's yearly rate" value={rate} onChange={setRate} min={5} max={30} step={0.25} suffix="%" hint="KIBOR + the bank's margin" />
                <SliderField label="Repay over" value={years} onChange={setYears} min={1} max={25} step={1} suffix="yrs" />
              </div>
            </Card>
          </>
        }
        results={
          mode === 'emi' ? (
            <>
              <ResultHero heroRef={heroRef} label="Monthly instalment" value={rupees(pay)} sub={`${months} instalments to repay a ${rsShort(loan)} loan`}>
                <Tiles
                  onBrand
                  items={[
                    { label: 'You repay', value: rsShort(total) },
                    { label: "Bank's profit", value: rsShort(profit) },
                    { label: 'Down payment', value: rsShort(down) },
                  ]}
                />
              </ResultHero>
              <Card title="Good to know">
                <div className="divide-y divide-slate-100">
                  <Row label="Income banks look for" note="The instalment kept under ~40% of take-home pay" value={`${rupees(pay / 0.4)}/mo`} />
                  <Row label="If the rate rises 2%" note="Home loans float with KIBOR, reset yearly" value={`${rupees(payIfUp)}/mo`} />
                  <Row label="Profit as a share of what you repay" value={`${total ? Math.round((profit / total) * 100) : 0}%`} />
                  <Row label="Loan to value" note="What the bank finances" value={`${100 - downPct}%`} />
                </div>
              </Card>
              <Disclosure title="Year by year" sub="How much of each year's payments clears the loan">
                <div className="-mx-1 overflow-x-auto">
                  <table className="w-full min-w-[400px] text-[13.5px] tabular-nums">
                    <thead>
                      <tr className="text-left text-[11.5px] uppercase tracking-wide text-slate-400">
                        <th className="py-2 pr-2 font-semibold">Year</th>
                        <th className="py-2 pr-2 text-right font-semibold">Loan repaid</th>
                        <th className="py-2 pr-2 text-right font-semibold">Profit</th>
                        <th className="py-2 text-right font-semibold">Still owed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {table.map((r) => (
                        <tr key={r.year} className="border-t border-slate-100">
                          <td className="py-2 pr-2 font-semibold text-slate-700">{r.year}</td>
                          <td className="py-2 pr-2 text-right">{rsShort(r.principal)}</td>
                          <td className="py-2 pr-2 text-right text-slate-500">{rsShort(r.interest)}</td>
                          <td className="py-2 text-right">{rsShort(r.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Disclosure>
            </>
          ) : (
            <>
              <ResultHero heroRef={heroRef} label="You can borrow up to" value={rsShort(maxLoan)} sub={room > 0 ? `With an instalment of ${rupees(room)} a month for ${years} years` : 'Your other instalments already use this share of your income'}>
                <Tiles
                  onBrand
                  items={[
                    { label: 'Home you can buy', value: rsShort(maxPrice) },
                    { label: 'Down payment needed', value: rsShort(needDown) },
                    { label: 'Instalment', value: `${rsShort(room)}/mo` },
                  ]}
                />
              </ResultHero>
              <Card title="Good to know">
                <div className="divide-y divide-slate-100">
                  <Row label="Bank's profit over the loan" value={rsShort(Math.max(0, room * months - maxLoan))} />
                  <Row label="At 2% more" note="If KIBOR rises before you apply" value={rsShort(loanFor(room, rate + 2, months))} />
                  <Row label="Over 5 more years" note="A longer loan lends more, but costs more profit" value={years + 5 <= 30 ? rsShort(loanFor(room, rate, (years + 5) * 12)) : '—'} />
                </div>
              </Card>
            </>
          )
        }
      />
    </>
  );
}

'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import { amountShort } from '@/lib/pk';
import { installmentPlan, rupees, type Frequency } from '@/lib/tools';
import { cn } from '@/lib/utils';
import { MoneyField, NumberField, Panel, Stat } from './fields';

const EVERY: { key: Frequency; label: string; word: string }[] = [
  { key: 1, label: 'Monthly', word: 'month' },
  { key: 3, label: 'Quarterly', word: 'quarter' },
  { key: 6, label: 'Half-yearly', word: 'six months' },
];

export default function InstallmentPlanner() {
  const [price, setPrice] = useState(5_000_000);
  const [downPct, setDownPct] = useState(20);
  const [years, setYears] = useState(3);
  const [every, setEvery] = useState<Frequency>(1);
  const [balloons, setBalloons] = useState(2);
  const [balloonPct, setBalloonPct] = useState(5);
  const [possessionPct, setPossessionPct] = useState(10);
  // Fixed for the session so the dates do not move while typing. The page is
  // cached, so real dates are filled in by the browser, never the server.
  const [start] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const inBrowser = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  const plan = useMemo(
    () => installmentPlan({ price, downPct, months: Math.round(years * 12), every, balloons, balloonPct, possessionPct, start }),
    [price, downPct, years, every, balloons, balloonPct, possessionPct, start],
  );
  const word = EVERY.find((e) => e.key === every)!.word;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:items-start">
      <Panel className="space-y-4">
        <MoneyField id="ip-price" label="Total price" value={price} onChange={setPrice} />
        <div className="grid grid-cols-2 gap-3">
          <NumberField id="ip-down" label="Down payment" value={downPct} onChange={setDownPct} suffix="%" max={100} />
          <NumberField id="ip-years" label="Plan length" value={years} onChange={setYears} suffix="years" min={0.5} max={15} step={0.5} />
        </div>
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-slate-600">Instalments</p>
          <div className="grid grid-cols-3 gap-1.5">
            {EVERY.map((e) => (
              <button
                key={e.key}
                type="button"
                onClick={() => setEvery(e.key)}
                aria-pressed={every === e.key}
                className={cn(
                  'btn-shape rounded-xl border py-2.5 text-[14px] font-bold',
                  every === e.key ? 'border-primary bg-primary text-white' : 'border-slate-200 text-slate-700 hover:border-primary/50',
                )}
              >
                {e.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumberField id="ip-balloons" label="Balloon payments" value={balloons} onChange={(n) => setBalloons(Math.round(n))} max={12} step={1} />
          <NumberField id="ip-bpct" label="Each balloon" value={balloonPct} onChange={setBalloonPct} suffix="%" max={50} />
        </div>
        <NumberField id="ip-poss" label="On possession" value={possessionPct} onChange={setPossessionPct} suffix="%" max={60} hint="Paid when you get the plot or house" />
      </Panel>

      <div className="min-w-0 space-y-4">
        {plan.error ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-[14px] text-red-700">{plan.error}</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <Stat strong label={`Instalment every ${word}`} value={rupees(plan.instalment)} sub={`${plan.count} instalments`} />
            <Stat label="Down payment" value={rupees(plan.down)} sub={amountShort(plan.down)} />
            <Stat label={`${balloons} balloon payment${balloons === 1 ? '' : 's'}`} value={rupees(plan.balloon)} sub={balloons ? 'each' : 'none'} />
            <Stat label="On possession" value={rupees(plan.possession)} sub={amountShort(plan.possession) || '—'} />
          </div>
        )}

        {plan.rows.length > 0 && (
          <Panel>
            <h3 className="text-[16px] font-bold text-slate-900">Payment schedule</h3>
            <div className="-mx-4 mt-2 max-h-[520px] overflow-auto px-4 sm:mx-0 sm:px-0">
              <table className="w-full min-w-[420px] text-[13.5px] tabular-nums">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-slate-200 text-left text-[11.5px] uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-2 font-semibold">Due</th>
                    <th className="py-2 pr-2 font-semibold">Payment</th>
                    <th className="py-2 pr-2 text-right font-semibold">Amount</th>
                    <th className="py-2 text-right font-semibold">Paid so far</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.rows.map((r, i) => (
                    <tr key={i} className={cn('border-b border-slate-100 last:border-0', r.label !== `Instalment ${r.n}` && 'bg-primary/5 font-semibold')}>
                      <td className="whitespace-nowrap py-2 pr-2 text-slate-600">
                        {inBrowser ? r.date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : r.n ? `#${r.n}` : 'Now'}
                      </td>
                      <td className="py-2 pr-2 text-slate-800">{r.label}</td>
                      <td className="py-2 pr-2 text-right">{rupees(r.amount)}</td>
                      <td className="py-2 text-right text-slate-500">{price ? `${Math.round((r.paid / price) * 100)}%` : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}

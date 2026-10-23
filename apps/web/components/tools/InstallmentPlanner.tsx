'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import { installmentPlan, rsShort, rupees, type Frequency } from '@/lib/tools';
import { cn } from '@/lib/utils';
import { Card, Disclosure, MoneyField, ResultHero, Row, Segment, SliderField, Stepper, StickyAnswer, Tiles, ToolLayout, useOnScreen } from './ui';

const EVERY: { v: Frequency; label: string; word: string }[] = [
  { v: 1, label: 'Monthly', word: 'month' },
  { v: 3, label: 'Quarterly', word: 'quarter' },
  { v: 6, label: '6-monthly', word: 'six months' },
];
const PRICE_CHIPS = [2_500_000, 5_000_000, 10_000_000, 20_000_000, 35_000_000];

export default function InstallmentPlanner() {
  const [price, setPrice] = useState(5_000_000);
  const [downPct, setDownPct] = useState(20);
  const [years, setYears] = useState(3);
  const [every, setEvery] = useState<Frequency>(1);
  const [balloons, setBalloons] = useState(2);
  const [balloonPct, setBalloonPct] = useState(5);
  const [possessionPct, setPossessionPct] = useState(10);
  const [heroRef, heroOn] = useOnScreen<HTMLElement>();
  // Fixed for the session so the dates do not move while typing; real dates
  // come from the browser, never a cached server page.
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
  const word = EVERY.find((e) => e.v === every)!.word;
  const last = plan.rows[plan.rows.length - 1];
  const fmtDate = (d: Date) => d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

  return (
    <>
      <StickyAnswer show={!heroOn && !plan.error} label={`Every ${word}`} value={rupees(plan.instalment)} onTap={() => (heroRef.current as HTMLElement | null)?.scrollIntoView({ behavior: 'smooth', block: 'center' })} />
      <ToolLayout
        inputs={
          <>
            <Card>
              <div className="grid gap-5 md:grid-cols-2 md:gap-x-6 [&>*:first-child]:md:col-span-2 [&>*:last-child]:md:col-span-2">
                <MoneyField label="Total price" value={price} onChange={setPrice} chips={PRICE_CHIPS} />
                <SliderField label="Down payment" value={downPct} onChange={setDownPct} min={0} max={60} step={5} suffix="%" hint={rsShort((price * downPct) / 100)} />
                <SliderField label="Plan length" value={years} onChange={setYears} min={1} max={10} step={0.5} suffix="yrs" />
                <Segment label="Instalments" value={every} onChange={setEvery} options={EVERY.map((e) => ({ v: e.v, label: e.label }))} />
              </div>
            </Card>
            <Card title="Lump sums">
              <div className="space-y-4">
                <Stepper label="Balloon payments" sub="Larger payments during the plan" value={balloons} onChange={setBalloons} min={0} max={12} />
                {balloons > 0 && <SliderField label="Each balloon" value={balloonPct} onChange={setBalloonPct} min={1} max={25} step={1} suffix="%" hint={rsShort((price * balloonPct) / 100)} />}
                <SliderField label="On possession" value={possessionPct} onChange={setPossessionPct} min={0} max={40} step={5} suffix="%" hint={rsShort((price * possessionPct) / 100)} />
              </div>
            </Card>
          </>
        }
        summary={
          plan.error ? (
            <p className="rounded-xl bg-red-50 p-5 text-[15px] font-medium text-red-700 border border-red-300">{plan.error}</p>
          ) : (
              <ResultHero
                heroRef={heroRef}
                label={`Every ${word}`}
                value={rupees(plan.instalment)}
                sub={`${plan.count} instalments${inBrowser && last ? `, ending ${fmtDate(last.date)}` : ''}`}
              >
                <Tiles
                  onBrand
                  items={[
                    { label: 'Pay now', value: rsShort(plan.down) },
                    { label: balloons ? `${balloons} balloon${balloons === 1 ? '' : 's'}` : 'Balloons', value: balloons ? rsShort(plan.balloon) : '—', hint: balloons ? 'each' : undefined },
                    { label: 'On possession', value: plan.possession ? rsShort(plan.possession) : '—' },
                  ]}
                />
              </ResultHero>
          )
        }
        details={plan.error ? undefined : (
            <>
              <Card title="How the price is paid">
                <div className="flex h-3 gap-[2px] overflow-hidden rounded-full" aria-hidden>
                  {[
                    { v: plan.down, c: '#2a78d6' },
                    { v: plan.instalment * plan.count, c: '#eb6834' },
                    { v: plan.balloon * balloons, c: '#1baf7a' },
                    { v: plan.possession, c: '#eda100' },
                  ]
                    .filter((x) => x.v > 0)
                    .map((x, i) => (
                      <div key={i} style={{ width: `${(x.v / price) * 100}%`, background: x.c }} />
                    ))}
                </div>
                <div className="mt-2 divide-y divide-slate-100">
                  <Row label={<Dot c="#2a78d6">Down payment</Dot>} value={rsShort(plan.down)} />
                  <Row label={<Dot c="#eb6834">{`${plan.count} instalments`}</Dot>} value={rsShort(plan.instalment * plan.count)} />
                  {balloons > 0 && <Row label={<Dot c="#1baf7a">{`${balloons} balloon payments`}</Dot>} value={rsShort(plan.balloon * balloons)} />}
                  {plan.possession > 0 && <Row label={<Dot c="#eda100">On possession</Dot>} value={rsShort(plan.possession)} />}
                  <Row label="Total" value={rupees(price)} strong />
                </div>
              </Card>

              <Disclosure title="Payment schedule" sub={`${plan.rows.length} payments with their due dates`}>
                <ol className="divide-y divide-slate-100">
                  {plan.rows.map((r, i) => {
                    const special = r.label !== `Instalment ${r.n}`;
                    return (
                      <li key={i} className={cn('flex items-center justify-between gap-3 py-2.5', special && 'font-semibold')}>
                        <span className="min-w-0">
                          <span className="block text-[14px] text-slate-800">{r.label}</span>
                          <span className="block text-[12px] text-slate-600">
                            {inBrowser ? fmtDate(r.date) : r.n ? `#${r.n}` : 'Now'} · {price ? Math.round((r.paid / price) * 100) : 0}% paid
                          </span>
                        </span>
                        <span className="shrink-0 text-[14.5px] tabular-nums text-slate-900">{rupees(r.amount)}</span>
                      </li>
                    );
                  })}
                </ol>
              </Disclosure>
            </>
          )}
      />
    </>
  );
}

function Dot({ c, children }: { c: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: c }} />
      {children}
    </span>
  );
}

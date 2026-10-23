'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ChevronDown, ChevronRight, Info, Link2, Printer, Share2, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { CC_SIZES } from '@/lib/construction-pages';
import { MATERIAL_LABEL, QUALITY, coveredAreas, estimate, rsShort, rupees, usualRooms, type ConstructionData, type EstimatePart, type Material, type Quality } from '@/lib/tools';
import { cn } from '@/lib/utils';
import { Card, ResultHero, Segment, Stepper, StickyAnswer, Tiles, ToolLayout, useOnScreen } from './ui';

type SizeUnit = 'marla' | 'kanal' | 'sqft' | 'sqyd';
const UNIT_SQFT: Record<SizeUnit, number> = { marla: 225, kanal: 4500, sqyd: 9, sqft: 1 };
const QTY_UNIT: Record<Material, string> = { cement: 'bags', steel: 'kg', bricks: 'bricks', sand: 'cft', crush: 'cft' };
const DOT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'];

const n0 = (v: string | null, d: number) => {
  const n = Number(v);
  return v !== null && Number.isFinite(n) && n >= 0 ? n : d;
};

/** A labelled dropdown — the phone's own picker, dressed like the rest. */
function Select<T extends string | number>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: { v: T; label: string }[] }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-[13px] font-semibold text-slate-500">{label}</span>
      <span className="relative block">
        <select
          value={String(value)}
          onChange={(e) => {
            const o = options.find((x) => String(x.v) === e.target.value);
            if (o) onChange(o.v);
          }}
          className="h-[52px] w-full appearance-none truncate rounded-2xl bg-slate-50 pl-4 pr-9 text-[16px] font-bold text-slate-900 outline-none ring-1 ring-slate-200 focus:bg-white focus:ring-2 focus:ring-primary/40"
        >
          {options.map((o) => (
            <option key={String(o.v)} value={String(o.v)}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </span>
    </label>
  );
}

export interface CalculatorStart {
  city?: string;
  size?: string; // a CC_SIZES key
  kind?: 'grey' | 'complete';
}

export default function ConstructionCalculator({ data, start }: { data: ConstructionData; start?: CalculatorStart }) {
  const params = useSearchParams();
  const cities = data.config.cities;

  const [city, setCity] = useState(() => {
    const c = params.get('city') ?? start?.city;
    return cities.find((x) => x.name.toLowerCase() === c?.toLowerCase())?.name ?? cities[0]?.name ?? 'Lahore';
  });
  // A listed size ("5-marla"), or "custom" with its own number and unit.
  const [sizeKey, setSizeKey] = useState(() => {
    const v = params.get('size');
    const u = params.get('unit');
    if (v) return CC_SIZES.find((s) => s.v === Number(v) && s.u === u)?.key ?? 'custom';
    return start?.size && CC_SIZES.some((s) => s.key === start.size) ? start.size : '5-marla';
  });
  const [customSize, setCustomSize] = useState(() => params.get('size') ?? '5');
  const [customUnit, setCustomUnit] = useState<SizeUnit>(() => (params.get('unit') && params.get('unit')! in UNIT_SQFT ? (params.get('unit') as SizeUnit) : 'marla'));
  const [floors, setFloors] = useState(() => Math.min(3, Math.max(1, n0(params.get('floors'), 2))));
  const [kind, setKind] = useState<'grey' | 'complete'>(() => (params.get('type') === 'grey' || (!params.get('type') && start?.kind === 'grey') ? 'grey' : 'complete'));
  const [quality, setQuality] = useState<Quality>(() => (QUALITY.some((q) => q.key === params.get('quality')) ? (params.get('quality') as Quality) : 'standard'));
  const [mode, setMode] = useState<'full' | 'labour'>(() => (params.get('mode') === 'labour' ? 'labour' : 'full'));
  const [basement, setBasement] = useState(() => params.get('basement') === '1');
  const [covered, setCovered] = useState(() => params.get('covered') ?? '');
  const [baths, setBaths] = useState<number | null>(() => (params.get('baths') ? n0(params.get('baths'), 0) : null));
  const [kitchens, setKitchens] = useState<number | null>(() => (params.get('kitchens') ? n0(params.get('kitchens'), 0) : null));
  const [more, setMore] = useState(() => ['basement', 'covered', 'baths', 'kitchens'].some((k) => params.get(k)));
  const [heroRef, heroOn] = useOnScreen<HTMLElement>();

  const listed = CC_SIZES.find((s) => s.key === sizeKey);
  const plotSqft = listed ? listed.sqft : (Number(customSize) || 0) * UNIT_SQFT[customUnit];
  const floorsList = useMemo(() => coveredAreas(plotSqft, { floors, basement }), [plotSqft, floors, basement]);
  const coveredOverride = Number(covered) || 0;
  const above = coveredOverride || floorsList.filter((f) => !f.basement).reduce((s, f) => s + f.sqft, 0);
  const below = coveredOverride ? 0 : floorsList.filter((f) => f.basement).reduce((s, f) => s + f.sqft, 0);
  const cityFactor = cities.find((c) => c.name === city)?.factor ?? 1;
  const auto = usualRooms(above, floors);
  const bathrooms = baths ?? auto.bathrooms;
  const kitchenCount = kitchens ?? auto.kitchens;

  const est = useMemo(
    () =>
      estimate(
        { covered: above, basement: below, kind, quality, mode, cityFactor, cityRates: data.cityRates?.[city], bathrooms, kitchens: kitchenCount },
        data,
      ),
    [above, below, kind, quality, mode, cityFactor, city, bathrooms, kitchenCount, data],
  );
  const has = est.area > 0;
  const q = QUALITY.find((x) => x.key === quality)!;
  const sizeLabel = listed ? listed.label : `${customSize} ${customUnit === 'sqft' ? 'sq ft' : customUnit === 'sqyd' ? 'sq yd' : customUnit === 'kanal' ? 'Kanal' : 'Marla'}`;
  const storeys = ['single', 'double', 'triple'][floors - 1];

  const shareUrl = () => {
    const p = new URLSearchParams({ city, type: kind, quality, floors: String(floors) });
    if (listed) {
      p.set('size', String(listed.v));
      p.set('unit', listed.u);
    } else {
      p.set('size', customSize);
      p.set('unit', customUnit);
    }
    if (mode === 'labour') p.set('mode', 'labour');
    if (basement) p.set('basement', '1');
    if (coveredOverride) p.set('covered', String(coveredOverride));
    if (baths !== null) p.set('baths', String(baths));
    if (kitchens !== null) p.set('kitchens', String(kitchens));
    return `${window.location.origin}/tools/construction-cost-calculator?${p.toString()}`;
  };
  const share = () => {
    const text = `${sizeLabel} ${storeys} storey ${kind === 'grey' ? 'grey structure' : 'house'} in ${city} (${q.label}): about ${rupees(est.total)} (${rsShort(est.total)}), ${rupees(est.perSqft)} per sq ft.\n${shareUrl()}`;
    if (navigator.share) navigator.share({ title: 'Construction cost estimate', text }).catch(() => undefined);
    else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };
  const copyLink = () => navigator.clipboard?.writeText(shareUrl()).then(() => toast.success('Link copied'), () => undefined);

  const materials = est.groups.find((g) => g.key === 'structure')?.lines.filter((l) => l.key in QTY_UNIT) ?? [];
  const shopDate = [...(data.cityRates?.[city] ?? []), ...data.rates].find((r) => r.source === 'shop')?.updatedAt;
  const greyShare = est.greyTotal + est.finishingTotal ? (est.greyTotal * est.total) / (est.greyTotal + est.finishingTotal) : 0;

  return (
    <>
      <StickyAnswer
        show={!heroOn && has}
        label={`${sizeLabel} · ${kind === 'grey' ? 'grey structure' : 'complete'}`}
        value={rsShort(est.total)}
        onTap={() => (heroRef.current as HTMLElement | null)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
      />
      <ToolLayout
        inputs={
          <>
            <Card>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Select label="Plot size" value={sizeKey} onChange={setSizeKey} options={[...CC_SIZES.map((x) => ({ v: x.key, label: x.label })), { v: 'custom', label: 'Other…' }]} />
                  <Select label="City" value={city} onChange={setCity} options={cities.map((c) => ({ v: c.name, label: c.name }))} />
                </div>
                {sizeKey === 'custom' && (
                  <div className="space-y-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      value={customSize}
                      onChange={(e) => setCustomSize(e.target.value)}
                      aria-label="Plot size"
                      className="h-[52px] w-full rounded-2xl bg-slate-50 px-4 text-[20px] font-bold tabular-nums text-slate-900 outline-none ring-1 ring-slate-200 focus:bg-white focus:ring-2 focus:ring-primary/40"
                    />
                    <Segment
                      value={customUnit}
                      onChange={setCustomUnit}
                      options={[
                        { v: 'marla', label: 'Marla' },
                        { v: 'kanal', label: 'Kanal' },
                        { v: 'sqyd', label: 'Sq yd' },
                        { v: 'sqft', label: 'Sq ft' },
                      ]}
                    />
                  </div>
                )}
                <Segment
                  label="Storeys"
                  value={floors}
                  onChange={setFloors}
                  options={[
                    { v: 1, label: 'Single' },
                    { v: 2, label: 'Double' },
                    { v: 3, label: 'Triple' },
                  ]}
                />
                <Segment
                  label="Build"
                  value={kind}
                  onChange={setKind}
                  options={[
                    { v: 'complete', label: 'Complete house', sub: 'Ready to live in' },
                    { v: 'grey', label: 'Grey structure', sub: 'Frame, walls, roof' },
                  ]}
                />
                <div>
                  <Segment label="Quality" value={quality} onChange={setQuality} options={QUALITY.map((x) => ({ v: x.key, label: x.label }))} />
                  <p className="mt-1.5 text-[12.5px] text-slate-500">{q.hint}</p>
                </div>
                <Segment
                  label="Who buys the material"
                  value={mode}
                  onChange={setMode}
                  options={[
                    { v: 'full', label: 'Contractor', sub: 'Full contract' },
                    { v: 'labour', label: 'Me', sub: 'Labour contract' },
                  ]}
                />
              </div>
            </Card>

            <section className="rounded-3xl bg-white ring-1 ring-slate-200/70">
              <button type="button" onClick={() => setMore((v) => !v)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left sm:px-5" aria-expanded={more}>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100">
                  <SlidersHorizontal className="h-4 w-4 text-slate-600" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold text-slate-900">Your map</span>
                  <span className="block text-[12.5px] text-slate-500">Covered area, basement, bathrooms, kitchens</span>
                </span>
                <ChevronDown className={cn('h-5 w-5 text-slate-400 transition-transform', more && 'rotate-180')} />
              </button>
              {more && (
                <div className="space-y-3 px-4 pb-4 sm:px-5">
                  <label className="block">
                    <span className="mb-1.5 block text-[13px] font-semibold text-slate-500">Covered area, all floors (sq ft)</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      value={covered}
                      onChange={(e) => setCovered(e.target.value)}
                      placeholder={`About ${Math.round(floorsList.filter((f) => !f.basement).reduce((s, f) => s + f.sqft, 0)).toLocaleString('en-PK')}`}
                      className="h-[52px] w-full rounded-2xl bg-slate-50 px-4 text-[18px] font-bold tabular-nums text-slate-900 outline-none ring-1 ring-slate-200 focus:bg-white focus:ring-2 focus:ring-primary/40"
                    />
                  </label>
                  <label className={cn('flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3.5 py-3', coveredOverride && 'opacity-50')}>
                    <span className="text-[14px] font-semibold text-slate-800">Basement</span>
                    <input type="checkbox" checked={basement} onChange={(e) => setBasement(e.target.checked)} disabled={!!coveredOverride} className="h-5 w-5 accent-primary" />
                  </label>
                  {kind === 'complete' && (
                    <>
                      <Stepper label="Bathrooms" sub={baths === null ? 'Usual for this size' : undefined} value={bathrooms} onChange={setBaths} min={1} max={12} />
                      <Stepper label="Kitchens" sub={kitchens === null ? 'Usual for this size' : undefined} value={kitchenCount} onChange={setKitchens} min={0} max={4} />
                    </>
                  )}
                </div>
              )}
            </section>
          </>
        }
        results={
          has ? (
            <>
              <ResultHero heroRef={heroRef} label={`${sizeLabel}, ${storeys} storey · ${kind === 'grey' ? 'grey structure' : 'complete house'} · ${city}`} value={rsShort(est.total)} sub={`Usually ${rsShort(est.low)} – ${rsShort(est.high)}`}>
                <Tiles
                  onBrand
                  items={[
                    { label: 'Per sq ft', value: rupees(est.perSqft) },
                    { label: 'Covered', value: `${Math.round(est.area).toLocaleString('en-PK')} ft²` },
                    { label: 'Time', value: `~${est.months.grey + est.months.finishing} mo` },
                  ]}
                />
                <div className="mt-4 flex flex-wrap gap-2 print:hidden">
                  <button type="button" onClick={share} className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13.5px] font-bold text-slate-900">
                    <Share2 className="h-4 w-4" /> Share
                  </button>
                  <button type="button" onClick={copyLink} className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-2 text-[13.5px] font-semibold">
                    <Link2 className="h-4 w-4" /> Link
                  </button>
                  <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-2 text-[13.5px] font-semibold">
                    <Printer className="h-4 w-4" /> Print
                  </button>
                </div>
              </ResultHero>

              {mode === 'labour' && (
                <p className="rounded-2xl bg-sky-50 px-4 py-3 text-[14px] leading-relaxed text-sky-900 ring-1 ring-sky-200">
                  Pay the contractor about <b>{rsShort(est.labour)}</b> for labour and buy material worth about <b>{rsShort(est.materials)}</b> yourself.
                </p>
              )}

              <Card title="Where the money goes">
                {kind === 'complete' && (
                  <div className="mb-3 grid grid-cols-2 gap-2">
                    <div className="rounded-2xl bg-slate-50 px-3 py-2.5">
                      <p className="text-[11.5px] font-medium text-slate-500">Grey structure</p>
                      <p className="text-[16px] font-bold tabular-nums text-slate-900">{rsShort(greyShare)}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-2.5">
                      <p className="text-[11.5px] font-medium text-slate-500">Finishing</p>
                      <p className="text-[16px] font-bold tabular-nums text-slate-900">{rsShort(est.total - greyShare)}</p>
                    </div>
                  </div>
                )}
                <div className="flex h-3 gap-[2px] overflow-hidden rounded-full" aria-hidden>
                  {est.parts.map((p, i) => (
                    <div key={p.key} style={{ width: `${(p.amount / est.total) * 100}%`, background: DOT[i % DOT.length] }} />
                  ))}
                </div>
                <ul className="mt-2 divide-y divide-slate-100">
                  {est.parts.map((p, i) => (
                    <PartRow key={p.key} part={p} total={est.total} color={DOT[i % DOT.length]!} />
                  ))}
                </ul>
              </Card>

              <Card title="Material you will need" action={<span className="text-[12px] text-slate-400">Grey structure · {city} rates</span>}>
                <ul className="divide-y divide-slate-100">
                  {materials.map((m) => (
                    <li key={m.key}>
                      <Link href={m.href || '#'} className="group flex items-center gap-3 py-3">
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14.5px] font-semibold text-slate-800 group-hover:text-primary">{MATERIAL_LABEL[m.key as Material]}</span>
                          <span className="block text-[12.5px] tabular-nums text-slate-500">
                            {rupees(m.rate ?? 0)} per {m.unit}
                            {m.source === 'shop' ? ' · live' : ''}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-[15.5px] font-bold tabular-nums text-slate-900">
                            {m.key === 'steel' && m.qty ? `${(m.qty / 1000).toFixed(1)} ton` : `${m.qty?.toLocaleString('en-PK')} ${QTY_UNIT[m.key as Material]}`}
                          </span>
                          <span className="block text-[12.5px] tabular-nums text-slate-500">{rsShort(m.amount)}</span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-primary" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>

              <Card title="When you will need the money">
                <ol className="relative space-y-4 pl-6 before:absolute before:bottom-2 before:left-[9px] before:top-2 before:w-[2px] before:bg-slate-200">
                  {est.stages.map((s, i) => (
                    <li key={s.label} className="relative">
                      <span className="absolute -left-6 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-primary text-[11px] font-bold text-white">{i + 1}</span>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[14px] font-semibold text-slate-800">{s.label}</span>
                        <span className="shrink-0 text-[14.5px] font-bold tabular-nums text-slate-900">{rsShort(s.amount)}</span>
                      </div>
                    </li>
                  ))}
                </ol>
                <p className="mt-4 text-[12.5px] text-slate-500">
                  Grey structure takes about {est.months.grey} months{est.months.finishing ? `, finishing about ${est.months.finishing} more` : ''}.
                </p>
              </Card>

              <p className="flex gap-2 px-1 text-[12.5px] leading-relaxed text-slate-500">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  An estimate to plan with, not a quote. Material prices are today&apos;s from our{' '}
                  <Link href="/today-cement-rate-in-pakistan" className="font-semibold text-primary hover:underline">
                    rates pages
                  </Link>
                  {shopDate ? ` (updated ${new Date(shopDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })})` : ''}. Not included: the plot,
                  map approval, boundary walls, utility connections, solar and furniture.
                </span>
              </p>
            </>
          ) : (
            <p className="rounded-3xl bg-white p-6 text-center text-[15px] text-slate-500 ring-1 ring-slate-200/70">Choose a plot size to see the cost.</p>
          )
        }
      />
    </>
  );
}

function PartRow({ part, total, color }: { part: EstimatePart; total: number; color: string }) {
  const [open, setOpen] = useState(false);
  const pct = total ? Math.round((part.amount / total) * 100) : 0;
  return (
    <li className="py-2.5">
      <button type="button" onClick={() => setOpen((v) => !v)} disabled={!part.lines.length} className="flex w-full items-start gap-2.5 text-left" aria-expanded={open}>
        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: color }} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-3">
            <span className="text-[14.5px] font-semibold text-slate-900">{part.title}</span>
            <span className="shrink-0 text-[14.5px] font-bold tabular-nums text-slate-900">
              {rsShort(part.amount)} <span className="text-[12px] font-semibold text-slate-400">{pct}%</span>
            </span>
          </span>
          <span className="mt-0.5 flex items-start justify-between gap-3 text-[12.5px] leading-snug text-slate-500">
            {part.blurb}
            {part.lines.length > 0 && <ChevronDown className={cn('mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform print:hidden', open && 'rotate-180')} />}
          </span>
        </span>
      </button>
      {part.lines.length > 0 && (
        <ul className={cn('ml-5 mt-2 space-y-1 rounded-2xl bg-slate-50 p-3', open ? 'block' : 'hidden print:block')}>
          {part.lines.map((l) => (
            <li key={l.key} className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="text-slate-600">
                {l.label}
                {l.qty !== undefined && !(l.key in QTY_UNIT) && <span className="text-slate-400"> × {l.qty}</span>}
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-slate-800">{rsShort(l.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

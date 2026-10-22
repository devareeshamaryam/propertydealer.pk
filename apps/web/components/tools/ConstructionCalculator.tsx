'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ChevronDown, Clock, ExternalLink, Info, Link2, Minus, Plus, Printer, Share2, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { CC_SIZES } from '@/lib/construction-pages';
import { MATERIAL_LABEL, QUALITY, rsShort, coveredAreas, estimate, rupees, usualRooms, type ConstructionData, type EstimatePart, type Material, type Quality } from '@/lib/tools';
import { cn } from '@/lib/utils';

type SizeUnit = 'marla' | 'kanal' | 'sqft' | 'sqyd';
const UNIT_SQFT: Record<SizeUnit, number> = { marla: 225, kanal: 4500, sqyd: 9, sqft: 1 };
const QTY_UNIT: Record<Material, string> = { cement: 'bags', steel: 'kg', bricks: 'bricks', sand: 'cft', crush: 'cft' };
const STOREYS = [
  { v: 1, label: 'Single storey' },
  { v: 2, label: 'Double storey' },
  { v: 3, label: 'Triple storey' },
];

const n0 = (v: string | null, d: number) => {
  const n = Number(v);
  return v !== null && Number.isFinite(n) && n >= 0 ? n : d;
};

/** A labelled dropdown — the phone's own picker. */
function Field<T extends string | number>({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { v: T; label: string }[];
  className?: string;
}) {
  return (
    <label className={cn('block min-w-0', className)}>
      <span className="mb-1 block text-[12.5px] font-semibold text-slate-500">{label}</span>
      <span className="relative block">
        <select
          value={String(value)}
          onChange={(e) => {
            const o = options.find((x) => String(x.v) === e.target.value);
            if (o) onChange(o.v);
          }}
          className="h-11 w-full appearance-none truncate rounded-xl border border-slate-300 bg-white pl-3 pr-8 text-[15px] font-semibold text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
        >
          {options.map((o) => (
            <option key={String(o.v)} value={String(o.v)}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </span>
    </label>
  );
}

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
      <span className="text-[14px] font-semibold text-slate-700">{label}</span>
      <span className="flex items-center gap-1.5">
        <button type="button" onClick={() => onChange(Math.max(0, value - 1))} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:border-primary" aria-label={`Fewer ${label.toLowerCase()}`}>
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-6 text-center text-[16px] font-bold tabular-nums">{value}</span>
        <button type="button" onClick={() => onChange(Math.min(12, value + 1))} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:border-primary" aria-label={`More ${label.toLowerCase()}`}>
          <Plus className="h-4 w-4" />
        </button>
      </span>
    </div>
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
  const [more, setMore] = useState(() => ['mode', 'basement', 'covered', 'baths', 'kitchens'].some((k) => params.get(k)));

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
    const text = `${sizeLabel} ${STOREYS[floors - 1]!.label.toLowerCase()} ${kind === 'grey' ? 'grey structure' : 'house'} in ${city} (${q.label}): about ${rupees(est.total)} (${rsShort(est.total)}), ${rupees(est.perSqft)} per sq ft.\n${shareUrl()}`;
    if (navigator.share) navigator.share({ title: 'Construction cost estimate', text }).catch(() => undefined);
    else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };
  const copyLink = () => navigator.clipboard?.writeText(shareUrl()).then(() => toast.success('Link copied'), () => undefined);

  const materials = est.groups.find((g) => g.key === 'structure')?.lines.filter((l) => l.key in QTY_UNIT) ?? [];
  const shopDate = [...(data.cityRates?.[city] ?? []), ...data.rates].find((r) => r.source === 'shop')?.updatedAt;

  return (
    <div className="space-y-5">
      {/* ── The question ── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 print:hidden">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Field label="Plot size" value={sizeKey} onChange={setSizeKey} options={[...CC_SIZES.map((x) => ({ v: x.key, label: x.label })), { v: 'custom', label: 'Other size…' }]} />
          <Field label="Storeys" value={floors} onChange={setFloors} options={STOREYS.map((x) => ({ v: x.v, label: x.label }))} />
          <Field
            label="Build"
            value={kind}
            onChange={setKind}
            options={[
              { v: 'complete', label: 'Complete house' },
              { v: 'grey', label: 'Grey structure' },
            ]}
          />
          <Field label="City" value={city} onChange={setCity} options={cities.map((c) => ({ v: c.name, label: c.name }))} />
          <Field label="Quality" value={quality} onChange={setQuality} options={QUALITY.map((x) => ({ v: x.key, label: x.label }))} className="col-span-2 md:col-span-1" />
        </div>
        <p className="mt-2 text-[12.5px] text-slate-500">{q.label}: {q.hint}.</p>

        {sizeKey === 'custom' && (
          <div className="mt-3 flex max-w-sm gap-2">
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={customSize}
              onChange={(e) => setCustomSize(e.target.value)}
              aria-label="Plot size"
              className="h-11 w-full rounded-xl border border-slate-300 px-3 text-[16px] tabular-nums outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              autoFocus
            />
            <select
              value={customUnit}
              onChange={(e) => setCustomUnit(e.target.value as SizeUnit)}
              aria-label="Unit"
              className="h-11 w-[120px] shrink-0 rounded-xl border border-slate-300 bg-white px-2 text-[15px] outline-none focus:border-primary"
            >
              <option value="marla">Marla</option>
              <option value="kanal">Kanal</option>
              <option value="sqyd">Sq yd</option>
              <option value="sqft">Sq ft</option>
            </select>
          </div>
        )}

        <button type="button" onClick={() => setMore((v) => !v)} className="mt-3 inline-flex items-center gap-1.5 text-[14px] font-semibold text-primary hover:underline" aria-expanded={more}>
          <SlidersHorizontal className="h-4 w-4" /> {more ? 'Fewer options' : 'More options'}
        </button>
        {more && (
          <div className="mt-3 grid gap-4 border-t border-slate-100 pt-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <p className="mb-1.5 text-[13px] font-semibold text-slate-600">Who buys the material?</p>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    ['full', 'Contractor', 'Full contract'],
                    ['labour', 'Me', 'Labour contract'],
                  ] as const
                ).map(([k, t, sub]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setMode(k)}
                    aria-pressed={mode === k}
                    className={cn('btn-shape rounded-xl border px-2 py-2 text-center', mode === k ? 'border-primary bg-primary text-white' : 'border-slate-200 text-slate-700 hover:border-primary/50')}
                  >
                    <span className="block text-[14px] font-bold">{t}</span>
                    <span className={cn('block text-[11px]', mode === k ? 'text-white/80' : 'text-slate-400')}>{sub}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-[13px] font-semibold text-slate-600">Covered area (from your map)</p>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={covered}
                onChange={(e) => setCovered(e.target.value)}
                placeholder={`About ${Math.round(floorsList.filter((f) => !f.basement).reduce((s, f) => s + f.sqft, 0)).toLocaleString('en-PK')} sq ft`}
                className="h-11 w-full rounded-xl border border-slate-300 px-3 text-[16px] tabular-nums outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <label className="mt-2 flex cursor-pointer items-center gap-2 text-[14px] font-medium text-slate-700">
                <input type="checkbox" checked={basement} onChange={(e) => setBasement(e.target.checked)} className="h-4 w-4 accent-primary" disabled={!!coveredOverride} />
                With basement
              </label>
            </div>
            {kind === 'complete' && (
              <div className="md:col-span-2">
                <p className="mb-1.5 flex items-baseline justify-between text-[13px] font-semibold text-slate-600">
                  Rooms {baths === null && kitchens === null ? <span className="font-normal text-slate-400">usual for this size</span> : (
                    <button
                      type="button"
                      onClick={() => {
                        setBaths(null);
                        setKitchens(null);
                      }}
                      className="text-[12px] font-semibold text-primary hover:underline"
                    >
                      Reset
                    </button>
                  )}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Stepper label="Bathrooms" value={bathrooms} onChange={setBaths} />
                  <Stepper label="Kitchens" value={kitchenCount} onChange={setKitchens} />
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {has ? (
        <>
          {/* ── The answer ── */}
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <p className="text-[13px] font-semibold text-slate-500">Estimated cost</p>
              <p className="mt-0.5 text-[36px] font-extrabold leading-tight tracking-tight tabular-nums text-slate-900 sm:text-[44px]">{rsShort(est.total)}</p>
              <p className="text-[15px] tabular-nums text-slate-600">
                {rupees(est.total)} · usually between {rsShort(est.low)} and {rsShort(est.high)}
              </p>

              <dl className="mt-5 grid grid-cols-3 gap-2">
                {[
                  ['Per sq ft', rupees(est.perSqft)],
                  ['Covered area', `${Math.round(est.area).toLocaleString('en-PK')} ft²`],
                  ['Time', `~${est.months.grey + est.months.finishing} months`],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-slate-50 px-2 py-2.5 text-center">
                    <dt className="text-[11.5px] text-slate-500">{k}</dt>
                    <dd className="text-[15px] font-bold tabular-nums text-slate-900 sm:text-[16px]">{v}</dd>
                  </div>
                ))}
              </dl>

              {kind === 'complete' && (
                <div className="mt-4 space-y-1.5 text-[14px]">
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-600">Grey structure</span>
                    <b className="tabular-nums text-slate-900">{rsShort((est.greyTotal * est.total) / (est.greyTotal + est.finishingTotal))}</b>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-600">+ Finishing</span>
                    <b className="tabular-nums text-slate-900">{rsShort((est.finishingTotal * est.total) / (est.greyTotal + est.finishingTotal))}</b>
                  </div>
                </div>
              )}

              {!coveredOverride && (
                <p className="mt-4 text-[12.5px] text-slate-500">
                  {floorsList.map((f) => `${f.label} ${f.sqft.toLocaleString('en-PK')}`).join(' + ')} sq ft — the usual for this plot after setbacks.
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-2 print:hidden">
                <button type="button" onClick={share} className="btn-shape inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[14px] font-bold text-white hover:bg-primary/90">
                  <Share2 className="h-4 w-4" /> Share
                </button>
                <button type="button" onClick={copyLink} className="btn-shape inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[14px] font-semibold text-slate-700 hover:bg-slate-50">
                  <Link2 className="h-4 w-4" /> Copy link
                </button>
                <button type="button" onClick={() => window.print()} className="btn-shape inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[14px] font-semibold text-slate-700 hover:bg-slate-50">
                  <Printer className="h-4 w-4" /> Print
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-[17px] font-bold text-slate-900">Where the money goes</h2>
              <div className="mt-3 flex h-3 gap-[2px] overflow-hidden rounded-full" aria-hidden>
                {est.parts.map((p, i) => (
                  <div key={p.key} style={{ width: `${(p.amount / est.total) * 100}%`, background: DOT[i % DOT.length] }} />
                ))}
              </div>
              <ul className="mt-3 divide-y divide-slate-100">
                {est.parts.map((p, i) => (
                  <PartRow key={p.key} part={p} total={est.total} color={DOT[i % DOT.length]!} />
                ))}
              </ul>
            </section>
          </div>

          {mode === 'labour' && (
            <p className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-[14.5px] leading-relaxed text-sky-900">
              You pay the contractor about <b>{rsShort(est.labour)}</b> for labour, and buy material worth about <b>{rsShort(est.materials)}</b> yourself.
            </p>
          )}

          {/* ── Shopping list ── */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <h2 className="text-[17px] font-bold text-slate-900">Material you will need</h2>
            <p className="text-[13.5px] text-slate-500">For the grey structure, at today&apos;s {city} rates.</p>
            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
              {materials.map((m) => (
                <Link key={m.key} href={m.href || '#'} className="group rounded-xl border border-slate-200 p-3.5 transition-colors hover:border-primary/50">
                  <span className="flex items-center justify-between text-[13px] font-semibold text-slate-500">
                    {MATERIAL_LABEL[m.key as Material]}
                    <ExternalLink className="h-3.5 w-3.5 text-slate-300 group-hover:text-primary" />
                  </span>
                  <span className="mt-1 block text-[20px] font-extrabold leading-tight tabular-nums text-slate-900">
                    {m.key === 'steel' && m.qty ? `${(m.qty / 1000).toFixed(1)} ton` : `${m.qty?.toLocaleString('en-PK')} ${QTY_UNIT[m.key as Material]}`}
                  </span>
                  <span className="mt-1 block text-[12.5px] tabular-nums text-slate-500">
                    {rupees(m.rate ?? 0)} per {m.unit} · <b className="text-slate-700">{rsShort(m.amount)}</b>
                  </span>
                </Link>
              ))}
            </div>
          </section>

          {/* ── When the money is needed ── */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-[17px] font-bold text-slate-900">
              <Clock className="h-5 w-5 text-primary" /> When you will need the money
            </h2>
            <ol className="mt-4 grid gap-3 md:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
              {est.stages.map((s, i) => (
                <li key={s.label} className="relative flex gap-3 md:block">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-[14px] font-bold text-primary">{i + 1}</span>
                  <span className="md:mt-2 md:block">
                    <span className="block text-[14px] font-semibold text-slate-800">{s.label}</span>
                    <span className="block text-[15px] font-bold tabular-nums text-slate-900">{rsShort(s.amount)}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-[13px] text-slate-500">
              Grey structure takes about {est.months.grey} months{est.months.finishing ? `, finishing about ${est.months.finishing} more` : ''}.
            </p>
          </section>
        </>
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">Choose a plot size to see the cost.</p>
      )}

      <p className="flex gap-2 text-[13px] leading-relaxed text-slate-500">
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
    </div>
  );
}

const DOT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'];

function PartRow({ part, total, color }: { part: EstimatePart; total: number; color: string }) {
  const [open, setOpen] = useState(false);
  const pct = total ? Math.round((part.amount / total) * 100) : 0;
  return (
    <li className="py-2.5">
      <button type="button" onClick={() => setOpen((v) => !v)} disabled={!part.lines.length} className="flex w-full items-start gap-2.5 text-left" aria-expanded={open}>
        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: color }} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-3">
            <span className="text-[15px] font-semibold text-slate-900">{part.title}</span>
            <span className="shrink-0 text-[15px] font-bold tabular-nums text-slate-900">
              {rsShort(part.amount)} <span className="text-[12.5px] font-semibold text-slate-400">{pct}%</span>
            </span>
          </span>
          <span className="mt-0.5 flex items-start justify-between gap-3 text-[13px] leading-snug text-slate-500">
            {part.blurb}
            {part.lines.length > 0 && <ChevronDown className={cn('mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform print:hidden', open && 'rotate-180')} />}
          </span>
        </span>
      </button>
      {part.lines.length > 0 && (
        <ul className={cn('ml-5 mt-2 space-y-1 rounded-xl bg-slate-50 p-3', open ? 'block' : 'hidden print:block')}>
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

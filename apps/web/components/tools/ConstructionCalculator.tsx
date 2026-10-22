'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Building2, ChevronDown, Clock, ExternalLink, Info, Link2, Minus, Plus, Printer, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { amountShort } from '@/lib/pk';
import {
  QUALITY,
  coveredAreas,
  estimate,
  rupees,
  usualRooms,
  type ConstructionData,
  type EstimateGroup,
  type Quality,
} from '@/lib/tools';
import { cn } from '@/lib/utils';

type SizeUnit = 'marla' | 'kanal' | 'sqft' | 'sqyd';
const SIZE_UNITS: { key: SizeUnit; label: string; sqft: number }[] = [
  { key: 'marla', label: 'Marla', sqft: 225 },
  { key: 'kanal', label: 'Kanal', sqft: 4500 },
  { key: 'sqyd', label: 'Sq yd', sqft: 9 },
  { key: 'sqft', label: 'Sq ft', sqft: 1 },
];
const QUICK_SIZES: { v: number; u: SizeUnit; label: string }[] = [
  { v: 3, u: 'marla', label: '3 Marla' },
  { v: 5, u: 'marla', label: '5 Marla' },
  { v: 7, u: 'marla', label: '7 Marla' },
  { v: 8, u: 'marla', label: '8 Marla' },
  { v: 10, u: 'marla', label: '10 Marla' },
  { v: 1, u: 'kanal', label: '1 Kanal' },
  { v: 2, u: 'kanal', label: '2 Kanal' },
];
const QTY_UNIT: Record<string, string> = { cement: 'bags', steel: 'kg', bricks: 'bricks', sand: 'cft', crush: 'cft' };
const SOURCE: Record<string, { label: string; cls: string }> = {
  shop: { label: 'Live rate', cls: 'bg-emerald-50 text-emerald-700' },
  office: { label: 'Our rate', cls: 'bg-sky-50 text-sky-700' },
  default: { label: 'Estimate', cls: 'bg-slate-100 text-slate-600' },
};

const field =
  'h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-[16px] tabular-nums text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20';

function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { key: T; label: string; sub?: string }[];
  className?: string;
}) {
  return (
    <div className={cn('grid gap-1.5', className)} role="radiogroup">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <button
            key={String(o.key)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.key)}
            className={cn(
              'btn-shape rounded-xl border px-2 py-2.5 text-center transition-colors',
              on ? 'border-primary bg-primary text-white shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:border-primary/50',
            )}
          >
            <span className="block text-[14px] font-bold leading-tight">{o.label}</span>
            {o.sub && <span className={cn('mt-0.5 block text-[11px] leading-tight', on ? 'text-white/80' : 'text-slate-400')}>{o.sub}</span>}
          </button>
        );
      })}
    </div>
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

const num = (v: string | null, d: number) => {
  const n = Number(v);
  return v !== null && Number.isFinite(n) && n >= 0 ? n : d;
};

export default function ConstructionCalculator({ data }: { data: ConstructionData }) {
  const params = useSearchParams();
  const cities = data.config.cities;

  const [city, setCity] = useState(() => {
    const c = params.get('city');
    return cities.find((x) => x.name.toLowerCase() === c?.toLowerCase())?.name ?? cities[0]?.name ?? 'Other';
  });
  const [size, setSize] = useState(() => params.get('size') ?? '5');
  const [unit, setUnit] = useState<SizeUnit>(() => (SIZE_UNITS.some((u) => u.key === params.get('unit')) ? (params.get('unit') as SizeUnit) : 'marla'));
  const [byCovered, setByCovered] = useState(() => !!params.get('covered'));
  const [covered, setCovered] = useState(() => params.get('covered') ?? '');
  const [floors, setFloors] = useState(() => Math.min(3, Math.max(1, num(params.get('floors'), 2))));
  const [basement, setBasement] = useState(() => params.get('basement') === '1');
  const [kind, setKind] = useState<'grey' | 'complete'>(() => (params.get('type') === 'grey' ? 'grey' : 'complete'));
  const [quality, setQuality] = useState<Quality>(() => (QUALITY.some((q) => q.key === params.get('quality')) ? (params.get('quality') as Quality) : 'standard'));
  const [mode, setMode] = useState<'full' | 'labour'>(() => (params.get('mode') === 'labour' ? 'labour' : 'full'));
  // Rooms are worked out from the size until the visitor changes them.
  const [baths, setBaths] = useState<number | null>(() => (params.get('baths') ? num(params.get('baths'), 0) : null));
  const [kitchens, setKitchens] = useState<number | null>(() => (params.get('kitchens') ? num(params.get('kitchens'), 0) : null));

  const plotSqft = (Number(size) || 0) * (SIZE_UNITS.find((u) => u.key === unit)?.sqft ?? 225);
  const floorsList = useMemo(() => coveredAreas(plotSqft, { floors, basement }), [plotSqft, floors, basement]);
  const above = byCovered ? Number(covered) || 0 : floorsList.filter((f) => !f.basement).reduce((s, f) => s + f.sqft, 0);
  const below = byCovered ? 0 : floorsList.filter((f) => f.basement).reduce((s, f) => s + f.sqft, 0);
  const cityInfo = cities.find((c) => c.name === city);
  const cityFactor = cityInfo?.factor ?? 1;
  const auto = usualRooms(above, byCovered ? 2 : floors);
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

  const shareUrl = () => {
    const p = new URLSearchParams({ city, type: kind, quality, mode });
    if (byCovered) p.set('covered', String(above));
    else {
      p.set('size', size);
      p.set('unit', unit);
      p.set('floors', String(floors));
      if (basement) p.set('basement', '1');
    }
    if (baths !== null) p.set('baths', String(baths));
    if (kitchens !== null) p.set('kitchens', String(kitchens));
    return `${window.location.origin}${window.location.pathname}?${p.toString()}`;
  };
  const sizeText = byCovered
    ? `${above.toLocaleString('en-PK')} sq ft covered`
    : `${size} ${SIZE_UNITS.find((u) => u.key === unit)?.label} ${floors === 1 ? 'single' : floors === 2 ? 'double' : 'triple'} storey`;
  const share = () => {
    const text = `${kind === 'grey' ? 'Grey structure' : 'Complete house'} (${q.label}) — ${sizeText} in ${city}: about ${rupees(est.total)} (${amountShort(est.total)}), ${rupees(est.perSqft)}/sq ft.\n${shareUrl()}`;
    if (navigator.share) navigator.share({ title: 'Construction cost estimate', text }).catch(() => undefined);
    else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };
  const copyLink = () => navigator.clipboard?.writeText(shareUrl()).then(() => toast.success('Link copied'), () => undefined);

  const shopDate = [...(data.cityRates?.[city] ?? []), ...data.rates].find((r) => r.source === 'shop')?.updatedAt;
  const split = [
    { label: 'Material', amount: est.materials, cls: 'bg-primary' },
    { label: 'Labour', amount: est.labour, cls: 'bg-amber-400' },
    ...(est.contractor ? [{ label: 'Contractor', amount: est.contractor, cls: 'bg-slate-400' }] : []),
  ];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:items-start">
      {/* ── Inputs ── */}
      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:sticky lg:top-20 print:hidden">
        <div>
          <label htmlFor="cc-city" className="mb-1.5 block text-[13px] font-semibold text-slate-600">
            City
          </label>
          <select id="cc-city" value={city} onChange={(e) => setCity(e.target.value)} className={field}>
            {cities.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
            {!cities.some((c) => c.name === 'Other') && <option value="Other">Other city</option>}
          </select>
        </div>

        {!byCovered ? (
          <div>
            <label htmlFor="cc-size" className="mb-1.5 block text-[13px] font-semibold text-slate-600">
              Plot size
            </label>
            <div className="flex gap-2">
              <input id="cc-size" type="number" inputMode="decimal" min="0" step="any" value={size} onChange={(e) => setSize(e.target.value)} className={field} />
              <select value={unit} onChange={(e) => setUnit(e.target.value as SizeUnit)} className={cn(field, 'w-[120px] shrink-0')} aria-label="Unit">
                {SIZE_UNITS.map((u) => (
                  <option key={u.key} value={u.key}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="hide-scrollbar -mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
              {QUICK_SIZES.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => {
                    setSize(String(s.v));
                    setUnit(s.u);
                  }}
                  className={cn(
                    'btn-shape shrink-0 rounded-full border px-3 py-1 text-[12.5px] font-semibold',
                    Number(size) === s.v && unit === s.u ? 'border-primary bg-primary text-white' : 'border-slate-200 text-slate-600 hover:border-primary/50',
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <p className="mb-1.5 mt-4 text-[13px] font-semibold text-slate-600">Storeys</p>
            <Segmented
              value={floors}
              onChange={setFloors}
              className="grid-cols-3"
              options={[
                { key: 1, label: 'Single', sub: 'Ground' },
                { key: 2, label: 'Double', sub: 'Ground + 1' },
                { key: 3, label: 'Triple', sub: 'Ground + 2' },
              ]}
            />
            <label className={cn('mt-2 flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5', basement ? 'border-primary/40 bg-primary/5' : 'border-slate-200')}>
              <input type="checkbox" checked={basement} onChange={(e) => setBasement(e.target.checked)} className="h-4 w-4 accent-primary" />
              <span className="text-[14px] font-semibold text-slate-800">With basement</span>
            </label>
            <button type="button" onClick={() => setByCovered(true)} className="mt-2 text-[13px] font-semibold text-primary hover:underline">
              I know my covered area →
            </button>
          </div>
        ) : (
          <div>
            <label htmlFor="cc-covered" className="mb-1.5 block text-[13px] font-semibold text-slate-600">
              Total covered area (sq ft)
            </label>
            <input id="cc-covered" type="number" inputMode="numeric" min="0" value={covered} onChange={(e) => setCovered(e.target.value)} placeholder="e.g. 2250" className={field} autoFocus />
            <p className="mt-1 text-[12px] text-slate-500">All floors added together, from your map.</p>
            <button type="button" onClick={() => setByCovered(false)} className="mt-1 text-[13px] font-semibold text-primary hover:underline">
              ← Work it out from plot size
            </button>
          </div>
        )}

        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-slate-600">What to build</p>
          <Segmented
            value={kind}
            onChange={setKind}
            className="grid-cols-2"
            options={[
              { key: 'grey', label: 'Grey structure', sub: 'Frame, walls, roofs, pipes' },
              { key: 'complete', label: 'Complete house', sub: 'Ready to live in' },
            ]}
          />
        </div>

        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-slate-600">Quality</p>
          <Segmented value={quality} onChange={setQuality} className="grid-cols-2 sm:grid-cols-4 lg:grid-cols-2" options={QUALITY.map((x) => ({ key: x.key, label: x.label }))} />
          <p className="mt-1.5 text-[12px] text-slate-500">{q.hint}</p>
        </div>

        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-slate-600">Contract</p>
          <Segmented
            value={mode}
            onChange={setMode}
            className="grid-cols-2"
            options={[
              { key: 'full', label: 'Full contract', sub: 'Contractor buys material' },
              { key: 'labour', label: 'Labour contract', sub: 'You buy material' },
            ]}
          />
        </div>

        {kind === 'complete' && (
          <div>
            <p className="mb-1.5 flex items-baseline justify-between text-[13px] font-semibold text-slate-600">
              Rooms
              {(baths !== null || kitchens !== null) && (
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
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <Stepper label="Bathrooms" value={bathrooms} onChange={setBaths} />
              <Stepper label="Kitchens" value={kitchenCount} onChange={setKitchens} />
            </div>
            {baths === null && kitchens === null && <p className="mt-1 text-[12px] text-slate-500">Worked out from the size — change them if your map differs.</p>}
          </div>
        )}
      </section>

      {/* ── Results ── */}
      <section className="min-w-0 space-y-4">
        <div className="overflow-hidden rounded-2xl bg-slate-900 p-5 text-white shadow-sm sm:p-6">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-white/60">
            {kind === 'grey' ? 'Grey structure' : 'Complete house'} · {q.label} · {city}
          </p>
          <p className="mt-1 text-[34px] font-extrabold leading-tight tabular-nums sm:text-[44px]">{has ? rupees(est.total) : '—'}</p>
          {has && (
            <>
              <p className="text-[16px] font-semibold text-white/80">
                {amountShort(est.total)} · likely {amountShort(est.low)} – {amountShort(est.high)}
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-4 text-center">
                <div>
                  <p className="text-[11.5px] text-white/60">Per sq ft</p>
                  <p className="text-[17px] font-bold tabular-nums">{rupees(est.perSqft)}</p>
                </div>
                <div>
                  <p className="text-[11.5px] text-white/60">Covered area</p>
                  <p className="text-[17px] font-bold tabular-nums">{Math.round(est.area).toLocaleString('en-PK')} ft²</p>
                </div>
                <div>
                  <p className="text-[11.5px] text-white/60">Time</p>
                  <p className="text-[17px] font-bold">~{est.months.grey + est.months.finishing} months</p>
                </div>
              </div>
              <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-white/10" aria-hidden>
                {split.map((s) => (
                  <div key={s.label} className={s.cls} style={{ width: `${(s.amount / est.total) * 100}%` }} />
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-white/80">
                {split.map((s) => (
                  <span key={s.label} className="inline-flex items-center gap-1.5">
                    <i className={cn('h-2 w-2 rounded-full', s.cls)} /> {s.label} {amountShort(s.amount)}
                  </span>
                ))}
              </div>
            </>
          )}
          <div className="mt-4 flex flex-wrap gap-2 print:hidden">
            <button type="button" onClick={share} disabled={!has} className="btn-shape inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-[13.5px] font-bold text-slate-900 disabled:opacity-50">
              <Share2 className="h-4 w-4" /> Share
            </button>
            <button type="button" onClick={copyLink} disabled={!has} className="btn-shape inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-[13.5px] font-semibold disabled:opacity-50">
              <Link2 className="h-4 w-4" /> Copy link
            </button>
            <button type="button" onClick={() => window.print()} disabled={!has} className="btn-shape inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-[13.5px] font-semibold disabled:opacity-50">
              <Printer className="h-4 w-4" /> Print
            </button>
          </div>
        </div>

        {has && mode === 'labour' && (
          <p className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-[14px] leading-relaxed text-sky-900">
            Pay the contractor about <b>{rupees(est.labour)}</b> for labour, and buy material worth about <b>{rupees(est.materials)}</b> yourself — the
            list below is your shopping list.
          </p>
        )}

        {has && !byCovered && floorsList.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <h3 className="flex items-center gap-2 text-[16px] font-bold text-slate-900">
              <Building2 className="h-4.5 w-4.5 text-primary" /> Covered area
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {floorsList.map((f) => (
                <span key={f.label} className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-[13px] text-slate-700">
                  {f.label} <b className="tabular-nums text-slate-900">{f.sqft.toLocaleString('en-PK')}</b> ft²
                </span>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-slate-500">The usual coverage for this plot size after setbacks. Your map differs? Enter your covered area instead.</p>
          </div>
        )}

        {has && est.groups.map((g, i) => <Group key={g.key} group={g} open={i < 1} />)}

        {has && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <h3 className="flex items-center gap-2 text-[16px] font-bold text-slate-900">
              <Clock className="h-4.5 w-4.5 text-primary" /> Money needed, stage by stage
            </h3>
            <ol className="mt-3 space-y-2.5">
              {est.stages.map((s, i) => (
                <li key={s.label}>
                  <div className="flex items-baseline justify-between gap-3 text-[14px]">
                    <span className="text-slate-700">
                      {i + 1}. {s.label}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-slate-900">{rupees(s.amount)}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(1, (s.amount / est.total) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-[12.5px] text-slate-500">
              Grey structure usually takes about {est.months.grey} months
              {est.months.finishing ? `, and finishing another ${est.months.finishing}` : ''}.
            </p>
          </div>
        )}

        <div className="flex gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[13px] leading-relaxed text-amber-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            An estimate to plan with, not a quote. Material prices are today&apos;s rates from our{' '}
            <Link href="/today-cement-rate-in-pakistan" className="font-semibold underline">
              rates pages
            </Link>
            {shopDate ? ` (updated ${new Date(shopDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })})` : ''}; labour, other
            works and finishing are typical {city} prices. Not included: the plot, architect and map approval fees, boundary walls, utility connections,
            solar and furniture.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 print:hidden">
          {(['cement', 'steel', 'bricks', 'sand', 'crush'] as const).map((m) => {
            const r = data.cityRates?.[city]?.find((x) => x.material === m) ?? data.rates.find((x) => x.material === m);
            if (!r) return null;
            return (
              <Link key={m} href={r.href} className="group rounded-xl border border-slate-200 bg-white p-3 hover:border-primary/40">
                <span className="flex items-center justify-between text-[12px] font-semibold text-slate-500">
                  {m === 'crush' ? 'Crush' : m[0]!.toUpperCase() + m.slice(1)}
                  <ExternalLink className="h-3 w-3 text-slate-300 group-hover:text-primary" />
                </span>
                <span className="block text-[16px] font-extrabold tabular-nums text-slate-900">{rupees(r.mid)}</span>
                <span className="block text-[11px] text-slate-400">per {r.unit}</span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Group({ group, open }: { group: EstimateGroup; open: boolean }) {
  const hasQty = group.lines.some((l) => l.qty !== undefined);
  return (
    <details open={open} className="group rounded-2xl border border-slate-200 bg-white [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 sm:px-5">
        <span className="text-[16px] font-bold text-slate-900">{group.title}</span>
        <span className="flex items-center gap-2">
          <span className="text-[16px] font-extrabold tabular-nums text-slate-900">{rupees(group.total)}</span>
          <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
        </span>
      </summary>
      <div className="-mt-1 px-4 pb-4 sm:px-5">
        {hasQty ? (
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[460px] text-[14px]">
              <tbody className="tabular-nums">
                {group.lines.map((l) => (
                  <tr key={l.key} className="border-t border-slate-100">
                    <td className="py-2.5 pr-2">
                      {l.href ? (
                        <Link href={l.href} className="font-semibold text-slate-800 hover:text-primary">
                          {l.label}
                        </Link>
                      ) : (
                        <span className={cn(l.qty !== undefined ? 'font-semibold text-slate-800' : 'text-slate-700')}>{l.label}</span>
                      )}
                      {l.source && <span className={cn('ml-1.5 rounded px-1.5 py-0.5 text-[10.5px] font-semibold', SOURCE[l.source]?.cls)}>{SOURCE[l.source]?.label}</span>}
                    </td>
                    <td className="py-2.5 pr-2 text-right text-slate-600">
                      {l.qty !== undefined && (
                        <>
                          {l.qty.toLocaleString('en-PK')} {QTY_UNIT[l.key] ?? `${l.unit}${l.qty === 1 ? '' : 's'}`}
                          {l.key === 'steel' && l.qty ? <span className="block text-[11.5px] text-slate-400">≈ {(l.qty / 1000).toFixed(1)} ton</span> : null}
                        </>
                      )}
                    </td>
                    <td className="py-2.5 pr-2 text-right text-slate-500">
                      {l.rate !== undefined && (
                        <>
                          {rupees(l.rate)}
                          <span className="block text-[11.5px] text-slate-400">per {l.unit}</span>
                        </>
                      )}
                    </td>
                    <td className="py-2.5 text-right font-semibold">{rupees(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ul>
            {group.lines.map((l) => (
              <li key={l.key} className="flex items-baseline justify-between gap-3 border-t border-slate-100 py-2.5 text-[14px]">
                {l.href ? (
                  <Link href={l.href} className="text-slate-700 hover:text-primary">
                    {l.label}
                  </Link>
                ) : (
                  <span className="text-slate-700">{l.label}</span>
                )}
                <span className="shrink-0 font-semibold tabular-nums text-slate-900">{rupees(l.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

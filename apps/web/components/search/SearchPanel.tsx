'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Check, ChevronDown, Layers, MapPin, Search, SlidersHorizontal, X } from 'lucide-react';
import { areaApi, cityApi, propertyApi } from '@/lib/api';
import { CityPicker } from '@/components/ui/city-picker';
import { sortCitiesByPopularity } from '@/lib/pk';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { cn, toTitleCase } from '@/lib/utils';
import {
  BEDS,
  EMPTY_SEARCH,
  MARLA_SIZES,
  NO_BEDS,
  RENT_PRICES,
  SALE_PRICES,
  TYPE_LABELS,
  extraCount,
  marlaLabel,
  priceLabel,
  rangeLabel,
  searchUrl,
  toSlug,
  type Purpose,
  type SearchState,
} from '@/lib/search';

/*
 * The property search — one panel for the homepage and the top of every
 * results page (city, area, society, type), the way Zameen does it: buy or
 * rent, city, location, type, price, size, beds and a keyword.
 *
 * hero: the homepage card. bar: the strip above the results — one row on a
 * desktop; on a phone a short row (Buy / Rent, where, Filters) that opens
 * the whole form in a sheet. Both lead to the same addresses (lib/search).
 */

type City = { _id: string; name: string };
type Place = { id: string; name: string; slug: string; kind?: string; parent?: string; count: number };

const field =
  'h-11 w-full appearance-none rounded-lg border border-slate-300 bg-white pl-3 pr-9 text-[14px] text-slate-900 outline-none transition-colors hover:border-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400';

function Select({ label, value, onChange, children, className, disabled }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode; className?: string; disabled?: boolean }) {
  return (
    <label className={cn('relative block', className)}>
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={field} disabled={disabled} aria-label={label}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </label>
  );
}

/** Min and max from the same list — a min above the max swaps them. */
function Range({
  label,
  options,
  fmt,
  min,
  max,
  onChange,
}: {
  label: string;
  options: number[];
  fmt: (n: number) => string;
  min?: number;
  max?: number;
  onChange: (min?: number, max?: number) => void;
}) {
  const set = (a?: number, b?: number) => (a && b && a > b ? onChange(b, a) : onChange(a, b));
  return (
    <div>
      <p className="mb-1.5 text-[12.5px] font-semibold text-slate-700">{label}</p>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <Select label={`${label} from`} value={min ? String(min) : ''} onChange={(v) => set(v ? Number(v) : undefined, max)}>
          <option value="">Min</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {fmt(o)}
            </option>
          ))}
        </Select>
        <span className="text-[13px] text-slate-400">to</span>
        <Select label={`${label} to`} value={max ? String(max) : ''} onChange={(v) => set(min, v ? Number(v) : undefined)}>
          <option value="">Max</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {fmt(o)}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}

function Beds({ value, onChange }: { value?: number; onChange: (v?: number) => void }) {
  return (
    <div>
      <p className="mb-1.5 text-[12.5px] font-semibold text-slate-700">Bedrooms</p>
      <div className="flex gap-1.5">
        {[undefined, ...BEDS].map((b) => (
          <button
            key={b ?? 'any'}
            type="button"
            onClick={() => onChange(b)}
            className={cn(
              'h-10 min-w-10 flex-1 rounded-lg border px-2 text-[13.5px] font-semibold transition-colors',
              value === b ? 'border-primary bg-primary text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400',
            )}
          >
            {b === undefined ? 'Any' : b === 5 ? '5+' : b}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Where: a society, one of its phases, or a locality — typed or picked. On a
 * society's own pages its phases come first.
 */
function LocationPicker({
  places,
  value,
  onChange,
  disabled,
  focusSociety,
  loading,
}: {
  places: Place[];
  value: string;
  onChange: (slug: string) => void;
  disabled?: boolean;
  focusSociety?: string;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const chosen = places.find((p) => p.slug === value);

  useEffect(() => {
    const close = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    const match = (p: Place) => !term || p.name.toLowerCase().includes(term);
    const byId = new Map(places.map((p) => [p.id, p]));
    const societies = places.filter((p) => p.kind === 'society');
    const phasesOf = (id: string) => places.filter((p) => p.parent === id).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    const out: { title: string; rows: (Place & { indent?: boolean })[] }[] = [];

    const focus = focusSociety ? places.find((p) => p.slug === focusSociety && p.kind === 'society') ?? places.find((p) => p.slug === focusSociety && p.kind === 'phase' && p.parent && byId.get(p.parent)) : undefined;
    const focusRoot = focus?.kind === 'phase' ? byId.get(focus.parent!) : focus;
    if (focusRoot) {
      const rows = [focusRoot, ...phasesOf(focusRoot.id).map((p) => ({ ...p, indent: true }))].filter(match);
      if (rows.length) out.push({ title: `${toTitleCase(focusRoot.name)} & its phases`, rows });
    }
    const soc = societies
      .filter((s) => s.id !== focusRoot?.id)
      .flatMap((s) => {
        const kids = phasesOf(s.id);
        const ok = match(s) || kids.some(match);
        return ok ? [s, ...kids.filter((k) => match(k) || match(s)).map((k) => ({ ...k, indent: true }))] : [];
      });
    if (soc.length) out.push({ title: 'Societies', rows: soc });
    const plain = places
      .filter((p) => p.kind !== 'society' && !(p.kind === 'phase' && p.parent && byId.has(p.parent)) && match(p))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    if (plain.length) out.push({ title: soc.length || focusRoot ? 'Areas' : 'Locations', rows: plain });
    return out;
  }, [places, q, focusSociety]);

  const pick = (slug: string) => {
    onChange(slug);
    setQ('');
    setOpen(false);
  };

  return (
    <div ref={box} className="relative">
      <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        value={open ? q : chosen ? toTitleCase(chosen.name) : ''}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        disabled={disabled}
        placeholder={disabled ? 'Choose a city first' : loading ? 'Loading locations…' : 'Area, society or phase'}
        aria-label="Location"
        className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-9 text-[14px] text-slate-900 outline-none transition-colors placeholder:text-slate-400 hover:border-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-slate-50"
      />
      {value && !open && (
        <button type="button" aria-label="Clear location" onClick={() => pick('')} className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          <X className="h-4 w-4" />
        </button>
      )}
      {open && !disabled && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-[80] max-h-[320px] overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl sm:min-w-[320px]">
          {value && (
            <button type="button" onClick={() => pick('')} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13.5px] text-primary hover:bg-slate-50">
              All of the city
            </button>
          )}
          {groups.length === 0 && <p className="px-3 py-4 text-center text-[13px] text-slate-400">{loading ? 'Loading…' : 'No location found'}</p>}
          {groups.map((g) => (
            <div key={g.title}>
              <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{g.title}</p>
              {g.rows.map((p) => (
                <button
                  key={`${g.title}-${p.id}`}
                  type="button"
                  onClick={() => pick(p.slug)}
                  className={cn('flex w-full items-center gap-2 py-2 pr-3 text-left hover:bg-slate-50', p.indent ? 'pl-8' : 'pl-3')}
                >
                  {p.kind === 'society' ? <Building2 className="h-3.5 w-3.5 shrink-0 text-primary" /> : p.indent ? <Layers className="h-3.5 w-3.5 shrink-0 text-slate-400" /> : <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-300" />}
                  <span className={cn('min-w-0 flex-1 truncate text-[13.5px]', p.kind === 'society' ? 'font-semibold text-slate-900' : 'text-slate-700')}>{toTitleCase(p.name)}</span>
                  {p.count > 0 && <span className="shrink-0 text-[11.5px] tabular-nums text-slate-400">{p.count}</span>}
                  {p.slug === value && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SearchPanel({
  variant,
  initialCities,
  initialTypes,
  defaultCity,
  current,
}: {
  variant: 'hero' | 'bar';
  /** Bar: what the results page shows (read from its address by ArchiveSearchBar). */
  current?: SearchState;
  initialCities?: City[];
  initialTypes?: string[];
  /** Hero: the city to start on (Settings → General → Default city). */
  defaultCity?: string;
}) {
  const router = useRouter();
  const fromUrl = variant === 'bar' ? current ?? null : null;

  const [cities, setCities] = useState<City[]>(initialCities ?? []);
  const [types, setTypes] = useState<string[]>((initialTypes ?? []).map((t) => t.toLowerCase()));
  const [places, setPlaces] = useState<Place[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [s, setS] = useState<SearchState>(() => fromUrl ?? { ...EMPTY_SEARCH, purpose: 'sale', citySlug: defaultCity ? toSlug(defaultCity) : '' });
  const [sheet, setSheet] = useState(false);
  const [more, setMore] = useState(false);

  // A new results page: the panel shows what it shows.
  const urlKey = fromUrl ? searchUrl(fromUrl) : '';
  useEffect(() => {
    if (fromUrl) setS(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlKey]);

  useEffect(() => {
    if (initialCities?.length && initialTypes?.length) return;
    Promise.all([cities.length ? Promise.resolve(cities) : cityApi.getNames(), types.length ? Promise.resolve(types) : propertyApi.getTypes()])
      .then(([c, t]) => {
        setCities(sortCitiesByPopularity((c as City[]).map((x) => ({ _id: x._id, name: x.name }))));
        setTypes(((t as string[]) ?? []).map((x) => String(x).toLowerCase()));
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const city = cities.find((c) => toSlug(c.name) === s.citySlug);

  // The city's locations: societies, their phases and the areas, with how many listings each has.
  useEffect(() => {
    if (!city) {
      setPlaces([]);
      return;
    }
    let off = false;
    setLoadingPlaces(true);
    Promise.all([
      areaApi.getNames(city._id),
      propertyApi.getLocationStats(city.name).catch(() => null),
    ])
      .then(([names, stats]) => {
        if (off) return;
        const rows = ((stats as { locations?: { id: string; count: number }[] } | null)?.locations ?? []);
        const counts = new Map<string, number>(rows.map((l) => [String(l.id), Number(l.count) || 0]));
        setPlaces(
          names.map((a) => ({
            id: a._id,
            name: a.name,
            slug: a.areaSlug || toSlug(a.name),
            kind: a.kind,
            parent: a.parent,
            count: counts.get(a._id) ?? 0,
          })),
        );
      })
      .catch(() => !off && setPlaces([]))
      .finally(() => !off && setLoadingPlaces(false));
    return () => {
      off = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city?._id, city?.name]);

  const set = (patch: Partial<SearchState>) => setS((prev) => ({ ...prev, ...patch }));
  const go = (next: SearchState = s) => {
    setSheet(false);
    router.push(searchUrl(next));
  };

  const prices = s.purpose === 'rent' ? RENT_PRICES : SALE_PRICES;
  const typeOptions = useMemo(() => {
    const list = types.length ? types : ['house', 'flat', 'plot', 'shop', 'office', 'commercial'];
    const order = ['house', 'flat', 'apartment', 'plot', 'shop', 'office', 'commercial', 'land', 'factory', 'hotel', 'restaurant'];
    return [...new Set(list)].filter((t) => t !== 'other').sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
  }, [types]);
  const showBeds = !NO_BEDS.includes(s.type);
  const extras = extraCount(s);

  const purposeTabs = (compact = false) => (
    <div role="tablist" aria-label="Buy or rent" className={cn('flex shrink-0 overflow-hidden rounded-lg border border-slate-300 bg-white', compact ? 'h-11' : 'h-11')}>
      {(
        [
          ['sale', 'Buy'],
          ['rent', 'Rent'],
        ] as [Purpose, string][]
      ).map(([v, label], i) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={s.purpose === v}
          onClick={() => {
            const next = { ...s, purpose: s.purpose === v && variant === 'bar' ? ('all' as Purpose) : v, priceMin: undefined, priceMax: undefined };
            setS(next);
            if (variant === 'bar') go(next);
          }}
          className={cn(
            'px-4 text-[14px] font-semibold transition-colors',
            i > 0 && 'border-l border-slate-300',
            s.purpose === v ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );

  // Typed or picked: "mul" finds Multan.
  const citySelect = (
    <CityPicker
      options={cities.map((c) => ({ value: toSlug(c.name), label: toTitleCase(c.name) }))}
      value={s.citySlug}
      onChange={(v) => set({ citySlug: v, areaSlug: '' })}
      allLabel="All cities"
      placeholder="Search city"
    />
  );
  const location = (
    <LocationPicker places={places} value={s.areaSlug} onChange={(v) => set({ areaSlug: v })} disabled={!s.citySlug} loading={loadingPlaces} focusSociety={fromUrl?.areaSlug || undefined} />
  );
  const typeSelect = (
    <Select label="Property type" value={s.type} onChange={(v) => set({ type: v, ...(NO_BEDS.includes(v) ? { beds: undefined } : {}) })}>
      <option value="">All types</option>
      {typeOptions.map((t) => (
        <option key={t} value={t}>
          {TYPE_LABELS[t] ?? toTitleCase(t)}
        </option>
      ))}
    </Select>
  );
  const priceRange = (
    <Range label={s.purpose === 'rent' ? 'Rent (PKR / month)' : 'Price (PKR)'} options={prices} fmt={priceLabel} min={s.priceMin} max={s.priceMax} onChange={(a, b) => set({ priceMin: a, priceMax: b })} />
  );
  const sizeRange = <Range label="Area (Marla)" options={MARLA_SIZES} fmt={marlaLabel} min={s.marlaMin} max={s.marlaMax} onChange={(a, b) => set({ marlaMin: a, marlaMax: b })} />;
  const keyword = (
    <div>
      <p className="mb-1.5 text-[12.5px] font-semibold text-slate-700">Keyword</p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={s.search ?? ''}
          onChange={(e) => set({ search: e.target.value })}
          placeholder="Corner, park facing, furnished…"
          className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-[14px] outline-none placeholder:text-slate-400 hover:border-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/15"
        />
      </div>
    </div>
  );
  const findButton = (label = 'Find', className = '') => (
    <button type="submit" className={cn('btn-shape inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-[15px] font-semibold text-white transition-colors hover:bg-primary/90', className)}>
      <Search className="h-4 w-4" />
      {label}
    </button>
  );
  const clearExtras = () => set({ priceMin: undefined, priceMax: undefined, marlaMin: undefined, marlaMax: undefined, beds: undefined, search: undefined });

  /** Every field, stacked — the phone sheet. */
  const fullForm = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ['sale', 'Buy'],
            ['rent', 'Rent'],
          ] as [Purpose, string][]
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => set({ purpose: v, priceMin: undefined, priceMax: undefined })}
            className={cn('h-11 rounded-lg border text-[14px] font-semibold', s.purpose === v ? 'border-primary bg-primary text-white' : 'border-slate-300 text-slate-700')}
          >
            {label}
          </button>
        ))}
      </div>
      <div>
        <p className="mb-1.5 text-[12.5px] font-semibold text-slate-700">City</p>
        {citySelect}
      </div>
      <div>
        <p className="mb-1.5 text-[12.5px] font-semibold text-slate-700">Location</p>
        {location}
      </div>
      <div>
        <p className="mb-1.5 text-[12.5px] font-semibold text-slate-700">Property type</p>
        {typeSelect}
      </div>
      {priceRange}
      {sizeRange}
      {showBeds && <Beds value={s.beds} onChange={(b) => set({ beds: b })} />}
      {keyword}
    </div>
  );

  // ── Homepage card ──
  if (variant === 'hero') {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go();
        }}
        className="mx-auto mt-6 max-w-5xl rounded-2xl bg-white text-left shadow-[0_20px_50px_-20px_rgba(0,0,0,0.45)] sm:mt-8"
      >
        <div role="tablist" aria-label="Purpose" className="flex border-b border-slate-200 px-2">
          {(
            [
              ['sale', 'Buy'],
              ['rent', 'Rent'],
            ] as [Purpose, string][]
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={s.purpose === v}
              onClick={() => set({ purpose: v, priceMin: undefined, priceMax: undefined })}
              className={cn('-mb-px border-b-2 px-4 py-3 text-[14px] font-semibold transition-colors', s.purpose === v ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-900')}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2.5 p-3 sm:p-4 lg:grid-cols-[1fr_1.4fr_1fr_auto] lg:gap-3">
          <div className="col-span-1">{citySelect}</div>
          <div className="col-span-1 lg:col-span-1">{typeSelect}</div>
          <div className="col-span-2 lg:order-none lg:col-span-1 lg:row-start-1 lg:col-start-2">{location}</div>
          {findButton('Find', 'col-span-2 lg:col-span-1')}
        </div>
        {/* Price, size, beds — open on a desktop, one tap away on a phone. */}
        <div className="border-t border-slate-100 px-3 pb-3 sm:px-4 sm:pb-4">
          <button type="button" onClick={() => setMore((v) => !v)} className="flex w-full items-center gap-1.5 py-2.5 text-[13.5px] font-semibold text-primary lg:hidden">
            <SlidersHorizontal className="h-4 w-4" />
            {more ? 'Fewer options' : 'Price, size & more'}
            {extras > 0 && <span className="rounded-full bg-primary px-1.5 text-[11px] text-white">{extras}</span>}
            <ChevronDown className={cn('ml-auto h-4 w-4 transition-transform', more && 'rotate-180')} />
          </button>
          <div className={cn('grid gap-3 pt-1 sm:grid-cols-2 lg:grid-cols-[1.25fr_1.25fr_0.7fr_1fr] lg:pt-3', !more && 'hidden lg:grid')}>
            {priceRange}
            {sizeRange}
            {showBeds && (
              <div>
                <p className="mb-1.5 text-[12.5px] font-semibold text-slate-700">Bedrooms</p>
                <Select label="Bedrooms" value={s.beds ? String(s.beds) : ''} onChange={(v) => set({ beds: v ? Number(v) : undefined })}>
                  <option value="">Any</option>
                  {BEDS.map((b) => (
                    <option key={b} value={b}>
                      {b === 5 ? '5+' : b} {b === 1 ? 'bed' : 'beds'}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            {keyword}
          </div>
        </div>
      </form>
    );
  }

  // ── Results pages ──
  const where = [s.areaSlug ? toTitleCase(places.find((p) => p.slug === s.areaSlug)?.name ?? s.areaSlug.replace(/-/g, ' ')) : '', city ? toTitleCase(city.name) : ''].filter(Boolean).join(', ');

  return (
    <section className="relative z-40 border-b border-slate-200 bg-white lg:sticky lg:top-16">
      {/* Phone & tablet: Buy / Rent, where, Filters. */}
      <div className="container mx-auto flex items-center gap-2 px-[var(--gutter)] py-2.5 sm:px-4 lg:hidden">
        {purposeTabs(true)}
        <button type="button" onClick={() => setSheet(true)} className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-left">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <span className={cn('truncate text-[14px]', where ? 'font-medium text-slate-900' : 'text-slate-400')}>{where || 'City, area or society'}</span>
        </button>
        <button type="button" onClick={() => setSheet(true)} className="relative grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-slate-300 bg-white text-slate-700" aria-label="Filters">
          <SlidersHorizontal className="h-[18px] w-[18px]" />
          {extras + (s.type ? 1 : 0) > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-white">{extras + (s.type ? 1 : 0)}</span>}
        </button>
      </div>

      <Sheet open={sheet} onOpenChange={setSheet}>
        <SheetContent side="bottom" className="flex h-[92dvh] flex-col gap-0 rounded-t-2xl p-0 lg:hidden [&>button.absolute]:hidden">
          <div className="flex items-center justify-between border-b px-4 py-3.5">
            <SheetTitle className="text-[16px] font-bold">Search properties</SheetTitle>
            <button type="button" onClick={() => setSheet(false)} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100">
              <X className="h-5 w-5" />
            </button>
          </div>
          <form
            id="search-sheet"
            onSubmit={(e) => {
              e.preventDefault();
              go();
            }}
            className="flex-1 overflow-y-auto px-4 py-4"
          >
            {fullForm}
          </form>
          <div className="flex gap-2 border-t bg-white px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <button type="button" onClick={() => setS({ ...EMPTY_SEARCH, purpose: s.purpose, citySlug: s.citySlug })} className="h-11 flex-1 rounded-lg border border-slate-300 text-[14px] font-semibold text-slate-700">
              Reset
            </button>
            <button type="submit" form="search-sheet" className="btn-shape h-11 flex-[2] rounded-lg bg-primary text-[14px] font-semibold text-white">
              Show results
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop: one row. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go();
        }}
        className="container mx-auto hidden items-center gap-2 px-4 py-2.5 lg:flex"
      >
        {purposeTabs()}
        <div className="w-40 shrink-0 xl:w-44">{citySelect}</div>
        <div className="min-w-0 flex-1">{location}</div>
        <div className="w-36 shrink-0 xl:w-40">{typeSelect}</div>
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className={cn(field, 'w-auto max-w-[200px] truncate pr-8 text-left', (s.priceMin || s.priceMax) && 'border-primary text-primary')}>
              {rangeLabel(s.priceMin, s.priceMax, priceLabel, 'Price')}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[340px]">
            {priceRange}
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className={cn(field, 'w-auto max-w-[180px] truncate pr-8 text-left', (s.marlaMin || s.marlaMax) && 'border-primary text-primary')}>
              {rangeLabel(s.marlaMin, s.marlaMax, marlaLabel, 'Area')}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[320px]">
            {sizeRange}
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className={cn(field, 'relative w-auto pr-8 text-left', (s.beds || s.search) && 'border-primary text-primary')}>
              More
              {(s.beds || s.search) && <span className="ml-1.5 rounded-full bg-primary px-1.5 text-[11px] text-white">{[s.beds, s.search].filter(Boolean).length}</span>}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[340px] space-y-4">
            {showBeds && <Beds value={s.beds} onChange={(b) => set({ beds: b })} />}
            {keyword}
            {extras > 0 && (
              <button type="button" onClick={clearExtras} className="text-[13px] font-semibold text-slate-500 hover:text-slate-900">
                Clear price, size & more
              </button>
            )}
          </PopoverContent>
        </Popover>
        {findButton('Search', 'shrink-0 px-5')}
      </form>
    </section>
  );
}

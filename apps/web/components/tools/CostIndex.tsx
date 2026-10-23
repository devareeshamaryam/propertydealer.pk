import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { CC_SIZES, ccHref, pageCities, sampleHouse, type CcKind, type CcSize } from '@/lib/construction-pages';
import { rsShort, rupees, type ConstructionData } from '@/lib/tools';
import { cn } from '@/lib/utils';

/**
 * Every plot size's cost in one city — each linked to its own page — and the
 * same size in the other cities. Shown under the calculator and on every
 * ready-made page, so they all link to each other.
 */
export default function CostIndex({ data, city, current }: { data: ConstructionData; city: string; current?: { size: CcSize; kind: CcKind } }) {
  const rows = CC_SIZES.map((s) => ({ s, grey: sampleHouse(data, s.sqft, 'grey', city), house: sampleHouse(data, s.sqft, 'house', city) }));
  const size = current?.size ?? CC_SIZES.find((s) => s.key === '5-marla')!;
  const kind = current?.kind ?? 'house';
  const others = pageCities(data).filter((c) => c.name !== city);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-[21px] font-bold tracking-tight text-slate-900">House construction cost in {city}</h2>
        <p className="mt-0.5 text-[14px] text-slate-600">Double storey, standard quality, on today&apos;s rates. Tap a size for its full breakdown.</p>
        <div className="mt-3 overflow-hidden rounded-lg border border-slate-300 bg-white">
          <div className="hidden grid-cols-[1.1fr_1fr_1.2fr_1.2fr] gap-2 bg-slate-50 px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wide text-slate-600 sm:grid">
            <span>Plot</span>
            <span className="text-right">Covered area</span>
            <span className="text-right">Grey structure</span>
            <span className="text-right">Complete house</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {rows.map(({ s, grey, house }) => {
              const here = current?.size.key === s.key;
              return (
                <li key={s.key} className={cn('grid grid-cols-2 items-center gap-x-2 gap-y-1 px-4 py-3 sm:grid-cols-[1.1fr_1fr_1.2fr_1.2fr]', here && 'bg-primary/[0.05]')}>
                  <span className="text-[15px] font-bold text-slate-900">{s.label}</span>
                  <span className="text-right text-[13.5px] tabular-nums text-slate-600">{Math.round(house.area).toLocaleString('en-PK')} ft²</span>
                  <Link
                    href={ccHref(s, 'grey', city)}
                    className={cn('rounded-lg px-2 py-1 text-[14px] tabular-nums hover:bg-primary/10 sm:text-right', here && current?.kind === 'grey' ? 'font-bold text-primary' : 'text-slate-700')}
                  >
                    <span className="text-[12px] text-slate-600 sm:hidden">Grey </span>
                    {rsShort(grey.total)}
                    <span className="block text-[11.5px] text-slate-600">{rupees(grey.perSqft)}/ft²</span>
                  </Link>
                  <Link
                    href={ccHref(s, 'house', city)}
                    className={cn('rounded-lg px-2 py-1 text-right text-[14px] font-semibold tabular-nums hover:bg-primary/10', here && current?.kind === 'house' ? 'text-primary' : 'text-slate-900')}
                  >
                    <span className="text-[12px] font-normal text-slate-600 sm:hidden">Complete </span>
                    {rsShort(house.total)}
                    <span className="block text-[11.5px] font-normal text-slate-600">{rupees(house.perSqft)}/ft²</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {others.length > 0 && (
        <section>
          <h2 className="text-[19px] font-bold tracking-tight text-slate-900">
            {size.label} {kind === 'grey' ? 'grey structure' : 'house'} cost in other cities
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {others.map((c) => {
              const e = sampleHouse(data, size.sqft, kind, c.name);
              return (
                <Link key={c.name} href={ccHref(size, kind, c.name)} className="group flex items-center gap-2.5 rounded-xl border border-slate-300 bg-white px-3 py-2.5 transition-colors hover:border-primary/50">
                  <MapPin className="h-4 w-4 shrink-0 text-slate-600 group-hover:text-primary" />
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-semibold text-slate-800 group-hover:text-primary">{c.name}</span>
                    <span className="block text-[12.5px] tabular-nums text-slate-600">{rsShort(e.total)}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

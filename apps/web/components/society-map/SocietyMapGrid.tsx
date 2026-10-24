import Link from 'next/link';
import { OFFICIAL_LABELS, type SocietyCard } from '@/lib/society-map';
import { cn } from '@/lib/utils';

/*
 * Society maps as cards (the ones with a picture: master plans and approved
 * layout plans) or as a compact list (outlines), for the city pages and the
 * /emap index. Every link is a society map page that exists.
 */

const KIND = {
  plan: { label: 'Master plan on map', tag: 'Master plan' },
  document: { label: 'Approved layout plan', tag: 'Layout plan' },
  outline: { label: 'Society outline', tag: 'Outline' },
} as const;

/** The kind of map, as a small text tag. */
function KindTag({ kind }: { kind: keyof typeof KIND }) {
  return (
    <span className={cn('shrink-0 rounded-sm px-1.5 py-[3px] text-[10px] font-bold uppercase leading-none tracking-wider', kind === 'outline' ? 'border border-slate-400 text-slate-700' : 'bg-slate-900 text-white')}>
      {KIND[kind].tag}
    </span>
  );
}

function Status({ official }: { official: SocietyCard['official'] }) {
  if (!official) return null;
  const s = OFFICIAL_LABELS[official.status];
  if (!s) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm px-1.5 py-[3px] text-[10.5px] font-bold uppercase leading-none tracking-wide text-white',
        s.tone === 'good' ? 'bg-emerald-700' : s.tone === 'ok' ? 'bg-sky-700' : 'bg-red-700',
      )}
    >
      {official.authority} {s.label.toLowerCase()}
    </span>
  );
}

export default function SocietyMapGrid({ items, showCity = false, list = false }: { items: SocietyCard[]; showCity?: boolean; list?: boolean }) {
  if (list) {
    return (
      <ul className="grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((n) => {
          const K = KIND[n.kind ?? 'outline'];
          return (
            <li key={`${n.citySlug}/${n.slug}`} className="border-b border-slate-200">
              <Link href={`/emap/${n.citySlug}/${n.slug}`} className="group flex items-center gap-2.5 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[14.5px] font-semibold text-slate-900 group-hover:underline">{n.name} Map</span>
                    <KindTag kind={n.kind ?? 'outline'} />
                  </span>
                  <span className="flex flex-wrap items-center gap-1 text-[12.5px] text-slate-600">
                    {[showCity ? n.cityName : '', n.blocks ? `${n.blocks} blocks` : ''].filter(Boolean).join(' · ') || K.label}
                    <Status official={n.official} />
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 lg:gap-3">
      {items.map((n) => {
        const K = KIND[n.kind ?? 'plan'];
        return (
          <Link key={`${n.citySlug}/${n.slug}`} href={`/emap/${n.citySlug}/${n.slug}`} className="group overflow-hidden rounded-lg border border-slate-300 bg-white transition-colors hover:border-slate-900">
            <div className="relative aspect-[3/2] border-b border-slate-200 bg-slate-200">
              {n.thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={n.thumb} alt={`${n.name} map`} loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <span className="absolute inset-0 grid place-items-center text-[12px] font-bold uppercase tracking-wider text-slate-500">{K.tag}</span>
              )}
              {!!n.plots && (
                <span className="absolute left-2 top-2 rounded-sm bg-amber-400 px-1.5 py-[3px] text-[10.5px] font-bold leading-none text-slate-900">
                  {n.plots.toLocaleString('en-PK')} plots
                </span>
              )}
            </div>
            <div className="px-3 py-2">
              <p className="truncate text-[14.5px] font-bold text-slate-900 group-hover:underline">{n.name} Map</p>
              <p className="flex flex-wrap items-center gap-1 truncate text-[12.5px] text-slate-600">
                {[showCity ? n.cityName : '', n.blocks ? `${n.blocks} blocks` : ''].filter(Boolean).join(' · ') || K.label}
              </p>
              {n.official && <div className="mt-1"><Status official={n.official} /></div>}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

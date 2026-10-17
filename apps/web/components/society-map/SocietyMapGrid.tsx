import Link from 'next/link';
import { BadgeCheck, FileImage, Map as MapIcon, ShieldAlert, Spline } from 'lucide-react';
import { OFFICIAL_LABELS, type SocietyCard } from '@/lib/society-map';
import { cn } from '@/lib/utils';

/*
 * Society maps as cards (the ones with a picture: master plans and approved
 * layout plans) or as a compact list (outlines), for the city pages and the
 * /emap index. Every link is a society map page that exists.
 */

const KIND = {
  plan: { label: 'Master plan on map', icon: MapIcon },
  document: { label: 'Approved layout plan', icon: FileImage },
  outline: { label: 'Society outline', icon: Spline },
} as const;

function Status({ official }: { official: SocietyCard['official'] }) {
  if (!official) return null;
  const s = OFFICIAL_LABELS[official.status];
  if (!s) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold',
        s.tone === 'good' ? 'bg-emerald-50 text-emerald-700' : s.tone === 'ok' ? 'bg-sky-50 text-sky-700' : 'bg-red-50 text-red-700',
      )}
    >
      {s.tone === 'bad' ? <ShieldAlert className="h-3 w-3" /> : <BadgeCheck className="h-3 w-3" />}
      {official.authority} {s.label.toLowerCase()}
    </span>
  );
}

export default function SocietyMapGrid({ items, showCity = false, list = false }: { items: SocietyCard[]; showCity?: boolean; list?: boolean }) {
  if (list) {
    return (
      <ul className="grid gap-x-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((n) => {
          const K = KIND[n.kind ?? 'outline'];
          return (
            <li key={`${n.citySlug}/${n.slug}`} className="border-b border-slate-100">
              <Link href={`/emap/${n.citySlug}/${n.slug}`} className="group flex items-center gap-2.5 py-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500 group-hover:bg-primary/10 group-hover:text-primary">
                  <K.icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-slate-900 group-hover:text-primary">{n.name} Map</span>
                  <span className="flex flex-wrap items-center gap-1 text-[12px] text-slate-500">
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
          <Link key={`${n.citySlug}/${n.slug}`} href={`/emap/${n.citySlug}/${n.slug}`} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition-colors hover:border-primary">
            <div className="relative aspect-[3/2] bg-gradient-to-br from-slate-100 to-slate-200">
              {n.thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={n.thumb} alt={`${n.name} map`} loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <K.icon className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 text-slate-400" />
              )}
              {!!n.plots && (
                <span className="absolute left-2 top-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10.5px] font-bold text-slate-900">
                  {n.plots.toLocaleString('en-PK')} plots
                </span>
              )}
            </div>
            <div className="px-3 py-2">
              <p className="truncate text-[14px] font-semibold text-slate-900 group-hover:text-primary">{n.name} Map</p>
              <p className="flex flex-wrap items-center gap-1 truncate text-[12px] text-slate-500">
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

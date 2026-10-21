import Link from 'next/link';
import { BadgeCheck, Building2, Layers } from 'lucide-react';
import { APPROVAL_LABELS, pkPrice, societyPath, type SocietyCard as Card } from '@/lib/societies';
import { cn } from '@/lib/utils';

/** A society's card: its featured image, name, approval, phases, listings and starting price. */
export default function SocietyCard({ s, className }: { s: Card; className?: string }) {
  const approval = APPROVAL_LABELS[s.approval];
  return (
    <Link
      href={societyPath(s.citySlug, s.slug)}
      className={cn(
        'group flex h-full flex-col overflow-hidden rounded-xl border sm:rounded-2xl border-slate-200 bg-white transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_12px_30px_-14px_rgba(15,23,42,0.35)]',
        className,
      )}
    >
      <span className="relative block aspect-[16/10] overflow-hidden bg-slate-100">
        {s.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.image} alt={`${s.name} ${s.cityName}`} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <span className="grid h-full w-full place-items-center bg-gradient-to-br from-primary/15 to-primary/5">
            <Building2 className="h-10 w-10 text-primary/50" />
          </span>
        )}
        {approval && (
          <span
            className={cn(
              'absolute left-1.5 top-1.5 inline-flex max-w-[calc(100%-12px)] items-center gap-1 truncate rounded-full px-1.5 py-0.5 text-[10px] font-bold shadow-sm sm:left-2.5 sm:top-2.5 sm:px-2 sm:text-[11px]',
              approval.tone === 'good' ? 'bg-emerald-600 text-white' : approval.tone === 'ok' ? 'bg-amber-400 text-amber-950' : 'bg-red-600 text-white',
            )}
          >
            {approval.tone === 'good' && <BadgeCheck className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />}
            {s.approvedBy && approval.tone === 'good' ? `${s.approvedBy} approved` : approval.label}
          </span>
        )}
      </span>
      <span className="flex flex-1 flex-col p-2.5 sm:p-3.5">
        <span className="line-clamp-1 text-[14px] font-bold capitalize text-slate-900 group-hover:text-primary sm:text-[16px]">{s.name}</span>
        <span className="line-clamp-1 text-[11.5px] text-slate-500 sm:text-[12.5px]">{s.tagline || s.cityName}</span>
        <span className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 pt-2 text-[11.5px] text-slate-600 sm:pt-2.5 sm:text-[12.5px]">
          <span>
            {s.listings} {s.listings === 1 ? 'listing' : 'listings'}
            {s.phases > 0 && (
              <span className="ml-1.5 inline-flex items-center gap-0.5 text-slate-500">
                <Layers className="h-3.5 w-3.5" /> {s.phases} {s.phases === 1 ? 'phase' : 'phases'}
              </span>
            )}
          </span>
          {s.priceFrom > 0 && <span className="font-semibold text-slate-900">from {pkPrice(s.priceFrom)}</span>}
        </span>
      </span>
    </Link>
  );
}

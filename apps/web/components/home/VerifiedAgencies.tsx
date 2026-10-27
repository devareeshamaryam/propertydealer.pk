import Link from 'next/link';
import { BadgeCheck, Building2 } from 'lucide-react';
import { agentProfilePath } from '@/lib/agent';
import type { SpotlightAgency } from '@/lib/server-api';
import { photo } from '@/lib/img';

/* Homepage: agencies on a plan with the spotlight benefit. Hidden when there are none. */
export default function VerifiedAgencies({ agencies, dealersHref }: { agencies: SpotlightAgency[]; dealersHref?: string | null }) {
  if (!agencies.length) return null;
  return (
    <section className="container mx-auto px-[var(--gutter)] py-8 sm:px-4 sm:py-10">
      <div className="mb-4 flex items-end justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[22px] font-bold tracking-tight text-slate-900 sm:text-[26px]">
          <BadgeCheck className="h-6 w-6 text-sky-500" /> Verified agencies
        </h2>
        {dealersHref && <Link href={dealersHref} className="text-[14px] font-semibold text-primary hover:underline">All property dealers</Link>}
      </div>
      <div className="hide-scrollbar -mx-[var(--gutter)] flex snap-x gap-2.5 overflow-x-auto px-[var(--gutter)] sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0 lg:grid-cols-6">
        {agencies.map((a) => (
          <Link
            key={a._id}
            href={agentProfilePath({ _id: a._id, name: a.name }) ?? '/agents'}
            className="flex w-[44%] shrink-0 snap-start flex-col items-center rounded-2xl border border-slate-200 bg-white p-4 text-center transition-colors hover:border-primary sm:w-auto"
          >
            <span className="relative grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-slate-100">
              {a.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo(a.avatarUrl, 96)} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <Building2 className="h-7 w-7 text-slate-400" />
              )}
            </span>
            <span className="mt-2 flex items-center justify-center gap-1 text-[14px] font-semibold leading-tight text-slate-900">
              <span className="line-clamp-2">{a.name}</span>
              <BadgeCheck className="h-4 w-4 shrink-0 text-sky-500" aria-label="Verified" />
            </span>
            <span className="mt-0.5 text-[12px] text-slate-500">{a.listings} {a.listings === 1 ? 'listing' : 'listings'}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

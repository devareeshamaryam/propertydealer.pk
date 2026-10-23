import Link from 'next/link';
import { BadgeCheck, Building2, Home, MapPin, Phone, UserRound, Users } from 'lucide-react';
import { photo } from '@/lib/img';
import { dealerHref, waNumber, type DealerCard } from '@/lib/dealers';
import { cn } from '@/lib/utils';

/*
 * Cards of the property dealers directory. Plain components (no server-only
 * imports) so "Show more" can render the same cards in the browser.
 */

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2s.8 2.3 1 2.5c.1.2 1.7 2.6 4.1 3.6 1.5.7 2.1.7 2.9.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
    </svg>
  );
}

function Contact({ d, compact }: { d: DealerCard; compact?: boolean }) {
  const wa = waNumber(d.whatsapp || d.phone);
  const tel = String(d.phone || d.whatsapp || '').replace(/[^\d+]/g, '');
  if (!wa && !tel) return null;
  return (
    <div className={cn('relative z-20 flex gap-2', compact ? '' : 'mt-4')}>
      {tel && (
        <a
          href={`tel:${tel}`}
          className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-[14px] font-semibold text-slate-900 hover:border-slate-400"
          aria-label={`Call ${d.name}`}
        >
          <Phone className="h-4 w-4" /> Call
        </a>
      )}
      {wa && (
        <a
          href={`https://wa.me/${wa}`}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#1fa855] px-3 text-[14px] font-semibold text-white hover:bg-[#178a45]"
          aria-label={`WhatsApp ${d.name}`}
        >
          <WhatsAppIcon className="h-4 w-4" /> WhatsApp
        </a>
      )}
    </div>
  );
}

const plural = (n: number, one: string, many: string) => `${n.toLocaleString('en-PK')} ${n === 1 ? one : many}`;

/** An agency: cover, logo, team and listings, and how to reach it. */
export function AgencyCard({ d }: { d: DealerCard }) {
  const href = dealerHref(d);
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-300 bg-white transition-colors hover:border-primary">
      <Link href={href} className="absolute inset-0 z-10" aria-label={d.name} />
      <div className="relative h-24 bg-gradient-to-br from-[var(--brand-navy,#0f2c5c)] to-primary sm:h-28">
        {d.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo(d.coverUrl, 640)} alt="" loading="lazy" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="flex flex-1 flex-col px-4 pb-4">
        <div className="relative -mt-9 flex items-end gap-3">
          <span className="grid h-[72px] w-[72px] shrink-0 place-items-center overflow-hidden rounded-xl border-4 border-white bg-slate-100 shadow-sm">
            {d.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo(d.avatarUrl, 160)} alt={`${d.name} logo`} loading="lazy" className="h-full w-full object-cover" />
            ) : (
              <Building2 className="h-7 w-7 text-slate-500" />
            )}
          </span>
        </div>
        <h3 className="mt-2 flex items-start gap-1.5 text-[17px] font-bold leading-snug text-slate-900">
          <span className="line-clamp-2">{d.name}</span>
          {d.verified && <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-sky-500" aria-label="Verified" />}
        </h3>
        {d.person && <p className="text-[13.5px] text-slate-700">{d.person}</p>}
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[13.5px] font-medium text-slate-800">
          {d.agents > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-4 w-4 text-primary" /> {plural(d.agents, 'agent', 'agents')}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <Home className="h-4 w-4 text-primary" /> {plural(d.listings, 'listing', 'listings')}
          </span>
        </div>
        {d.address && (
          <p className="mt-1.5 flex items-start gap-1.5 text-[13px] text-slate-600">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span className="line-clamp-1">{d.address}</span>
          </p>
        )}
        <div className="mt-auto">
          <Contact d={d} />
        </div>
      </div>
    </article>
  );
}

/** An agent: photo, agency (or independent), listings, and how to reach them. */
export function AgentCard({ d }: { d: DealerCard }) {
  const href = dealerHref(d);
  return (
    <article className="group relative flex flex-col gap-3 rounded-xl border border-slate-300 bg-white p-3.5 transition-colors hover:border-primary sm:flex-row sm:items-center sm:p-4 lg:flex-col lg:items-stretch">
      <Link href={href} className="absolute inset-0 z-10 rounded-xl" aria-label={d.name} />
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200">
          {d.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo(d.avatarUrl, 160)} alt={d.name} loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <UserRound className="h-6 w-6 text-slate-500" />
          )}
        </span>
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 text-[16px] font-bold text-slate-900">
            <span className="truncate">{d.name}</span>
            {d.verified && <BadgeCheck className="h-[18px] w-[18px] shrink-0 text-sky-500" aria-label="Verified" />}
          </h3>
          <p className="truncate text-[13.5px] text-slate-700">
            {d.agency ? (
              <>
                Agent at <span className="font-semibold text-slate-900">{d.agency.name}</span>
              </>
            ) : d.companyName && d.companyName !== d.name ? (
              d.companyName
            ) : (
              'Property dealer'
            )}
          </p>
          <p className="mt-0.5 text-[13px] text-slate-600">
            {plural(d.listings, 'listing', 'listings')}
            {d.experienceYears > 0 && ` · ${d.experienceYears}+ yrs experience`}
          </p>
        </div>
      </div>
      <div className="sm:w-[230px] sm:shrink-0 lg:w-auto">
        <Contact d={d} compact />
      </div>
    </article>
  );
}

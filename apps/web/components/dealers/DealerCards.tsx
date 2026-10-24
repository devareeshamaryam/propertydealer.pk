import Link from 'next/link';
import { photo } from '@/lib/img';
import { dealerHref, waNumber, type DealerCard } from '@/lib/dealers';
import { cn } from '@/lib/utils';

/*
 * Cards of the property dealers directory — plain components (no server-only
 * imports) so the browser can render more of them after a search or "Show more".
 * Drawn glyphs, text badges and solid borders: a business directory, not a
 * set of icon tiles.
 */

/* ── Glyphs ── */

export function PhoneGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className={className} fill="currentColor">
      <path d="M5.3 2.2c.5-.2 1.1 0 1.4.4l1.6 2.6c.3.5.2 1.1-.2 1.5l-1 1c.8 1.7 2.1 3 3.8 3.8l1-1c.4-.4 1-.5 1.5-.2l2.6 1.6c.5.3.7.9.4 1.4l-.8 1.9c-.3.7-1 1.1-1.8 1C7.6 15.6 4.4 12.4 3.8 6.2c-.1-.8.3-1.5 1-1.8l.5-2.2z" />
    </svg>
  );
}

export function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2s.8 2.3 1 2.5c.1.2 1.7 2.6 4.1 3.6 1.5.7 2.1.7 2.9.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
    </svg>
  );
}

/** A filled tick in a rosette — the Verified mark. */
export function VerifiedGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className={className}>
      <path
        fill="currentColor"
        d="M10 1.5l2 1.4 2.4-.2.8 2.3 2.1 1.2-.5 2.4 1 2.2-1.7 1.7-.1 2.4-2.4.5-1.4 2-2.2-1-2.2 1-1.4-2-2.4-.5-.1-2.4L1.2 10.8l1-2.2-.5-2.4 2.1-1.2.8-2.3 2.4.2z"
      />
      <path d="M6.6 10.2l2.2 2.2 4.6-4.7" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PinGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className={className} fill="currentColor">
      <path d="M10 1.8a6 6 0 0 0-6 6c0 4.4 6 10.4 6 10.4s6-6 6-10.4a6 6 0 0 0-6-6Zm0 8.4a2.4 2.4 0 1 1 0-4.8 2.4 2.4 0 0 1 0 4.8Z" />
    </svg>
  );
}

/* ── Pieces ── */

const initials = (name: string) =>
  name
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || 'PD';

/** Logo or photo; the initials on a solid tile when there is none. */
function Face({ d, size, round }: { d: DealerCard; size: number; round?: boolean }) {
  const box = cn('grid shrink-0 place-items-center overflow-hidden border border-slate-300 bg-white', round ? 'rounded-full' : 'rounded-md');
  if (d.avatarUrl) {
    return (
      <span className={box} style={{ width: size, height: size }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo(d.avatarUrl, size > 64 ? 160 : 96)} alt={d.isAgency ? `${d.name} logo` : d.name} loading="lazy" className={cn('h-full w-full', d.isAgency ? 'object-contain p-1' : 'object-cover')} />
      </span>
    );
  }
  return (
    <span className={cn(box, 'border-slate-800 bg-slate-800 font-bold tracking-wide text-white')} style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }} aria-hidden>
      {initials(d.name)}
    </span>
  );
}

export function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-sm bg-sky-600 px-1.5 py-[3px] text-[10.5px] font-bold uppercase leading-none tracking-wider text-white">
      <VerifiedGlyph className="h-3 w-3 text-white [&>path:first-child]:fill-sky-600" /> Verified
    </span>
  );
}

function Contact({ d, small }: { d: DealerCard; small?: boolean }) {
  const wa = waNumber(d.whatsapp || d.phone);
  const tel = String(d.phone || d.whatsapp || '').replace(/[^\d+]/g, '');
  const h = small ? 'h-9 px-3 text-[13.5px]' : 'h-10 px-3.5 text-[14px]';
  return (
    <div className="relative z-20 flex gap-2">
      {tel && (
        <a href={`tel:${tel}`} className={cn('inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-slate-400 bg-white font-semibold text-slate-900 hover:border-slate-900', h)} aria-label={`Call ${d.name}`}>
          <PhoneGlyph className="h-4 w-4" /> Call
        </a>
      )}
      {wa && (
        <a
          href={`https://wa.me/${wa}`}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className={cn('inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-[#1a9e52] font-semibold text-white hover:bg-[#15843f]', h)}
          aria-label={`WhatsApp ${d.name}`}
        >
          <WhatsAppGlyph className="h-4 w-4" /> WhatsApp
        </a>
      )}
      {!tel && !wa && (
        <Link href={dealerHref(d)} className={cn('inline-flex flex-1 items-center justify-center rounded-md border border-slate-400 bg-white font-semibold text-slate-900', h)}>
          View profile
        </Link>
      )}
    </div>
  );
}

const n = (v: number) => v.toLocaleString('en-PK');

/* ── Cards ── */

/** An agency: its cover (when it has one), logo, team and listings, and how to reach it. */
export function AgencyCard({ d }: { d: DealerCard }) {
  return (
    <article className="relative flex flex-col overflow-hidden rounded-lg border border-slate-300 bg-white transition-shadow hover:shadow-[0_2px_10px_rgba(15,23,42,0.08)]">
      {d.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo(d.coverUrl, 640)} alt="" loading="lazy" className="h-28 w-full border-b border-slate-200 object-cover" />
      )}
      <div className="flex gap-3.5 p-4">
        <Face d={d} size={64} />
        <div className="min-w-0">
          <h3 className="text-[17px] font-bold leading-snug text-slate-900">
            <Link href={dealerHref(d)} className="line-clamp-2 after:absolute after:inset-0 hover:text-primary">
              {d.name}
            </Link>
          </h3>
          {d.person && <p className="mt-0.5 truncate text-[13.5px] text-slate-700">{d.person}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {d.verified && <VerifiedBadge />}
            <span className="rounded-sm border border-slate-300 px-1.5 py-[2px] text-[10.5px] font-bold uppercase leading-none tracking-wider text-slate-700">Agency</span>
          </div>
        </div>
      </div>
      <dl className="grid grid-cols-2 divide-x divide-slate-200 border-y border-slate-200 bg-slate-50 text-center">
        <div className="px-2 py-2.5">
          <dt className="text-[11.5px] font-semibold uppercase tracking-wider text-slate-600">Agents</dt>
          <dd className="text-[17px] font-bold tabular-nums text-slate-900">{n(d.agents)}</dd>
        </div>
        <div className="px-2 py-2.5">
          <dt className="text-[11.5px] font-semibold uppercase tracking-wider text-slate-600">Listings</dt>
          <dd className="text-[17px] font-bold tabular-nums text-slate-900">{n(d.listings)}</dd>
        </div>
      </dl>
      <div className="flex flex-1 flex-col gap-3 p-4 pt-3">
        <p className="flex min-h-[20px] items-start gap-1.5 text-[13.5px] text-slate-700">
          {d.address && (
            <>
              <PinGlyph className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" /> <span className="line-clamp-1">{d.address}</span>
            </>
          )}
        </p>
        <div className="mt-auto">
          <Contact d={d} />
        </div>
      </div>
    </article>
  );
}

/** An agent: one row of the agents list. */
export function AgentRow({ d }: { d: DealerCard }) {
  return (
    <li className="relative flex flex-col gap-3 px-4 py-3.5 hover:bg-slate-50 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Face d={d} size={48} round />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="truncate text-[15.5px] font-bold text-slate-900">
              <Link href={dealerHref(d)} className="after:absolute after:inset-0 hover:text-primary">
                {d.name}
              </Link>
            </h3>
            {d.verified && <VerifiedBadge />}
          </div>
          <p className="truncate text-[13.5px] text-slate-700">
            {d.agency ? (
              <>
                Agent · <span className="font-semibold text-slate-900">{d.agency.name}</span>
              </>
            ) : d.companyName && d.companyName !== d.name ? (
              d.companyName
            ) : (
              'Independent property dealer'
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4 text-[13.5px] text-slate-700 sm:w-[150px] sm:flex-col sm:items-start sm:gap-0">
        <span>
          <b className="tabular-nums text-slate-900">{n(d.listings)}</b> {d.listings === 1 ? 'listing' : 'listings'}
        </span>
        {d.experienceYears > 0 && <span>{d.experienceYears}+ yrs experience</span>}
      </div>
      <div className="sm:w-[220px] sm:shrink-0">
        <Contact d={d} small />
      </div>
    </li>
  );
}

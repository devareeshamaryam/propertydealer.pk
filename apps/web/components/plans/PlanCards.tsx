'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BadgeCheck, Check, Loader2, Star, X } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { loginUrl } from '@/lib/auth-intent';
import { cn } from '@/lib/utils';
import { planBenefits, planDuration, planPrice, sharedBenefits, type Plan } from '@/lib/plans';

/*
 * The plan cards — the same everywhere: homepage, /packages and the
 * dashboard's "Buy a Plan". Public pages link to the checkout (through sign-in
 * when needed); the dashboard passes `onChoose` and opens it in place.
 *
 * Phones and tablets get a swipeable row (one card in view, the next peeking
 * in, dots below) that opens on the most popular plan; desktops get the grid.
 * The benefits come from the plan's own numbers and switches (planBenefits),
 * so a card never promises what the plan does not do. What every plan has is
 * listed once under the cards rather than repeated five times.
 *
 * Free is never "bought": it is what every account has until it picks a paid
 * plan, so its button says so instead of starting a checkout.
 */

export default function PlanCards({
  plans,
  current,
  onChoose,
  busyId,
}: {
  plans: Plan[];
  /** Name of the plan the signed-in account is on, to mark its card. */
  current?: string | null;
  onChoose?: (plan: Plan) => void;
  busyId?: string | null;
  /** @deprecated Every place shows the same full list now. */
  compact?: boolean;
}) {
  const { isAuthenticated } = useAuth();
  const sorted = [...plans].sort((a, b) => a.price - b.price);
  const rail = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const isCurrent = useCallback((p: Plan) => !!current && current.toLowerCase() === p.name.toLowerCase(), [current]);

  const centre = useCallback((i: number, smooth = true) => {
    const el = rail.current;
    const card = el?.children[i] as HTMLElement | undefined;
    if (!el || !card) return;
    el.scrollTo({ left: card.offsetLeft - (el.clientWidth - card.clientWidth) / 2, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  // Open on the account's plan, else the most popular one — on phones that is the card worth seeing first.
  const startAt = Math.max(0, sorted.findIndex((p) => isCurrent(p)) >= 0 ? sorted.findIndex((p) => isCurrent(p)) : sorted.findIndex((p) => p.highlight));
  useEffect(() => {
    if (!sorted.length) return;
    const el = rail.current;
    if (!el || getComputedStyle(el).overflowX === 'visible') return;
    centre(startAt, false);
    setActive(startAt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorted.length, startAt]);

  const onScroll = () => {
    const el = rail.current;
    if (!el) return;
    const mid = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    let dist = Infinity;
    Array.from(el.children).forEach((c, i) => {
      const card = c as HTMLElement;
      const d = Math.abs(card.offsetLeft + card.clientWidth / 2 - mid);
      if (d < dist) {
        dist = d;
        best = i;
      }
    });
    setActive(best);
  };

  if (!sorted.length) return null;
  const shared = sharedBenefits();

  return (
    <div>
      <div
        ref={rail}
        onScroll={onScroll}
        className={cn(
          'scrollbar-hide -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 pt-4',
          'lg:mx-0 lg:grid lg:snap-none lg:overflow-visible lg:px-0',
          sorted.length >= 5 ? 'lg:grid-cols-3 xl:grid-cols-5' : sorted.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3',
        )}
      >
        {sorted.map((p) => {
          const price = planPrice(p);
          const mine = isCurrent(p);
          const free = !p.price;
          const href = `/dashboard/purchase-package?packageId=${p._id}`;
          const shown = planBenefits(p);
          const cta = mine ? 'Your current plan' : free ? (isAuthenticated ? 'Included with your account' : 'Start free') : `Choose ${p.name}`;
          const quiet = mine || (free && isAuthenticated);

          const button = (
            <span
              className={cn(
                'btn-shape inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[14.5px] font-semibold transition-colors',
                quiet
                  ? 'cursor-default bg-slate-100 text-slate-600'
                  : p.highlight
                    ? 'bg-primary text-white shadow-sm hover:bg-primary/90'
                    : 'border border-slate-300 bg-white text-slate-900 hover:border-primary hover:text-primary',
              )}
            >
              {busyId === p._id && <Loader2 className="h-4 w-4 animate-spin" />}
              {cta}
            </span>
          );

          return (
            <div
              key={p._id}
              className={cn(
                'relative flex w-[84%] max-w-[340px] shrink-0 snap-center flex-col rounded-2xl border bg-white p-5 sm:w-[46%] lg:w-auto lg:max-w-none',
                p.highlight ? 'border-primary shadow-[0_16px_40px_-20px_rgba(15,23,42,0.45)] ring-1 ring-primary' : 'border-slate-200',
                mine && !p.highlight && 'border-emerald-400 ring-1 ring-emerald-400',
              )}
            >
              {(p.highlight || mine) && (
                <span
                  className={cn(
                    'absolute -top-3 left-5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white',
                    mine ? 'bg-emerald-600' : 'bg-primary',
                  )}
                >
                  {mine ? <Check className="h-3 w-3" strokeWidth={3} /> : <Star className="h-3 w-3 fill-current" />}
                  {mine ? 'Your plan' : 'Most popular'}
                </span>
              )}

              <div className="flex items-center gap-1.5">
                <h3 className="text-[18px] font-bold text-slate-900">{p.name}</h3>
                {p.verifiedBadge && <BadgeCheck className="h-5 w-5 text-sky-500" aria-label="Includes the verified badge" />}
              </div>
              {p.description && <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-slate-500 lg:min-h-[2.1rem]">{p.description}</p>}

              <div className="mt-4">
                <p className="flex items-baseline gap-1 text-slate-900">
                  <span className="text-[30px] font-extrabold leading-none tracking-tight">{price.amount}</span>
                  {price.per && <span className="text-[13px] font-medium text-slate-500">/ {price.per}</span>}
                </p>
                <p className="mt-1 text-[12px] text-slate-500">{free ? 'No card, no expiry' : `Valid ${planDuration(p)}`}</p>
              </div>

              <div className="mt-4">
                {quiet ? (
                  button
                ) : onChoose ? (
                  <button type="button" onClick={() => onChoose(p)} disabled={!!busyId} className="w-full text-left">
                    {button}
                  </button>
                ) : (
                  <Link href={isAuthenticated ? href : free ? loginUrl('/dashboard/property/add-property') : loginUrl(href)}>{button}</Link>
                )}
              </div>

              <ul className="mt-5 flex-1 space-y-2.5 border-t border-slate-100 pt-4">
                {shown.map((b) => (
                  <li key={b.key} className={cn('flex items-start gap-2.5 text-[13.5px] leading-snug', b.on ? 'text-slate-800' : 'text-slate-400')}>
                    <span
                      className={cn(
                        'mt-px grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full',
                        b.on ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-400',
                      )}
                    >
                      {b.on ? <Check className="h-3 w-3" strokeWidth={3} /> : <X className="h-3 w-3" strokeWidth={2.5} />}
                    </span>
                    <span className={cn(b.on && (b.key === 'listings' || b.key === 'featured' || b.key === 'team') && 'font-semibold')}>{b.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Where the row is: phones and tablets only. */}
      <div className="mt-3 flex justify-center gap-1.5 lg:hidden" aria-hidden>
        {sorted.map((p, i) => (
          <button
            key={p._id}
            type="button"
            tabIndex={-1}
            onClick={() => centre(i)}
            className={cn('h-2 rounded-full transition-all', i === active ? 'w-5 bg-primary' : 'w-2 bg-slate-300')}
          />
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
        <p className="text-[13px] font-semibold text-slate-900">Every plan includes</p>
        <ul className="mt-2 grid gap-x-5 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {shared.map((line) => (
            <li key={line} className="flex items-start gap-2 text-[13px] text-slate-600">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" strokeWidth={3} />
              {line}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

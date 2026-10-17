'use client';

import Link from 'next/link';
import { BadgeCheck, Check, Loader2, Sparkles, Star, Users, Zap } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { loginUrl } from '@/lib/auth-intent';
import { cn } from '@/lib/utils';
import { planPrice, type Plan } from '@/lib/plans';

/*
 * The plan cards — the same everywhere: homepage, /packages and the
 * dashboard's "Buy a Plan". Public pages link to the checkout (through sign-in
 * when needed); the dashboard passes `onChoose` and opens it in place.
 *
 * Free is never "bought": it is what every account has until it picks a paid
 * plan, so its button says so instead of starting a checkout.
 */

export default function PlanCards({
  plans,
  current,
  onChoose,
  busyId,
  compact = false,
}: {
  plans: Plan[];
  /** Name of the plan the signed-in account is on, to mark its card. */
  current?: string | null;
  onChoose?: (plan: Plan) => void;
  busyId?: string | null;
  /** Homepage: the key lines only. */
  compact?: boolean;
}) {
  const { isAuthenticated } = useAuth();
  const sorted = [...plans].sort((a, b) => a.price - b.price);

  return (
    <div className={cn('grid gap-3 sm:grid-cols-2', sorted.length >= 5 ? 'lg:grid-cols-3 xl:grid-cols-5' : 'lg:grid-cols-3 xl:grid-cols-4')}>
      {sorted.map((p) => {
        const price = planPrice(p);
        const isCurrent = !!current && current.toLowerCase() === p.name.toLowerCase();
        const free = !p.price;
        const href = `/dashboard/purchase-package?packageId=${p._id}`;
        const lines = compact ? p.features.slice(0, 4) : p.features;
        const cta = isCurrent ? 'Your current plan' : free ? (isAuthenticated ? 'Included with every account' : 'Start free') : `Choose ${p.name}`;

        const button = (
          <span
            className={cn(
              'btn-shape mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-semibold transition-colors',
              isCurrent || (free && isAuthenticated)
                ? 'cursor-default bg-slate-100 text-slate-600'
                : p.highlight || p.verifiedBadge
                  ? 'bg-primary text-white hover:bg-primary/90'
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
              'relative flex flex-col rounded-2xl border bg-white p-5',
              p.highlight ? 'border-primary shadow-[0_12px_30px_-16px_rgba(15,23,42,0.35)] ring-1 ring-primary' : 'border-slate-200',
            )}
          >
            {p.highlight && (
              <span className="absolute -top-3 left-5 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                <Star className="h-3 w-3 fill-current" /> Most popular
              </span>
            )}
            <div className="flex items-center gap-2">
              <h3 className="text-[18px] font-bold text-slate-900">{p.name}</h3>
              {p.verifiedBadge && <BadgeCheck className="h-5 w-5 text-sky-500" aria-label="Includes the verified badge" />}
            </div>
            {p.description && <p className="mt-1 text-[13.5px] leading-snug text-slate-500">{p.description}</p>}

            <p className="mt-4 flex items-baseline gap-1 text-slate-900">
              <span className="text-[28px] font-extrabold leading-none tracking-tight">{price.amount}</span>
              {price.per && <span className="text-[13px] text-slate-500">/ {price.per}</span>}
            </p>

            <div className="mt-4 grid grid-cols-3 gap-1.5 text-center">
              <div className="rounded-xl bg-slate-50 px-1 py-2">
                <p className="text-[16px] font-bold text-slate-900">{p.propertyLimit}</p>
                <p className="text-[11px] text-slate-500">listings</p>
              </div>
              <div className="rounded-xl bg-slate-50 px-1 py-2">
                <p className="text-[16px] font-bold text-slate-900">{p.featuredListings || 0}</p>
                <p className="text-[11px] text-slate-500">featured</p>
              </div>
              <div className="rounded-xl bg-slate-50 px-1 py-2">
                <p className="text-[16px] font-bold text-slate-900">{p.teamMembers || 0}</p>
                <p className="text-[11px] text-slate-500">agents</p>
              </div>
            </div>

            {(p.verifiedBadge || p.autoPublish || p.spotlight || (p.teamMembers ?? 0) > 0) && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.verifiedBadge && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11.5px] font-semibold text-sky-700">
                    <BadgeCheck className="h-3.5 w-3.5" /> Verified
                  </span>
                )}
                {p.autoPublish && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11.5px] font-semibold text-emerald-700">
                    <Zap className="h-3.5 w-3.5" /> Instant publish
                  </span>
                )}
                {p.spotlight && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11.5px] font-semibold text-amber-700">
                    <Sparkles className="h-3.5 w-3.5" /> Spotlight
                  </span>
                )}
                {(p.teamMembers ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11.5px] font-semibold text-violet-700">
                    <Users className="h-3.5 w-3.5" /> Team
                  </span>
                )}
              </div>
            )}

            <ul className="mt-4 flex-1 space-y-2 border-t border-slate-100 pt-4">
              {lines.map((line, i) => (
                <li key={i} className="flex items-start gap-2 text-[13.5px] leading-snug text-slate-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={2.5} />
                  {line}
                </li>
              ))}
              {compact && p.features.length > lines.length && (
                <li className="pl-6 text-[12.5px] text-slate-500">+ {p.features.length - lines.length} more</li>
              )}
            </ul>

            {isCurrent || (free && isAuthenticated) ? (
              button
            ) : onChoose ? (
              <button type="button" onClick={() => onChoose(p)} disabled={!!busyId} className="text-left">
                {button}
              </button>
            ) : (
              <Link href={isAuthenticated ? href : free ? loginUrl('/dashboard/property/add-property') : loginUrl(href)}>{button}</Link>
            )}
          </div>
        );
      })}
    </div>
  );
}

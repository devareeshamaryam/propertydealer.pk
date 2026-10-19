'use client'

import { useEffect, useState } from 'react';
import { BadgeCheck, Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { packageApi, subscriptionApi } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import PlanCards from '@/components/plans/PlanCards';
import { planBenefits, planDuration, planPrice, type Plan } from '@/lib/plans';

/*
 * Packages for agents — the same plan cards as the homepage and the
 * dashboard, then every benefit side by side, then the questions dealers ask.
 */

const FAQS = [
  {
    q: 'Do I need a package to post a property?',
    a: 'No. Every account can keep one listing live for free. A free listing stays up for a month and you can renew it for free from My Listings. A package is for listing more (with no monthly renewing), featuring listings and the agency benefits.',
  },
  {
    q: 'What does the Verified badge do?',
    a: 'Plans with the Verified badge (see the table above) show a blue Verified badge on your profile, on every listing page and on every listing card across the site — buyers see at once that they are dealing with an established agency.',
  },
  {
    q: 'What is a featured listing?',
    a: 'A featured listing is pinned above the others on the city, area and search pages, and carries a Featured tag on its photo. You choose which of your listings to feature from your dashboard.',
  },
  {
    q: 'How do agent accounts work?',
    a: "On a plan with agent accounts you create accounts for your agents from My Team. Each agent signs in with their own email, posts and edits their own listings and marks them sold, and shows as an agent of your agency. You see every listing of the team and alone feature or delete them; you can give an agent a listing limit, reset their password, pause them, move their listings to someone else or remove them. The plan's listings are shared by the team.",
  },
  {
    q: 'How do I pay?',
    a: 'Choose a package, transfer the amount to one of the accounts shown at checkout and upload the payment screenshot. The package starts as soon as the payment is verified.',
  },
];

export default function PackagesPublicPage() {
  const { isAuthenticated } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    packageApi
      .getAll()
      .then((data) => setPlans(Array.isArray(data) ? data : []))
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    subscriptionApi
      .getMyPlan()
      .then((p) => setCurrent(p?.name ?? null))
      .catch(() => undefined);
  }, [isAuthenticated]);

  const sorted = [...plans].sort((a, b) => a.price - b.price);

  return (
    <div className="container mx-auto max-w-7xl overflow-x-hidden px-4 py-8 sm:py-10">
      <div className="max-w-2xl">
        <h1 className="text-[26px] font-bold leading-tight tracking-tight text-slate-900 sm:text-[34px]">Packages for agents &amp; agencies</h1>
        <p className="mt-2 text-[15px] text-slate-600">
          Every account starts free. Choose a monthly package to list more, feature your best properties and — on the agency plans — get the
          <span className="mx-1 inline-flex items-center gap-1 font-semibold text-sky-700">
            <BadgeCheck className="h-4 w-4" /> Verified
          </span>
          badge across the site.
        </p>
      </div>

      <div className="mt-7">
        {loading ? (
          <div className="flex gap-3 overflow-hidden pt-4 lg:grid lg:grid-cols-3 xl:grid-cols-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-[28rem] w-[84%] max-w-[340px] shrink-0 animate-pulse rounded-2xl bg-slate-100 sm:w-[46%] lg:w-auto lg:max-w-none" />
            ))}
          </div>
        ) : (
          <PlanCards plans={plans} current={current} />
        )}
      </div>

      {sorted.length > 0 && (
        <section className="mt-12">
          <h2 className="text-[20px] font-bold text-slate-900 sm:text-[24px]">Compare packages</h2>
          <p className="mt-1 text-[14px] text-slate-500 sm:hidden">Swipe the table sideways to see every plan.</p>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full min-w-[620px] border-separate border-spacing-0 text-left text-[13.5px] sm:text-[14px]">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 w-[38%] border-b border-slate-200 bg-slate-50 px-3 py-3 font-semibold text-slate-600 sm:px-4">Benefit</th>
                  {sorted.map((p) => {
                    const price = planPrice(p);
                    return (
                      <th key={p._id} className={cn('border-b border-slate-200 px-2 py-3 text-center align-bottom', p.highlight ? 'bg-primary/5' : 'bg-slate-50')}>
                        <span className="block font-bold text-slate-900">{p.name}</span>
                        <span className="block text-[12px] font-medium text-slate-500">{price.amount}{price.per ? ` / ${price.per}` : ''}</span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {planBenefits(sorted[0]!).map((row) => (
                  <tr key={row.key}>
                    <td className="sticky left-0 z-10 border-b border-slate-100 bg-white px-3 py-2.5 sm:px-4">
                      <p className="font-medium text-slate-800">{row.key === 'listings' ? 'Live listings' : row.key === 'featured' ? 'Featured listings' : row.key === 'team' ? 'Agent accounts' : row.label}</p>
                      <p className="hidden text-[12px] text-slate-400 sm:block">{row.hint}</p>
                    </td>
                    {sorted.map((p) => {
                      const b = planBenefits(p).find((x) => x.key === row.key)!;
                      const count = row.key === 'listings' ? p.propertyLimit : row.key === 'featured' ? p.featuredListings : row.key === 'team' ? p.teamMembers ?? 0 : null;
                      return (
                        <td key={p._id} className={cn('border-b border-slate-100 px-2 py-2.5 text-center', p.highlight && 'bg-primary/5')}>
                          {count !== null && count > 0 ? (
                            <span className="font-bold text-slate-900">{count}</span>
                          ) : b.on ? (
                            <Check className="mx-auto h-5 w-5 text-emerald-600" strokeWidth={2.5} />
                          ) : (
                            <Minus className="mx-auto h-4 w-4 text-slate-300" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr>
                  <td className="sticky left-0 z-10 bg-white px-3 py-2.5 font-medium text-slate-800 sm:px-4">Valid for</td>
                  {sorted.map((p) => (
                    <td key={p._id} className={cn('px-2 py-2.5 text-center text-slate-700', p.highlight && 'bg-primary/5')}>{planDuration(p)}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="mt-12 max-w-3xl">
        <h2 className="text-[20px] font-bold text-slate-900 sm:text-[24px]">Questions</h2>
        <div className="mt-3 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {FAQS.map((f) => (
            <details key={f.q} className="group p-4">
              <summary className="cursor-pointer list-none text-[15px] font-semibold text-slate-900">{f.q}</summary>
              <p className="mt-2 text-[14.5px] leading-relaxed text-slate-600">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

'use client'

import { useEffect, useState } from 'react';
import { BadgeCheck, Check, Minus } from 'lucide-react';
import { packageApi, subscriptionApi } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import PlanCards from '@/components/plans/PlanCards';
import { PERK_LABELS, type Plan } from '@/lib/plans';

/*
 * Packages for agents — the same plan cards as the homepage and the
 * dashboard, then every benefit side by side, then the questions dealers ask.
 */

const FAQS = [
  {
    q: 'Do I need a package to post a property?',
    a: 'No. Every account can keep one listing live for free, with no expiry. A package is for listing more, featuring listings and the agency benefits.',
  },
  {
    q: 'What does the Verified badge do?',
    a: 'Agency and Agency Plus accounts get a blue Verified badge on their profile, on every listing page and on every listing card across the site — buyers see at once that they are dealing with an established agency.',
  },
  {
    q: 'What is a featured listing?',
    a: 'A featured listing is pinned above the others on the city, area and search pages, and carries a Featured tag on its photo. You choose which of your listings to feature from your dashboard.',
  },
  {
    q: 'How do agent accounts work?',
    a: "On Agency Plus you create accounts for your agents from your dashboard. Each agent signs in with their own email, posts and manages their own listings, and shows as an agent of your agency. You see and manage every listing of the team, and the plan's listings are shared by the team.",
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
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:py-10">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Packages for agents &amp; agencies</h1>
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-[30rem] animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : (
          <PlanCards plans={plans} current={current} />
        )}
      </div>

      {sorted.length > 0 && (
        <section className="mt-12">
          <h2 className="text-[20px] font-bold text-slate-900 sm:text-[24px]">Compare packages</h2>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full min-w-[640px] text-left text-[14px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 font-semibold text-slate-600">Benefit</th>
                  {sorted.map((p) => (
                    <th key={p._id} className="px-3 py-3 text-center font-bold text-slate-900">
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="px-4 py-2.5 text-slate-700">Live listings</td>
                  {sorted.map((p) => (
                    <td key={p._id} className="px-3 py-2.5 text-center font-semibold text-slate-900">{p.propertyLimit}</td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-2.5 text-slate-700">Featured listings</td>
                  {sorted.map((p) => (
                    <td key={p._id} className="px-3 py-2.5 text-center font-semibold text-slate-900">{p.featuredListings || '—'}</td>
                  ))}
                </tr>
                {PERK_LABELS.map(({ key, label, hint }) => (
                  <tr key={key}>
                    <td className="px-4 py-2.5">
                      <p className="text-slate-700">{label}</p>
                      <p className="text-[12px] text-slate-400">{hint}</p>
                    </td>
                    {sorted.map((p) => {
                      const v = p[key];
                      const on = key === 'teamMembers' ? (p.teamMembers ?? 0) > 0 : Boolean(v);
                      return (
                        <td key={p._id} className="px-3 py-2.5 text-center">
                          {key === 'teamMembers' && on ? (
                            <span className="font-semibold text-slate-900">{p.teamMembers}</span>
                          ) : on ? (
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
                  <td className="px-4 py-2.5 text-slate-700">Profile page with share link, views &amp; enquiry stats</td>
                  {sorted.map((p) => (
                    <td key={p._id} className="px-3 py-2.5 text-center">
                      <Check className="mx-auto h-5 w-5 text-emerald-600" strokeWidth={2.5} />
                    </td>
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

import Link from 'next/link';
import { ArrowRight, BadgeCheck } from 'lucide-react';
import PlanCards from '@/components/plans/PlanCards';
import type { Plan } from '@/lib/plans';

/* Homepage: the agent plans, the same cards as /packages, key lines only. */
export default function HomePlans({ plans }: { plans: Plan[] }) {
  if (!plans.length) return null;
  return (
    <section className="container mx-auto px-[var(--gutter)] py-10 sm:px-4 sm:py-14">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <p className="text-[12.5px] font-semibold uppercase tracking-wider text-primary">For agents &amp; agencies</p>
          <h2 className="mt-1 text-[24px] font-bold tracking-tight text-slate-900 sm:text-[30px]">Grow your property business</h2>
          <p className="mt-1.5 text-[15px] text-slate-600">
            Start free. Upgrade for more listings, featured placement, the
            <span className="mx-1 inline-flex items-center gap-0.5 font-semibold text-sky-700">
              <BadgeCheck className="h-4 w-4" /> Verified
            </span>
            badge and agent accounts for your team.
          </p>
        </div>
        <Link href="/packages" className="inline-flex items-center gap-1 text-[14px] font-semibold text-primary hover:underline">
          Compare all packages <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <PlanCards plans={plans} compact />
    </section>
  );
}

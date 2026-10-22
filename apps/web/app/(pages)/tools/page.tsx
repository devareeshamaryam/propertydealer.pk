import type { Metadata } from 'next';
import { ToolLink } from '@/components/tools/ToolShell';
import { TOOLS } from '@/lib/tools';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealer.pk';

export const metadata: Metadata = {
  title: 'Property Tools — Area Converter, Construction Cost, Home Loan & More',
  description:
    'Free property tools for Pakistan: marla/kanal area converter, construction cost calculator on live material rates, home loan, instalment plan and rental yield calculators.',
  alternates: { canonical: `${BASE_URL}/tools` },
};

export default function ToolsPage() {
  return (
    <main className="bg-slate-50 pb-12">
      <section className="border-b border-slate-200 bg-white">
        <div className="container mx-auto px-[var(--gutter)] py-6 sm:px-4 sm:py-9">
          <h1 className="text-[26px] font-extrabold tracking-tight text-slate-900 sm:text-[36px]">Property tools</h1>
          <p className="mt-1.5 max-w-2xl text-[15px] text-slate-600">
            Quick answers for buying, building and renting in Pakistan — sizes, building costs on today&apos;s material rates, instalments and returns.
          </p>
        </div>
      </section>
      <div className="container mx-auto grid gap-3 px-[var(--gutter)] pt-6 sm:grid-cols-2 sm:px-4 sm:pt-8 lg:grid-cols-3">
        {TOOLS.map((t) => (
          <ToolLink key={t.slug} tool={t} big />
        ))}
      </div>
    </main>
  );
}

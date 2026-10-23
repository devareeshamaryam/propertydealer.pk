import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { ToolIcon } from '@/components/tools/ToolShell';
import { TOOLS } from '@/lib/tools';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealer.pk';

export const metadata: Metadata = {
  title: 'Property Tools — Construction Cost, Area Converter, Home Loan & More',
  description:
    'Free property tools for Pakistan: construction cost on live material rates, marla/kanal area converter, price per marla, home loan, instalment plan and rental yield calculators.',
  alternates: { canonical: `${BASE_URL}/tools` },
};

export default function ToolsPage() {
  const [first, ...rest] = TOOLS;
  return (
    <main className="min-h-screen bg-slate-100 pb-14">
      <div className="border-b border-slate-300 bg-white">
        <div className="container mx-auto px-[var(--gutter)] py-5 sm:px-4 sm:py-8">
          <h1 className="text-[26px] font-extrabold tracking-tight text-slate-900 sm:text-[34px]">Property tools</h1>
          <p className="mt-1 max-w-2xl text-[14.5px] text-slate-600 sm:text-[15.5px]">Quick, free answers for buying, building and renting in Pakistan.</p>
        </div>
      </div>

      <div className="container mx-auto space-y-4 px-[var(--gutter)] pt-5 sm:px-4 sm:pt-8">
        {/* The most used tool, as a wide card */}
        {first && (
          <Link href={`/tools/${first.slug}`} className="group flex items-center gap-4 rounded-xl bg-white p-4 border border-slate-300 transition-colors hover:border-primary sm:p-5">
            <ToolIcon tool={first} size="lg" />
            <span className="min-w-0 flex-1">
              <span className="block text-[18px] font-extrabold text-slate-900 group-hover:text-primary">{first.title}</span>
              <span className="block text-[14px] text-slate-600">{first.short}</span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-500 group-hover:text-primary" />
          </Link>
        )}

        {/* The rest, as app icons */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {rest.map((t) => (
            <Link key={t.slug} href={`/tools/${t.slug}`} className="group flex flex-col items-start gap-3 rounded-xl bg-white p-4 border border-slate-300 transition-colors hover:border-primary">
              <ToolIcon tool={t} />
              <span>
                <span className="block text-[15px] font-bold leading-tight text-slate-900 group-hover:text-primary">{t.title}</span>
                <span className="mt-0.5 block text-[12.5px] leading-snug text-slate-600">{t.short}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}

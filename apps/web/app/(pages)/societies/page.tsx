import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import SocietyCard from '@/components/societies/SocietyCard';
import { getSocieties, type SocietyCard as Card } from '@/lib/societies';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealer.pk';

export const revalidate = 600;

export const metadata: Metadata = {
  title: `Housing Societies in Pakistan — Prices, Maps & Guides ${new Date().getFullYear()}`,
  description:
    'Guides to housing societies across Pakistan: approval status, phases, house and plot prices by size, maps and the properties for sale and rent in each.',
  alternates: { canonical: `${BASE_URL}/societies` },
};

export default async function SocietiesPage() {
  const all = await getSocieties();
  const byCity = new Map<string, { name: string; rows: Card[] }>();
  for (const s of all) {
    const c = byCity.get(s.citySlug) ?? { name: s.cityName, rows: [] };
    c.rows.push(s);
    byCity.set(s.citySlug, c);
  }
  const cities = [...byCity.entries()].sort((a, b) => b[1].rows.length - a[1].rows.length);

  return (
    <main className="bg-slate-50">
      <section className="border-b border-slate-200 bg-white">
        <div className="container mx-auto px-[var(--gutter)] py-6 sm:px-4 sm:py-9">
          <h1 className="text-[26px] font-extrabold tracking-tight text-slate-900 sm:text-[36px]">Housing societies in Pakistan</h1>
          <p className="mt-1.5 max-w-2xl text-[15px] text-slate-600">Approval, phases, prices by size, maps and listings — a guide to each society.</p>
          {cities.length > 1 && (
            <div className="hide-scrollbar -mx-[var(--gutter)] mt-4 flex gap-2 overflow-x-auto px-[var(--gutter)] sm:mx-0 sm:flex-wrap sm:px-0">
              {cities.map(([slug, c]) => (
                <a key={slug} href={`#${slug}`} className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-700 hover:border-primary hover:text-primary">
                  {c.name} <span className="text-slate-400">{c.rows.length}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </section>
      <div className="container mx-auto space-y-10 px-[var(--gutter)] py-7 sm:px-4 sm:py-10">
        {cities.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">Society guides are on their way.</p>}
        {cities.map(([slug, c]) => (
          <section key={slug} id={slug} className="scroll-mt-24">
            <div className="mb-3 flex items-end justify-between gap-3">
              <h2 className="text-[21px] font-bold tracking-tight text-slate-900 sm:text-[24px]">Societies in {c.name}</h2>
              <Link href={`/societies/${slug}`} className="inline-flex shrink-0 items-center gap-0.5 text-[14px] font-semibold text-primary hover:underline">
                All {c.rows.length} <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
              {c.rows.slice(0, 8).map((s) => (
                <SocietyCard key={s._id} s={s} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

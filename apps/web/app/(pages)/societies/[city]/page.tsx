import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, Map as MapIcon } from 'lucide-react';
import SocietyCard from '@/components/societies/SocietyCard';
import { serverApi } from '@/lib/server-api';
import { getSocieties } from '@/lib/societies';
import { toTitleCase } from '@/lib/utils';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealer.pk';

export const revalidate = 600;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

type Params = { params: Promise<{ city: string }> };

async function load(citySlug: string) {
  const [societies, city] = await Promise.all([getSocieties(citySlug), serverApi.getCityByName(citySlug).catch(() => null)]);
  return { societies, cityName: societies[0]?.cityName || (city?.name ? toTitleCase(city.name) : '') };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { city } = await params;
  const { societies, cityName } = await load(city);
  if (!cityName) return {};
  const title = `Housing Societies in ${cityName} — Prices, Maps & Guides ${new Date().getFullYear()}`;
  const description = `${societies.length} housing societies in ${cityName}: approval status, phases, house and plot prices, maps and the properties for sale and rent in each.`;
  return {
    title,
    description,
    alternates: { canonical: `${BASE_URL}/societies/${city}` },
    // A city with no guides yet stays out of search until it has some.
    ...(societies.length ? {} : { robots: { index: false, follow: true } }),
  };
}

export default async function CitySocietiesPage({ params }: Params) {
  const { city } = await params;
  const { societies, cityName } = await load(city);
  if (!cityName) notFound();

  return (
    <main className="bg-slate-50">
      <section className="border-b border-slate-200 bg-white">
        <div className="container mx-auto px-[var(--gutter)] py-6 sm:px-4 sm:py-9">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-[12.5px] text-slate-500">
            <Link href="/" className="hover:text-primary">Home</Link>
            <ChevronRight className="h-3 w-3" />
            <Link href="/societies" className="hover:text-primary">Societies</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-slate-700">{cityName}</span>
          </nav>
          <h1 className="mt-3 text-[26px] font-extrabold tracking-tight text-slate-900 sm:text-[36px]">Housing societies in {cityName}</h1>
          <p className="mt-1.5 max-w-2xl text-[15px] text-slate-600">
            Approval, phases, prices by size, maps and the properties for sale and rent in every society — in one place.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/properties/sale/${city}`} className="btn-shape inline-flex h-10 items-center rounded-xl bg-primary px-4 text-[14px] font-semibold text-white">
              Property for sale in {cityName}
            </Link>
            <Link href={`/emap/${city}`} className="btn-shape inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 text-[14px] font-semibold text-slate-800">
              <MapIcon className="h-4 w-4" /> {cityName} map
            </Link>
          </div>
        </div>
      </section>
      <div className="container mx-auto px-[var(--gutter)] py-7 sm:px-4 sm:py-10">
        {societies.length ? (
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
            {societies.map((s) => (
              <SocietyCard key={s._id} s={s} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-[15px] text-slate-500">
            Society guides for {cityName} are on their way. Meanwhile, browse{' '}
            <Link href={`/properties/sale/${city}`} className="font-semibold text-primary">
              property in {cityName}
            </Link>
            .
          </p>
        )}
      </div>
    </main>
  );
}

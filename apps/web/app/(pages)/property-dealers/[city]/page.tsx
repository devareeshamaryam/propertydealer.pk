import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DealersDirectory } from '@/components/dealers/DealersDirectory';
import ExpandableHtml from '@/components/societies/ExpandableHtml';
import { getDealerCities, getDealerCity } from '@/lib/server-api';
import { cityText, dealerHref, dealersCityPath, hasDealers } from '@/lib/dealers';
import { getSiteName } from '@/lib/site-settings.server';

/*
 * /property-dealers-in-<city> (rewritten here in next.config; the address
 * /property-dealers/<city> redirects to it). A city's agencies, then its
 * agents ranked by plan: Agency Plus agents first, Free last.
 *
 * A city with no agency or agent has no page at all (404) — not on the site,
 * not in the sitemap. When its first dealer joins, the API refreshes the
 * 'dealers' cache and the page, the sitemap and the links appear at once.
 */

export const revalidate = 600;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealer.pk';

interface Props {
  params: Promise<{ city: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params;
  const data = await getDealerCity(city);
  if (!data || !hasDealers(data.total)) return { title: 'Not found', robots: { index: false } };
  const t = cityText(data);
  const path = dealersCityPath(data.city.slug);
  return {
    title: { absolute: t.title },
    description: t.description,
    alternates: { canonical: path },
    robots: t.noindex ? { index: false, follow: true } : undefined,
    openGraph: { title: t.title, description: t.description, url: path, type: 'website', ...(data.city.thumbnail ? { images: [data.city.thumbnail] } : {}) },
  };
}

export default async function DealersCityPage({ params }: Props) {
  const { city } = await params;
  const [data, cities, site] = await Promise.all([getDealerCity(city), getDealerCities(), getSiteName()]);
  if (!data || !hasDealers(data.total)) notFound();
  const t = cityText(data);
  const name = data.city.name;
  const path = dealersCityPath(data.city.slug);
  const others = cities
    .filter((c) => c._id !== data.city._id && hasDealers(c))
    .sort((a, b) => b.agencies + b.agents - (a.agencies + a.agents))
    .slice(0, 24);

  const listed = [...data.agencies, ...data.agents];
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: `Property in ${name}`, item: `${SITE}/properties/all/${data.city.slug}` },
        { '@type': 'ListItem', position: 3, name: `Property dealers in ${name}`, item: `${SITE}${path}` },
      ],
    },
    ...(listed.length
      ? [
          {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: t.heading,
            numberOfItems: data.total.agencies + data.total.agents,
            itemListElement: listed.slice(0, 50).map((d, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              item: {
                '@type': 'RealEstateAgent',
                name: d.name,
                url: `${SITE}${dealerHref(d)}`,
                ...(d.avatarUrl ? { image: d.avatarUrl.startsWith('http') ? d.avatarUrl : `${SITE}${d.avatarUrl}` } : {}),
                ...(d.phone ? { telephone: d.phone } : {}),
                address: { '@type': 'PostalAddress', addressLocality: name, addressCountry: 'PK', ...(d.address ? { streetAddress: d.address } : {}) },
              },
            })),
          },
        ]
      : []),
    ...(t.faqs.length
      ? [
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: t.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
          },
        ]
      : []),
  ];

  return (
    <div className="bg-[#f4f5f7]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />

      <header className="border-b border-slate-300 bg-white">
        <div className="container mx-auto max-w-6xl px-4 pb-6 pt-5 sm:pb-8">
          <nav aria-label="Breadcrumb" className="text-[13px] text-slate-600">
            <ol className="flex flex-wrap items-center gap-1.5">
              <li>
                <Link href="/" className="hover:text-slate-900 hover:underline">
                  Home
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li>
                <Link href={`/properties/all/${data.city.slug}`} className="hover:text-slate-900 hover:underline">
                  {name}
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li className="font-semibold text-slate-900">Property dealers</li>
            </ol>
          </nav>
          <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h1 className="text-[27px] font-extrabold leading-tight tracking-tight text-slate-900 sm:text-[36px]">{t.heading}</h1>
              <p className="mt-2 text-[15.5px] leading-relaxed text-slate-700">{t.intro}</p>
            </div>
            <dl className="grid shrink-0 grid-cols-2 divide-x divide-slate-300 overflow-hidden rounded-lg border border-slate-300 text-center">
              <div className="px-6 py-2.5">
                <dt className="text-[11.5px] font-bold uppercase tracking-wider text-slate-600">Agencies</dt>
                <dd className="text-[24px] font-extrabold tabular-nums leading-tight text-slate-900">{data.total.agencies.toLocaleString('en-PK')}</dd>
              </div>
              <div className="px-6 py-2.5">
                <dt className="text-[11.5px] font-bold uppercase tracking-wider text-slate-600">Agents</dt>
                <dd className="text-[24px] font-extrabold tabular-nums leading-tight text-slate-900">{data.total.agents.toLocaleString('en-PK')}</dd>
              </div>
            </dl>
          </div>
        </div>
      </header>

      <div className="container mx-auto grid max-w-6xl gap-8 px-4 py-7 lg:grid-cols-[minmax(0,1fr)_290px]">
        <main className="min-w-0 space-y-10">
          <DealersDirectory initial={data} />

          {t.content && (
            <section className="rounded-lg border border-slate-300 bg-white p-5 sm:p-7">
              <ExpandableHtml html={t.content} collapsed={320} />
            </section>
          )}

          {t.faqs.length > 0 && (
            <section aria-labelledby="faqs">
              <h2 id="faqs" className="border-b-2 border-slate-900 pb-2 text-[20px] font-bold tracking-tight text-slate-900 sm:text-[22px]">
                Questions about property dealers in {name}
              </h2>
              <div className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-300 bg-white">
                {t.faqs.map((f) => (
                  <details key={f.q} className="group">
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-5 py-4 text-[15.5px] font-semibold text-slate-900 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                      {f.q}
                      <span className="mt-0.5 text-[20px] font-normal leading-none text-slate-500 group-open:hidden" aria-hidden>
                        +
                      </span>
                      <span className="mt-0.5 hidden text-[20px] font-normal leading-none text-slate-500 group-open:inline" aria-hidden>
                        −
                      </span>
                    </summary>
                    <p className="whitespace-pre-line px-5 pb-4 text-[14.5px] leading-relaxed text-slate-700">{f.a}</p>
                  </details>
                ))}
              </div>
            </section>
          )}
        </main>

        <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          <section className="rounded-lg border border-slate-900 bg-white p-5">
            <h2 className="text-[17px] font-bold leading-snug text-slate-900">Are you a property dealer in {name}?</h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-slate-700">
              Join {site} free and you are listed here. Paid plans sit higher on this page, with the Verified badge and accounts for your agents.
            </p>
            <div className="mt-4 grid gap-2">
              <Link href="/register" className="inline-flex h-11 items-center justify-center rounded-md bg-slate-900 text-[14.5px] font-semibold text-white hover:bg-black">
                List your agency free
              </Link>
              <Link href="/packages" className="inline-flex h-11 items-center justify-center rounded-md border border-slate-400 text-[14.5px] font-semibold text-slate-900 hover:border-slate-900">
                Compare plans
              </Link>
            </div>
          </section>

          <section className="rounded-lg border border-slate-300 bg-white">
            <h2 className="border-b border-slate-200 px-4 py-3 text-[15px] font-bold text-slate-900">Property in {name}</h2>
            <ul className="divide-y divide-slate-200 text-[14px]">
              {[
                [`/properties/sale/${data.city.slug}`, `Property for sale in ${name}`],
                [`/properties/rent/${data.city.slug}`, `Property for rent in ${name}`],
                [`/properties/all/${data.city.slug}`, `All property in ${name}`],
                [`/societies/${data.city.slug}`, `Housing societies in ${name}`],
              ].map(([href, label]) => (
                <li key={href}>
                  <Link href={href!} className="flex items-center justify-between gap-2 px-4 py-2.5 font-medium text-slate-800 hover:bg-slate-50 hover:text-slate-950">
                    {label}
                    <span aria-hidden className="text-slate-400">
                      ›
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {others.length > 0 && (
            <section className="rounded-lg border border-slate-300 bg-white">
              <h2 className="border-b border-slate-200 px-4 py-3 text-[15px] font-bold text-slate-900">Property dealers in other cities</h2>
              <ul className="divide-y divide-slate-200 text-[14px]">
                {others.map((c) => (
                  <li key={c._id}>
                    <Link href={dealersCityPath(c.slug)} className="flex items-center justify-between gap-2 px-4 py-2.5 font-medium text-slate-800 hover:bg-slate-50">
                      <span>
                        <span className="sr-only">Property dealers in </span>
                        {c.name}
                      </span>
                      <span className="text-[13px] tabular-nums text-slate-500">{c.agencies + c.agents}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

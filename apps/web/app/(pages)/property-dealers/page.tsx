import type { Metadata } from 'next';
import Link from 'next/link';
import { CityFinder } from '@/components/dealers/CityFinder';
import ExpandableHtml from '@/components/societies/ExpandableHtml';
import { getDealerCities, getDealerSettings } from '@/lib/server-api';
import { DEALERS_HUB, hasDealers } from '@/lib/dealers';
import { getSiteName } from '@/lib/site-settings.server';

/* /property-dealers: every city that has dealers, the busiest first. */

export const revalidate = 600;

export async function generateMetadata(): Promise<Metadata> {
  const [s, site] = await Promise.all([getDealerSettings(), getSiteName()]);
  const title = s.hub.metaTitle || `Property Dealers in Pakistan — Real Estate Agents by City | ${site}`;
  const description =
    s.hub.metaDescription ||
    'Find property dealers, real estate agents and verified agencies in Lahore, Karachi, Islamabad, Multan and every other city — with their listings, phone and WhatsApp.';
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: DEALERS_HUB },
    robots: s.hub.noindex ? { index: false, follow: true } : undefined,
    openGraph: { title, description, url: DEALERS_HUB, type: 'website' },
  };
}

export default async function DealersHubPage() {
  const [cities, s, site] = await Promise.all([getDealerCities(), getDealerSettings(), getSiteName()]);
  // Only cities with at least one dealer — the others have no page yet.
  const withDealers = cities.filter(hasDealers).sort((a, b) => b.agencies + b.agents - (a.agencies + a.agents) || a.name.localeCompare(b.name));
  const agencies = withDealers.reduce((n, c) => n + c.agencies, 0);
  const agents = withDealers.reduce((n, c) => n + c.agents, 0);
  const faqs = s.hub.faqs ?? [];

  return (
    <div className="bg-[#f4f5f7]">
      {faqs.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
            }).replace(/</g, '\\u003c'),
          }}
        />
      )}

      <header className="border-b border-slate-300 bg-white">
        <div className="container mx-auto max-w-6xl px-4 pb-6 pt-5 sm:pb-8">
          <nav aria-label="Breadcrumb" className="text-[13px] text-slate-600">
            <ol className="flex items-center gap-1.5">
              <li>
                <Link href="/" className="hover:text-slate-900 hover:underline">
                  Home
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li className="font-semibold text-slate-900">Property dealers</li>
            </ol>
          </nav>
          <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h1 className="text-[27px] font-extrabold leading-tight tracking-tight text-slate-900 sm:text-[36px]">{s.hub.heading || 'Property Dealers in Pakistan'}</h1>
              <p className="mt-2 text-[15.5px] leading-relaxed text-slate-700">
                {s.hub.intro || 'Choose your city to see its real estate agencies and property agents — with their live listings, phone and WhatsApp.'}
              </p>
            </div>
            {withDealers.length > 0 && (
              <dl className="grid shrink-0 grid-cols-3 divide-x divide-slate-300 overflow-hidden rounded-lg border border-slate-300 text-center">
                {[
                  ['Cities', withDealers.length],
                  ['Agencies', agencies],
                  ['Agents', agents],
                ].map(([label, v]) => (
                  <div key={label} className="px-5 py-2.5">
                    <dt className="text-[11.5px] font-bold uppercase tracking-wider text-slate-600">{label}</dt>
                    <dd className="text-[24px] font-extrabold tabular-nums leading-tight text-slate-900">{Number(v).toLocaleString('en-PK')}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>
      </header>

      <div className="container mx-auto grid max-w-6xl gap-8 px-4 py-7 lg:grid-cols-[minmax(0,1fr)_290px]">
        <main className="min-w-0 space-y-10">
          {withDealers.length > 0 ? (
            <CityFinder cities={withDealers} />
          ) : (
            <p className="rounded-lg border border-slate-300 bg-white px-4 py-8 text-center text-[15px] text-slate-700">Dealers will be listed here city by city.</p>
          )}

          {s.hub.content && (
            <section className="rounded-lg border border-slate-300 bg-white p-5 sm:p-7">
              <ExpandableHtml html={s.hub.content} collapsed={320} />
            </section>
          )}

          {faqs.length > 0 && (
            <section aria-labelledby="faqs">
              <h2 id="faqs" className="border-b-2 border-slate-900 pb-2 text-[20px] font-bold tracking-tight text-slate-900 sm:text-[22px]">
                Questions
              </h2>
              <div className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-300 bg-white">
                {faqs.map((f) => (
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
            <h2 className="text-[17px] font-bold leading-snug text-slate-900">Are you a property dealer?</h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-slate-700">
              Join {site} free, choose your city, and you are listed on its dealers page. Paid plans are shown higher, with the Verified badge.
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
          <section className="rounded-lg border border-slate-300 bg-white p-5">
            <h2 className="text-[15px] font-bold text-slate-900">How the list is ordered</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-[14px] leading-relaxed text-slate-700">
              <li>Agencies, the biggest plans first</li>
              <li>Their agents, by their agency&apos;s plan</li>
              <li>Dealers on paid plans</li>
              <li>Free accounts with live listings</li>
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}

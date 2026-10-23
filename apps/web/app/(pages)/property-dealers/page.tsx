import type { Metadata } from 'next';
import Link from 'next/link';
import { Building2, ChevronRight, MapPin, Users } from 'lucide-react';
import ExpandableHtml from '@/components/societies/ExpandableHtml';
import { getDealerCities, getDealerSettings } from '@/lib/server-api';
import { DEALERS_HUB, dealersCityPath } from '@/lib/dealers';
import { photo } from '@/lib/img';
import { getSiteName } from '@/lib/site-settings.server';

/* /property-dealers: every city's dealers page, the busiest cities first. */

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
  const [cities, s] = await Promise.all([getDealerCities(), getDealerSettings()]);
  const withDealers = cities.filter((c) => c.agencies + c.agents > 0).sort((a, b) => b.agencies + b.agents - (a.agencies + a.agents) || a.name.localeCompare(b.name));
  const rest = cities.filter((c) => c.agencies + c.agents === 0);
  const total = withDealers.reduce((n, c) => n + c.agencies + c.agents, 0);
  const faqs = s.hub.faqs ?? [];

  return (
    <div className="bg-slate-50">
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
      <header className="border-b border-slate-200 bg-white">
        <div className="container mx-auto max-w-6xl px-4 py-6 sm:py-8">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[13px] text-slate-600">
            <Link href="/" className="hover:text-primary">
              Home
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="font-medium text-slate-900">Property dealers</span>
          </nav>
          <h1 className="mt-3 text-[26px] font-bold leading-tight tracking-tight text-slate-900 sm:text-[34px]">{s.hub.heading || 'Property Dealers in Pakistan'}</h1>
          <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-slate-700">
            {s.hub.intro || 'Choose your city to see its real estate agencies and property agents — with their live listings, phone and WhatsApp.'}
          </p>
          {total > 0 && (
            <p className="mt-3 text-[14px] font-semibold text-slate-900">
              {total.toLocaleString('en-PK')} dealers in {withDealers.length} {withDealers.length === 1 ? 'city' : 'cities'}
            </p>
          )}
        </div>
      </header>

      <div className="container mx-auto max-w-6xl space-y-10 px-4 py-8">
        {withDealers.length > 0 && (
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {withDealers.map((c) => (
              <Link
                key={c._id}
                href={dealersCityPath(c.slug)}
                className="group flex items-center gap-3 rounded-xl border border-slate-300 bg-white p-3 transition-colors hover:border-primary"
              >
                <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-100">
                  {c.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo(c.thumbnail, 160)} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <MapPin className="h-6 w-6 text-slate-500" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-bold text-slate-900 group-hover:text-primary">Property dealers in {c.name}</span>
                  <span className="mt-0.5 flex flex-wrap gap-x-3 text-[13.5px] text-slate-700">
                    {c.agencies > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" /> {c.agencies} {c.agencies === 1 ? 'agency' : 'agencies'}
                      </span>
                    )}
                    {c.agents > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" /> {c.agents} {c.agents === 1 ? 'agent' : 'agents'}
                      </span>
                    )}
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
              </Link>
            ))}
          </section>
        )}

        {rest.length > 0 && (
          <section>
            <h2 className="text-[17px] font-bold text-slate-900">More cities</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {rest.map((c) => (
                <Link
                  key={c._id}
                  href={dealersCityPath(c.slug)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[14px] text-slate-800 hover:border-primary hover:text-primary"
                >
                  {c.name}
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="flex flex-col items-start justify-between gap-4 rounded-xl bg-slate-900 p-6 text-white sm:flex-row sm:items-center sm:p-7">
          <div>
            <h2 className="text-[19px] font-bold">Are you a property dealer?</h2>
            <p className="mt-1 max-w-2xl text-[14.5px] text-white/80">Create a free account, choose your city and you are listed on its dealers page.</p>
          </div>
          <Link href="/register" className="inline-flex h-11 shrink-0 items-center rounded-lg bg-white px-5 text-[14.5px] font-semibold text-slate-900">
            Join free
          </Link>
        </section>

        {s.hub.content && (
          <section className="rounded-xl border border-slate-300 bg-white p-5 sm:p-7">
            <ExpandableHtml html={s.hub.content} collapsed={320} />
          </section>
        )}

        {faqs.length > 0 && (
          <section>
            <h2 className="text-[21px] font-bold tracking-tight text-slate-900 sm:text-[24px]">Questions</h2>
            <div className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-300 bg-white">
              {faqs.map((f) => (
                <details key={f.q} className="group px-5 py-4">
                  <summary className="cursor-pointer list-none text-[15.5px] font-semibold text-slate-900">
                    <span className="flex items-start justify-between gap-3">
                      {f.q}
                      <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-slate-500 transition-transform group-open:rotate-90" />
                    </span>
                  </summary>
                  <p className="mt-2 whitespace-pre-line text-[14.5px] leading-relaxed text-slate-700">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

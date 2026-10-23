import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BadgeCheck, Building2, ChevronRight, MapPin, Users } from 'lucide-react';
import { AgencyCard, AgentCard } from '@/components/dealers/DealerCards';
import { MoreAgents } from '@/components/dealers/MoreAgents';
import ExpandableHtml from '@/components/societies/ExpandableHtml';
import { getDealerCities, getDealerCity } from '@/lib/server-api';
import { DEALERS_HUB, cityText, dealerHref, dealersCityPath, hasDealers } from '@/lib/dealers';
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
        { '@type': 'ListItem', position: 2, name: 'Property dealers', item: `${SITE}${DEALERS_HUB}` },
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
    <div className="bg-slate-50">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />

      {/* Heading band */}
      <header className="border-b border-slate-200 bg-white">
        <div className="container mx-auto max-w-6xl px-4 py-6 sm:py-8">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-[13px] text-slate-600">
            <Link href="/" className="hover:text-primary">
              Home
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link href={DEALERS_HUB} className="hover:text-primary">
              Property dealers
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="font-medium text-slate-900">{name}</span>
          </nav>
          <h1 className="mt-3 text-[26px] font-bold leading-tight tracking-tight text-slate-900 sm:text-[34px]">{t.heading}</h1>
          <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-slate-700">{t.intro}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[14px] font-semibold text-slate-900">
              <Building2 className="h-4 w-4 text-primary" /> {data.total.agencies.toLocaleString('en-PK')} {data.total.agencies === 1 ? 'agency' : 'agencies'}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[14px] font-semibold text-slate-900">
              <Users className="h-4 w-4 text-primary" /> {data.total.agents.toLocaleString('en-PK')} {data.total.agents === 1 ? 'agent' : 'agents'}
            </span>
            <Link
              href={`/properties/all/${data.city.slug}`}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[14px] font-semibold text-primary hover:bg-primary/5"
            >
              <MapPin className="h-4 w-4" /> Properties in {name}
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto max-w-6xl space-y-10 px-4 py-8">
        {/* 1. Agencies */}
        {data.agencies.length > 0 && (
          <section aria-labelledby="agencies">
            <h2 id="agencies" className="flex items-center gap-2 text-[21px] font-bold tracking-tight text-slate-900 sm:text-[24px]">
              <BadgeCheck className="h-6 w-6 text-sky-500" /> Real estate agencies in {name}
            </h2>
            <p className="mt-1 text-[14px] text-slate-700">Established agencies with their own team of agents.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.agencies.map((d) => (
                <AgencyCard key={d._id} d={d} />
              ))}
            </div>
          </section>
        )}

        {/* 2. Agents, by plan */}
        {data.total.agents > 0 && (
          <section aria-labelledby="agents">
            <h2 id="agents" className="flex items-center gap-2 text-[21px] font-bold tracking-tight text-slate-900 sm:text-[24px]">
              <Users className="h-6 w-6 text-primary" /> Property agents in {name}
            </h2>
            <p className="mt-1 text-[14px] text-slate-700">Agents of the agencies above and independent dealers — call or WhatsApp them directly.</p>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {data.agents.map((d) => (
                <AgentCard key={d._id} d={d} />
              ))}
            </div>
            <MoreAgents slug={data.city.slug} pages={data.pageInfo.pages} total={data.total.agents} shown={data.agents.length} />
          </section>
        )}

        {/* For dealers */}
        <section className="flex flex-col items-start justify-between gap-4 rounded-xl bg-slate-900 p-6 text-white sm:flex-row sm:items-center sm:p-7">
          <div>
            <h2 className="text-[19px] font-bold">Are you a property dealer in {name}?</h2>
            <p className="mt-1 max-w-2xl text-[14.5px] text-white/80">
              List your agency on {site} for free. Paid plans are shown higher on this page, with the Verified badge and accounts for your agents.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Link href="/register" className="inline-flex h-11 items-center rounded-lg bg-white px-5 text-[14.5px] font-semibold text-slate-900">
              Join free
            </Link>
            <Link href="/packages" className="inline-flex h-11 items-center rounded-lg border border-white/40 px-5 text-[14.5px] font-semibold text-white hover:bg-white/10">
              See plans
            </Link>
          </div>
        </section>

        {/* The admin's text and questions */}
        {t.content && (
          <section className="rounded-xl border border-slate-300 bg-white p-5 sm:p-7">
            <ExpandableHtml html={t.content} collapsed={320} />
          </section>
        )}

        {t.faqs.length > 0 && (
          <section aria-labelledby="faqs">
            <h2 id="faqs" className="text-[21px] font-bold tracking-tight text-slate-900 sm:text-[24px]">
              Questions about property dealers in {name}
            </h2>
            <div className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-300 bg-white">
              {t.faqs.map((f) => (
                <details key={f.q} className="group px-5 py-4">
                  <summary className="cursor-pointer list-none text-[15.5px] font-semibold text-slate-900 marker:hidden">
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

        {others.length > 0 && (
          <section aria-labelledby="other-cities">
            <h2 id="other-cities" className="text-[19px] font-bold text-slate-900">
              Property dealers in other cities
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {others.map((c) => (
                <Link
                  key={c._id}
                  href={dealersCityPath(c.slug)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[14px] font-medium text-slate-800 hover:border-primary hover:text-primary"
                >
                  {c.name}
                </Link>
              ))}
              <Link href={DEALERS_HUB} className="rounded-lg px-3 py-1.5 text-[14px] font-semibold text-primary hover:bg-primary/5">
                All cities
              </Link>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

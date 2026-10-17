import Link from 'next/link';
import { BadgeCheck, ChevronRight, Download, ExternalLink, FileImage, Hash, MapPin, ShieldAlert } from 'lucide-react';
import MapExplorerClient from '@/components/map/MapExplorerClient';
import RelatedCarousel from '@/components/property/RelatedCarousel';
import { serverApi } from '@/lib/server-api';
import { amountShort } from '@/lib/pk';
import type { Property } from '@/lib/data';
import { OFFICIAL_LABELS, POI_ICONS, POI_LABELS, type SocietyMapPage } from '@/lib/society-map';
import { societyMapMeta } from '@/lib/seo/emap-meta';
import type { MapPlace } from '@/components/map/MapExplorer';

/*
 * A society's page (/emap/<city>/<society>): the map at the top — master plan,
 * outline, blocks, landmarks, plots — then everything a buyer and a search
 * engine want to read: the facts, the development authority's record and its
 * approved plan, blocks, landmarks, listings for sale and rent linked to the
 * society's archive pages, the admin's guide, FAQs and the societies around it.
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealer.pk';

const fmtNum = (n?: number) => (n ? n.toLocaleString('en-PK') : '');

async function listings(areaId: string, purpose: 'buy' | 'rent'): Promise<{ items: Property[]; total: number }> {
  if (!areaId) return { items: [], total: 0 };
  try {
    const { mapBackendToFrontendProperty } = await import('@/lib/types/property-utils');
    const p = new URLSearchParams({ page: '1', limit: '10', areaId, purpose });
    const res: any = await serverApi.getProperties(p.toString());
    const raw: any[] = Array.isArray(res) ? res : res?.properties ?? [];
    return {
      items: raw.map((r) => ({ ...mapBackendToFrontendProperty(r), description: undefined })),
      total: Number(res?.total) || raw.length,
    };
  } catch {
    return { items: [], total: 0 };
  }
}

export default async function SocietyMapPageView({ society, places }: { society: SocietyMapPage; places: MapPlace[] }) {
  const s = society;
  const [sale, rent] = await Promise.all([listings(s.areaId, 'buy'), listings(s.areaId, 'rent')]);

  const url = `${BASE_URL}/emap/${s.citySlug}/${s.slug}`;
  const download = s.layers.find((l) => l.downloadUrl)?.downloadUrl ?? s.documents?.[0]?.url;
  const saleCount = Math.max(s.stats.sale, sale.total);
  const rentCount = Math.max(s.stats.rent, rent.total);
  // Only what the admin wrote (Dashboard → Society Maps): no generated prose.
  const intro = s.seo.intro ?? '';
  const faqs = s.faqs;
  const meta = societyMapMeta(s);
  const status = s.official ? OFFICIAL_LABELS[s.official.status] : null;
  const docs = s.documents ?? [];
  const poiGroups = Object.entries(
    s.pois.reduce<Record<string, string[]>>((m, p) => {
      (m[p.kind] ||= []).push(p.name);
      return m;
    }, {}),
  ).sort((a, b) => b[1].length - a[1].length);

  const facts = [
    { label: 'For sale', value: saleCount ? `${saleCount.toLocaleString('en-PK')} listings` : '—' },
    { label: 'For rent', value: rentCount ? `${rentCount.toLocaleString('en-PK')} listings` : '—' },
    ...(s.stats.minPrice && s.stats.maxPrice ? [{ label: 'Asking prices', value: `PKR ${amountShort(s.stats.minPrice)} – ${amountShort(s.stats.maxPrice)}` }] : []),
    ...(s.blocks.length ? [{ label: 'Blocks on map', value: String(s.blocks.length) }] : []),
    ...(s.plotCount ? [{ label: 'Plots on record', value: fmtNum(s.plotCount) }] : []),
    ...(s.official?.approvedArea ? [{ label: 'Approved area', value: s.official.approvedArea }] : []),
    ...(s.official?.residentialPlots
      ? [{ label: 'Approved plots', value: `${fmtNum(s.official.residentialPlots)} residential${s.official.commercialPlots ? ` · ${fmtNum(s.official.commercialPlots)} commercial` : ''}` }]
      : []),
    ...(s.info.location ? [{ label: 'Location', value: s.info.location }] : []),
    ...(s.info.developer ? [{ label: 'Developer', value: s.info.developer }] : []),
    ...(s.info.approval ? [{ label: 'Approval', value: s.info.approval }] : []),
    ...(s.info.totalArea ? [{ label: 'Total area', value: s.info.totalArea }] : []),
    ...(s.info.plotSizes ? [{ label: 'Plot sizes', value: s.info.plotSizes }] : []),
    ...(s.info.launched ? [{ label: 'Launched', value: s.info.launched }] : []),
    ...(s.info.possession ? [{ label: 'Possession', value: s.info.possession }] : []),
  ];

  const archive = (purpose: 'sale' | 'rent') => (s.areaSlug ? `/properties/${purpose}/${s.citySlug}/${s.areaSlug}` : `/properties/${purpose}/${s.citySlug}`);
  const image = s.thumb ? (s.thumb.startsWith('http') ? s.thumb : `${BASE_URL}${s.thumb}`) : undefined;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
        { '@type': 'ListItem', position: 2, name: 'E-Map', item: `${BASE_URL}/emap` },
        { '@type': 'ListItem', position: 3, name: `${s.cityName} Map`, item: `${BASE_URL}/emap/${s.citySlug}` },
        { '@type': 'ListItem', position: 4, name: `${s.name} Map`, item: url },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Place',
      name: s.name,
      url,
      description: meta.description,
      ...(image ? { image } : {}),
      address: { '@type': 'PostalAddress', addressLocality: s.cityName, addressCountry: 'PK' },
      ...(s.center ? { geo: { '@type': 'GeoCoordinates', latitude: s.center.lat, longitude: s.center.lng } } : {}),
      ...(s.center ? { hasMap: `https://www.google.com/maps?q=${s.center.lat},${s.center.lng}` } : {}),
    },
    ...(faqs.length
      ? [
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
          },
        ]
      : []),
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <MapExplorerClient places={places} society={s} mode="page" />

      <div className="container mx-auto max-w-6xl pb-28 pt-4 lg:pb-12 lg:pt-6">
        <nav aria-label="Breadcrumb" className="hide-scrollbar flex items-center gap-1 overflow-x-auto text-[12.5px] text-slate-500">
          {[
            { href: '/', label: 'Home' },
            { href: '/emap', label: 'E-Map' },
            { href: `/emap/${s.citySlug}`, label: s.cityName },
          ].map((c) => (
            <span key={c.href} className="flex shrink-0 items-center gap-1">
              <Link href={c.href} className="hover:text-primary">{c.label}</Link>
              <ChevronRight className="h-3 w-3 text-slate-300" />
            </span>
          ))}
          <span className="shrink-0 font-medium text-slate-700">{s.name}</span>
        </nav>

        <header className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[24px] font-bold leading-tight tracking-tight text-slate-900 sm:text-[30px]">
              {s.name} {s.cityName} Map
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[14px] text-slate-600">
              <MapPin className="h-4 w-4 text-primary" /> {s.name}, {s.cityName}, Pakistan
              {status && s.official && (
                <span
                  className={`ml-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold ${
                    status.tone === 'bad' ? 'bg-red-50 text-red-700' : status.tone === 'ok' ? 'bg-sky-50 text-sky-700' : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  {status.tone === 'bad' ? <ShieldAlert className="h-3.5 w-3.5" /> : <BadgeCheck className="h-3.5 w-3.5" />}
                  {s.official.authority} {status.label.toLowerCase()}
                </span>
              )}
            </p>
          </div>
          {download && (
            <a href={download} download className="btn-shape inline-flex h-11 items-center gap-2 rounded-xl bg-slate-900 px-4 text-[14px] font-semibold text-white hover:bg-slate-800">
              <Download className="h-4 w-4" /> Download map (JPG)
            </a>
          )}
        </header>

        {intro && <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-slate-700">{intro}</p>}

        <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {facts.map((f) => (
            <div key={f.label} className="rounded-2xl border border-slate-200 bg-white p-3">
              <dt className="text-[12px] font-medium text-slate-500">{f.label}</dt>
              <dd className="mt-0.5 text-[15px] font-bold leading-snug text-slate-900">{f.value}</dd>
            </div>
          ))}
        </dl>

        {!!s.plotCount && (
          <p className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[14px] text-amber-900">
            <Hash className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>{fmtNum(s.plotCount)} plots on record.</strong> Tap any plot on the map to see its number, sector and size — or search one, e.g. “L 215”.
            </span>
          </p>
        )}

        {s.official && status && (
          <section
            className={`mt-5 rounded-2xl border p-4 ${status.tone === 'bad' ? 'border-red-200 bg-red-50/60' : 'border-emerald-200 bg-emerald-50/50'}`}
            aria-label="Approval status"
          >
            <div className="flex flex-wrap items-start gap-3">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${status.tone === 'bad' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {status.tone === 'bad' ? <ShieldAlert className="h-5 w-5" /> : <BadgeCheck className="h-5 w-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-[17px] font-bold text-slate-900">
                  {s.official.authority}: {status.label}
                </h2>
                <p className="mt-0.5 text-[14px] text-slate-700">{[s.official.stage, s.official.date, s.official.mauza].filter(Boolean).join(' · ')}</p>
                {s.official.blocks && <p className="mt-1 text-[13.5px] text-slate-600">Approved blocks: {s.official.blocks}</p>}
                {s.official.phases && s.official.phases.length > 0 && (
                  <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="w-full text-left text-[13px]">
                      <thead className="bg-slate-50 text-[12px] text-slate-500">
                        <tr>
                          <th className="px-3 py-2 font-semibold">Phase</th>
                          <th className="px-3 py-2 font-semibold">Approval</th>
                          <th className="px-3 py-2 font-semibold">Area</th>
                          <th className="px-3 py-2 font-semibold">Plots</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {s.official.phases.map((ph) => (
                          <tr key={ph.name}>
                            <td className="px-3 py-2 font-medium text-slate-900">{ph.name}</td>
                            <td className="px-3 py-2 text-slate-700">{[ph.stage, ph.date].filter(Boolean).join(' · ')}</td>
                            <td className="px-3 py-2 text-slate-700">{ph.approvedArea}</td>
                            <td className="px-3 py-2 text-slate-700">
                              {[ph.residentialPlots && `${fmtNum(ph.residentialPlots)} res.`, ph.commercialPlots && `${fmtNum(ph.commercialPlots)} comm.`].filter(Boolean).join(' · ')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="mt-2 text-[12px] text-slate-500">
                  Source:{' '}
                  {s.official.listUrl ? (
                    <a href={s.official.listUrl} target="_blank" rel="noopener nofollow" className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline">
                      {s.official.listName ?? s.official.authority} <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    s.official.listName ?? s.official.authority
                  )}
                  {s.official.checkedAt ? `, checked ${s.official.checkedAt}` : ''}. Confirm the current status with {s.official.authority} before you buy.
                </p>
              </div>
            </div>
          </section>
        )}

        {docs.length > 0 && (
          <section className="mt-5">
            <h2 className="text-[18px] font-bold text-slate-900">
              Official plan{docs.length > 1 ? 's' : ''} of {s.name}
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {docs.map((d) => (
                <figure key={d.url} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <a href={d.url} target="_blank" rel="noopener" className="block aspect-[4/3] bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={d.thumbUrl || d.url} alt={d.title} loading="lazy" className="h-full w-full object-cover" />
                  </a>
                  <figcaption className="flex items-center gap-2 p-3">
                    <FileImage className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-slate-900">{d.title}</span>
                      <span className="block text-[11.5px] text-slate-500">Source: {d.source || 'development authority'} · tap to open full size</span>
                    </span>
                    <a href={d.url} download className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-900 text-white" aria-label={`Download ${d.title}`}>
                      <Download className="h-4 w-4" />
                    </a>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        {(s.blocks.length > 0 || (s.info.amenities?.length ?? 0) > 0) && (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {s.blocks.length > 0 && (
              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <h2 className="text-[18px] font-bold text-slate-900">Blocks in {s.name}</h2>
                <p className="mt-0.5 text-[13px] text-slate-500">Tap a block on the map to see its listings.</p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {s.blocks.map((b) => (
                    <li key={b.id} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[13px] font-semibold text-slate-700">
                      {b.name}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {(s.info.amenities?.length ?? 0) > 0 && (
              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <h2 className="text-[18px] font-bold text-slate-900">Amenities</h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {s.info.amenities!.map((a) => (
                    <li key={a} className="rounded-full bg-primary/10 px-3 py-1 text-[13px] font-semibold text-primary">{a}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}

        {poiGroups.length > 0 && (
          <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-[18px] font-bold text-slate-900">Landmarks in {s.name}</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {poiGroups.map(([kind, names]) => (
                <div key={kind}>
                  <p className="text-[13px] font-semibold text-slate-900">
                    {POI_ICONS[kind] ?? '📍'} {POI_LABELS[kind] ?? kind} <span className="font-normal text-slate-500">({names.length})</span>
                  </p>
                  <p className="mt-0.5 line-clamp-3 text-[13px] text-slate-600">{[...new Set(names)].slice(0, 8).join(', ')}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {[
          { title: `Properties for sale in ${s.name}`, data: sale, href: archive('sale'), count: saleCount },
          { title: `Properties for rent in ${s.name}`, data: rent, href: archive('rent'), count: rentCount },
        ].map(({ title, data, href, count }) =>
          data.items.length > 0 ? (
            <section key={title} className="mt-8">
              <div className="mb-3 flex items-end justify-between gap-4">
                <h2 className="text-[19px] font-bold text-slate-900 sm:text-[22px]">{title}</h2>
                <Link href={href} className="shrink-0 text-[13.5px] font-semibold text-primary hover:underline">
                  View all{count ? ` ${count.toLocaleString('en-PK')}` : ''}
                </Link>
              </div>
              <RelatedCarousel items={data.items} />
            </section>
          ) : null,
        )}

        {s.seo.content && (
          <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
            <div
              className="prose prose-slate max-w-none text-[15px] leading-relaxed prose-headings:text-slate-900 prose-a:text-primary"
              dangerouslySetInnerHTML={{ __html: s.seo.content }}
            />
          </section>
        )}

        {faqs.length > 0 && (
          <section className="mt-8">
            <h2 className="text-[19px] font-bold text-slate-900 sm:text-[22px]">{s.name} — questions people ask</h2>
            <div className="mt-3 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {faqs.map((f) => (
                <details key={f.q} className="group p-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-semibold text-slate-900">
                    {f.q}
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-90" />
                  </summary>
                  <p className="mt-2 whitespace-pre-line text-[14.5px] leading-relaxed text-slate-700">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        {s.nearby.length > 0 && (
          <section className="mt-8">
            <h2 className="text-[19px] font-bold text-slate-900 sm:text-[22px]">More society maps in {s.cityName}</h2>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 lg:gap-3">
              {s.nearby.map((n) => (
                <Link key={n.slug} href={`/emap/${n.citySlug}/${n.slug}`} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="aspect-[3/2] bg-gradient-to-br from-slate-100 to-slate-200">
                    {n.thumb && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={n.thumb} alt={`${n.name} map`} loading="lazy" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <p className="truncate px-3 py-2 text-[14px] font-semibold text-slate-900 group-hover:text-primary">{n.name} Map</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        <p className="mt-8 text-[12px] leading-relaxed text-slate-500">
          {s.source === 'osm' || s.kind === 'outline' ? 'Outline, blocks and landmarks: © OpenStreetMap contributors. ' : ''}
          The map is for reference. Plot positions, sizes and approvals can change — confirm with the society office and the development authority before you buy.
        </p>
      </div>
    </>
  );
}

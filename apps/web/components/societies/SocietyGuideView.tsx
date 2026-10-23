import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Building,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardCheck,
  Home,
  KeyRound,
  Layers,
  LandPlot,
  Map as MapIcon,
  MapPin,
  Phone,
  Ruler,
  ShieldCheck,
  Store,
} from 'lucide-react';
import MapEmbed from '@/components/societies/MapEmbed';
import { AdZone } from '@/components/ads/AdSlot';
import PropertyCard from '@/components/PropertyCard';
import ExpandableHtml from '@/components/societies/ExpandableHtml';
import SocietyCard from '@/components/societies/SocietyCard';
import { CITIES, getCityBySlug } from '@/app/(pages)/emap/cities-data';
import type { Property } from '@/lib/data';
import type { SocietyMapPage } from '@/lib/society-map';
import { APPROVAL_LABELS, guideFaqs, pkPrice, type PriceRow, type SocietyPage } from '@/lib/societies';
import { cn, toTitleCase } from '@/lib/utils';

/*
 * A society's guide — the area guide, the way Zameen's read: what it is and
 * who built it, what houses and plots cost by size, its phases, its map,
 * what is inside and nearby, then its listings and the societies around it.
 * Everything here comes from the admin's write-up (Dashboard → Societies) and
 * the live listings of the society and its phases.
 */

const TYPE_TABS: { key: string; label: string; icon: typeof Home }[] = [
  { key: 'house', label: 'Houses', icon: Home },
  { key: 'plot', label: 'Plots', icon: LandPlot },
  { key: 'flat', label: 'Flats', icon: Building },
  { key: 'commercial', label: 'Commercial', icon: Store },
];

const range = (min: number, max: number) => (min === max ? `PKR ${pkPrice(min)}` : `PKR ${pkPrice(min)} – ${pkPrice(max)}`);

function PriceTable({ rows, base, type }: { rows: PriceRow[]; base: string; type: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <table className="w-full text-left text-[14px]">
        <thead className="bg-slate-50 text-[12px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2.5 font-semibold sm:px-4">Size</th>
            <th className="px-3 py-2.5 font-semibold sm:px-4">Price range</th>
            <th className="hidden px-4 py-2.5 text-right font-semibold sm:table-cell">Listings</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={`${r.marla}`} className="hover:bg-slate-50/60">
              <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-900 sm:px-4">{r.size}</td>
              <td className="px-3 py-3 text-slate-700 sm:px-4">{range(r.min, r.max)}</td>
              <td className="px-3 py-3 text-right sm:px-4">
                <Link href={`${base}/${type === 'flat' ? 'flat' : type}${r.segment ? `/${r.segment}` : ''}`} className="inline-flex items-center gap-1 whitespace-nowrap text-[13px] font-semibold text-primary hover:underline">
                  {r.count} <span className="hidden sm:inline">{r.count === 1 ? 'listing' : 'listings'}</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Fact({ icon: Icon, label, value }: { icon: typeof Home; label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0">
        <span className="block text-[12px] font-medium text-slate-500">{label}</span>
        <span className="block text-[14px] font-semibold text-slate-900">{value}</span>
      </span>
    </div>
  );
}

function Section({ id, title, children, action }: { id: string; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-32">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="text-[20px] font-bold tracking-tight text-slate-900 sm:text-[23px]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function SocietyGuideView({ s, map, listings, preview = false }: { s: SocietyPage; map: SocietyMapPage | null; listings: Property[]; preview?: boolean }) {
  const g = s.guide ?? {};
  const name = toTitleCase(s.name);
  const city = s.city;
  const approval = APPROVAL_LABELS[g.approval ?? ''];
  const faqs = guideFaqs(s);
  const saleBase = `/properties/sale/${city.slug}/${s.slug}`;
  const rentBase = `/properties/rent/${city.slug}/${s.slug}`;
  const cover = g.image || s.map?.thumb || '';
  const tabs = TYPE_TABS.filter((t) => (s.prices[t.key]?.sale.length ?? 0) + (s.prices[t.key]?.rent.length ?? 0) > 0);
  const places = CITIES.map(({ slug, name: n, lat, lng, zoom }) => ({ slug, name: n, lat, lng, zoom }));
  const mapCity = getCityBySlug(city.slug);
  const focus = s.lat && s.lng ? { lat: s.lat, lng: s.lng, zoom: 15 } : mapCity ? { lat: mapCity.lat, lng: mapCity.lng, zoom: mapCity.zoom } : null;
  const hasMap = !!map || !!focus;
  const nav = [
    ['overview', 'Overview'],
    tabs.length ? ['prices', 'Prices'] : null,
    s.phases.length ? ['phases', 'Phases'] : null,
    hasMap ? ['map', 'Map'] : null,
    g.amenities?.length || g.nearby?.length ? ['amenities', 'Amenities'] : null,
    g.paymentPlan ? ['payment', 'Payment plan'] : null,
    listings.length ? ['listings', 'Listings'] : null,
    faqs.length ? ['faqs', 'FAQs'] : null,
  ].filter(Boolean) as [string, string][];

  const highlights = [
    { label: 'House prices', r: s.stats.house, href: `${saleBase}/house`, icon: Home },
    { label: 'Plot prices', r: s.stats.plot, href: `${saleBase}/plot`, icon: LandPlot },
    { label: 'Flat prices', r: s.stats.flat, href: `${saleBase}/flat`, icon: Building },
    { label: 'House rent', r: s.stats.houseRent, href: `${rentBase}/house`, icon: KeyRound },
  ].filter((h) => h.r);

  return (
    <main className="bg-slate-50">
      {preview && (
        <div className="bg-amber-400 px-4 py-2 text-center text-[13px] font-semibold text-amber-950">
          Preview — {s.published ? 'this guide is live' : 'not published yet; visitors cannot see it'}
        </div>
      )}

      {/* Cover */}
      <section className="relative isolate overflow-hidden bg-navy text-white">
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt={`${name} ${city.name}`} className="absolute inset-0 -z-10 h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-slate-950/90 via-slate-950/55 to-slate-950/30" />
        <div className="container mx-auto px-4 pb-7 pt-5 sm:pb-10 sm:pt-6">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-[12.5px] text-white/75">
            <Link href="/" className="hover:text-white">Home</Link>
            <ChevronRight className="h-3 w-3" />
            <Link href="/societies" className="hover:text-white">Societies</Link>
            <ChevronRight className="h-3 w-3" />
            <Link href={`/societies/${city.slug}`} className="hover:text-white">{city.name}</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-white">{name}</span>
          </nav>
          <div className="mt-16 max-w-3xl sm:mt-24">
            <div className="flex flex-wrap gap-2">
              {approval && (
                <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold', approval.tone === 'good' ? 'bg-emerald-500 text-white' : approval.tone === 'ok' ? 'bg-amber-400 text-amber-950' : 'bg-red-600 text-white')}>
                  {approval.tone === 'good' ? <BadgeCheck className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                  {g.approvedBy && approval.tone === 'good' ? `${g.approvedBy} approved` : approval.label}
                </span>
              )}
              {s.phases.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[12px] font-semibold backdrop-blur">
                  <Layers className="h-3.5 w-3.5" /> {s.phases.length} {s.phases.length === 1 ? 'phase' : 'phases'}
                </span>
              )}
            </div>
            <h1 className="mt-2 text-[28px] font-extrabold leading-tight tracking-tight sm:text-[42px]">
              {name} {city.name}
            </h1>
            <p className="mt-1.5 flex items-start gap-1.5 text-[15px] text-white/85">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {g.tagline || g.address || `${name}, ${city.name}, Pakistan`}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href={saleBase} className="btn-shape inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-[14px] font-semibold text-white hover:bg-primary/90">
                For sale <span className="rounded-md bg-white/20 px-1.5 text-[12.5px]">{s.stats.sale}</span>
              </Link>
              <Link href={rentBase} className="btn-shape inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-[14px] font-semibold text-slate-900 hover:bg-slate-100">
                For rent <span className="rounded-md bg-slate-100 px-1.5 text-[12.5px]">{s.stats.rent}</span>
              </Link>
              {s.map && (
                <Link href={`/emap/${s.map.citySlug}/${s.map.slug}`} className="btn-shape inline-flex h-11 items-center gap-2 rounded-xl border border-white/40 px-4 text-[14px] font-semibold text-white hover:bg-white/10">
                  <MapIcon className="h-4 w-4" /> Society map
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Section links */}
      <div className="sticky top-16 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="hide-scrollbar container mx-auto flex gap-1 overflow-x-auto px-[var(--gutter)] sm:px-4">
          {nav.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="shrink-0 border-b-2 border-transparent px-3 py-3 text-[14px] font-semibold text-slate-600 hover:border-primary hover:text-primary">
              {label}
            </a>
          ))}
        </div>
      </div>

      <div className="container mx-auto space-y-10 px-[var(--gutter)] py-7 sm:px-4 sm:py-10">
        {/* Price highlights */}
        {highlights.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {highlights.map((h) => (
              <Link key={h.label} href={h.href} className="group rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-primary">
                <span className="flex items-center gap-2 text-[13px] font-semibold text-slate-500">
                  <h.icon className="h-4 w-4 text-primary" /> {h.label}
                </span>
                <span className="mt-1 block text-[18px] font-extrabold tracking-tight text-slate-900">{range(h.r!.min, h.r!.max)}</span>
                <span className="mt-0.5 flex items-center gap-1 text-[12.5px] font-semibold text-primary">
                  {h.r!.count} {h.r!.count === 1 ? 'listing' : 'listings'} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        )}

        <Section id="overview" title={`About ${name}`}>
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
              {g.overview ? (
                <ExpandableHtml html={g.overview} />
              ) : (
                <p className="text-[15px] leading-relaxed text-slate-700">
                  {name} is a housing society in {city.name}
                  {s.stats.sale + s.stats.rent > 0 ? `, with ${s.stats.sale} ${s.stats.sale === 1 ? 'property' : 'properties'} for sale and ${s.stats.rent} for rent listed here` : ''}.
                </p>
              )}
            </div>
            <div className="grid content-start gap-2.5">
              <Fact icon={Building2} label="Developer" value={g.developer} />
              <Fact icon={ClipboardCheck} label="Approved by" value={g.approvedBy ? `${g.approvedBy}${approval ? ` — ${approval.label.toLowerCase()}` : ''}` : approval?.label} />
              <Fact icon={Ruler} label="Total area" value={g.totalArea} />
              <Fact icon={LandPlot} label="Plot sizes" value={g.plotSizes} />
              <Fact icon={CalendarDays} label="Launched" value={g.launched} />
              <Fact icon={KeyRound} label="Possession" value={g.possession} />
              <Fact icon={MapPin} label="Location" value={g.address} />
              {g.phone && (
                <div className="pt-1">
                  <a href={`tel:${g.phone.replace(/\s/g, '')}`} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-[13.5px] font-semibold text-slate-800">
                    <Phone className="h-4 w-4" /> {g.phone}
                  </a>
                </div>
              )}
            </div>
          </div>
        </Section>

        {tabs.length > 0 && (
          <Section id="prices" title={`Property prices in ${name}`}>
            <div className="grid gap-5 lg:grid-cols-2">
              {tabs.flatMap((t) =>
                (['sale', 'rent'] as const)
                  .filter((l) => (s.prices[t.key]?.[l].length ?? 0) > 0)
                  .map((l) => (
                    <div key={`${t.key}-${l}`}>
                      <h3 className="mb-2 flex items-center gap-2 text-[15px] font-bold text-slate-900">
                        <t.icon className="h-4 w-4 text-primary" /> {t.label} {l === 'sale' ? 'for sale' : 'for rent'}
                      </h3>
                      <PriceTable rows={s.prices[t.key]![l]} base={l === 'sale' ? saleBase : rentBase} type={t.key} />
                    </div>
                  )),
              )}
            </div>
            <p className="mt-2 text-[12.5px] text-slate-500">From the listings on Property Dealer right now — prices change as new ones are added.</p>
          </Section>
        )}

        <AdZone page="society" at="after:prices" />

        {s.phases.length > 0 && (
          <Section id="phases" title={`Phases of ${name}`}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {s.phases.map((p) => (
                <div key={p._id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  {p.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image} alt={p.name} className="aspect-[16/8] w-full object-cover" loading="lazy" />
                  )}
                  <div className="p-4">
                    <p className="text-[16px] font-bold capitalize text-slate-900">{p.name}</p>
                    {p.tagline && <p className="text-[13px] text-slate-500">{p.tagline}</p>}
                    {p.overview && <div className="prose prose-sm mt-2 line-clamp-4 max-w-none text-slate-600" dangerouslySetInnerHTML={{ __html: p.overview }} />}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link href={`/properties/sale/${city.slug}/${p.slug}`} className="inline-flex h-9 items-center rounded-lg bg-primary/10 px-3 text-[13px] font-semibold text-primary hover:bg-primary/15">
                        {p.sale} for sale
                      </Link>
                      <Link href={`/properties/rent/${city.slug}/${p.slug}`} className="inline-flex h-9 items-center rounded-lg bg-slate-100 px-3 text-[13px] font-semibold text-slate-700 hover:bg-slate-200">
                        {p.rent} for rent
                      </Link>
                      {p.map && (
                        <Link href={`/emap/${p.map.citySlug}/${p.map.slug}`} className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-[13px] font-semibold text-slate-600 hover:text-primary">
                          <MapIcon className="h-4 w-4" /> Map
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {hasMap && (
          <Section
            id="map"
            title={`${name} map`}
            action={
              s.map ? (
                <Link href={`/emap/${s.map.citySlug}/${s.map.slug}`} className="shrink-0 text-[14px] font-semibold text-primary hover:underline">
                  Open full map
                </Link>
              ) : undefined
            }
          >
            {map ? (
              <MapEmbed places={places} society={map} preview={s.map?.thumb} label={`Open the ${name} map`} />
            ) : (
              <MapEmbed places={places} focus={focus} city={mapCity ? { slug: city.slug, name: mapCity.name } : null} label={`See ${name} on the map`} />
            )}
          </Section>
        )}

        {(g.amenities?.length || g.nearby?.length) ? (
          <Section id="amenities" title="Amenities & what's nearby">
            <div className="grid gap-5 lg:grid-cols-2">
              {g.amenities?.length ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                  <h3 className="mb-3 text-[15px] font-bold text-slate-900">Inside {name}</h3>
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {g.amenities.map((a) => (
                      <li key={a} className="flex items-start gap-2 text-[14px] text-slate-700">
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {g.nearby?.length ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                  <h3 className="mb-3 text-[15px] font-bold text-slate-900">Nearby</h3>
                  <ul className="space-y-2">
                    {g.nearby.map((n) => (
                      <li key={n} className="flex items-start gap-2 text-[14px] text-slate-700">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {n}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </Section>
        ) : null}

        {g.paymentPlan && (
          <Section id="payment" title="Payment plan & booking">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
              <ExpandableHtml html={g.paymentPlan} collapsed={360} />
            </div>
          </Section>
        )}

        {g.gallery?.length ? (
          <Section id="gallery" title="Photos">
            <div className="hide-scrollbar -mx-[var(--gutter)] flex snap-x gap-2 overflow-x-auto px-[var(--gutter)] sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0 lg:grid-cols-4">
              {g.gallery.map((src, i) => (
                <a key={src} href={src} target="_blank" rel="noopener" className="w-[70%] shrink-0 snap-start overflow-hidden rounded-xl sm:w-auto">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`${name} photo ${i + 1}`} className="aspect-[4/3] w-full object-cover transition-transform hover:scale-105" loading="lazy" />
                </a>
              ))}
            </div>
          </Section>
        ) : null}

        {listings.length > 0 && (
          <Section
            id="listings"
            title={`Latest properties in ${name}`}
            action={
              <Link href={saleBase} className="shrink-0 text-[14px] font-semibold text-primary hover:underline">
                View all
              </Link>
            }
          >
            <div className="grid gap-3 lg:grid-cols-2">
              {listings.map((p) => (
                <PropertyCard key={p.id} property={p} />
              ))}
            </div>
          </Section>
        )}

        {faqs.length ? (
          <Section id="faqs" title={`${name} — questions people ask`}>
            <div className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {faqs.map((f) => (
                <details key={f.q} className="group px-4 py-3.5 sm:px-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-semibold text-slate-900">
                    {f.q}
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-90" />
                  </summary>
                  <p className="mt-2 whitespace-pre-line text-[14.5px] leading-relaxed text-slate-600">{f.a}</p>
                </details>
              ))}
            </div>
          </Section>
        ) : null}

        {s.nearby.length > 0 && (
          <Section
            id="nearby"
            title="Explore nearby societies"
            action={
              <Link href={`/societies/${city.slug}`} className="shrink-0 text-[14px] font-semibold text-primary hover:underline">
                All in {city.name}
              </Link>
            }
          >
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
              {s.nearby.map((n) => (
                <div key={n._id}>
                  <SocietyCard s={n} />
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </main>
  );
}

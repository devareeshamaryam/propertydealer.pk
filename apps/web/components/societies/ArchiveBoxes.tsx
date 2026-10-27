import Link from 'next/link';
import { ArrowRight, BadgeCheck, BookOpen, Building2, Layers, Map as MapIcon } from 'lucide-react';
import MapEmbed from '@/components/societies/MapEmbed';
import SocietyCard from '@/components/societies/SocietyCard';
import { agentProfilePath } from '@/lib/agent';
import { getCityAgencies, type SpotlightAgency } from '@/lib/server-api';
import { getAreaSociety, getSocieties } from '@/lib/societies';
import { CITIES, getCityBySlug } from '@/app/(pages)/emap/cities-data';
import { toTitleCase } from '@/lib/utils';
import { chipClass } from '@/lib/chip';
import { photo } from '@/lib/img';
import { dealersCityPath, hasDealers } from '@/lib/dealers';
import { getDealerCities } from '@/lib/server-api';

const citySlugOf = (name: string) => name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** The city's property dealers page — only when it has one (a dealer has joined). */
async function dealersPageOf(cityName: string): Promise<string | null> {
  const slug = citySlugOf(cityName);
  const c = (await getDealerCities()).find((x) => x.slug === slug);
  return c && hasDealers(c) ? dealersCityPath(slug) : null;
}

/*
 * The boxes around the results on listing pages: on an area that is a
 * society (or one of its phases) the society card with its phases; on a
 * city page the city's verified agencies, its societies and its map.
 */

const purposePath = (p: 'sale' | 'rent' | 'all') => p;

/** Area pages: the society this area is, or belongs to — its guide and its phases. */
export async function AreaSocietyBox({ citySlug, areaSlug, purpose }: { citySlug: string; areaSlug: string; purpose: 'sale' | 'rent' | 'all' }) {
  const soc = await getAreaSociety(citySlug, areaSlug);
  if (!soc) return null;
  const base = `/properties/${purposePath(purpose)}/${citySlug}`;
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {soc.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo(soc.image, 640)} alt={soc.name} className="aspect-[16/9] w-full object-cover" loading="lazy" />
      )}
      <div className="p-4">
        <p className="text-[11.5px] font-semibold uppercase tracking-wider text-primary">{soc.isPhase ? 'Part of' : 'Housing society'}</p>
        <p className="text-[18px] font-bold capitalize leading-tight text-slate-900">{soc.name}</p>
        {soc.tagline && <p className="mt-0.5 text-[13px] text-slate-500">{soc.tagline}</p>}

        {soc.phases.length > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 flex items-center gap-1 text-[12.5px] font-semibold text-slate-700">
              <Layers className="h-3.5 w-3.5" /> Phases
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Link
                href={`${base}/${soc.slug}`}
                className={chipClass(areaSlug === soc.slug)}
              >
                All of {toTitleCase(soc.name)}
              </Link>
              {soc.phases.map((p) => (
                <Link
                  key={p.slug}
                  href={`${base}/${p.slug}`}
                  className={chipClass(areaSlug === p.slug, 'capitalize')}
                >
                  {p.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        {soc.url && (
          <Link href={soc.url} className="btn-shape mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary text-[14px] font-semibold text-white hover:bg-primary/90">
            <BookOpen className="h-4 w-4" /> Society guide — prices, map &amp; more
          </Link>
        )}
      </div>
    </div>
  );
}

function AgencyRow({ a }: { a: SpotlightAgency }) {
  return (
    <Link href={agentProfilePath({ _id: a._id, name: a.name }) ?? '/agents'} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-slate-50">
      <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-slate-100">
        {a.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo(a.avatarUrl, 96)} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <Building2 className="h-5 w-5 text-slate-400" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-[14px] font-semibold text-slate-900">
          <span className="truncate">{a.name}</span>
          <BadgeCheck className="h-4 w-4 shrink-0 text-sky-500" aria-label="Verified" />
        </span>
        <span className="block truncate text-[12px] text-slate-500">{a.listings ? `${a.listings} ${a.listings === 1 ? 'listing' : 'listings'} here` : a.address || 'Verified agency'}</span>
      </span>
    </Link>
  );
}

/** Sidebar: the city's verified agencies. */
export async function CityAgenciesBox({ cityId, cityName }: { cityId?: string; cityName: string }) {
  if (!cityId) return null;
  const [agencies, dealersPage] = await Promise.all([getCityAgencies(cityId), dealersPageOf(cityName)]);
  if (!agencies.length) return null;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <p className="flex items-center gap-1.5 px-2 pb-1 pt-1 text-[15px] font-bold text-slate-900">
        <BadgeCheck className="h-5 w-5 text-sky-500" /> Verified agencies in {cityName}
      </p>
      <div className="divide-y divide-slate-100">
        {agencies.slice(0, 6).map((a) => (
          <AgencyRow key={a._id} a={a} />
        ))}
      </div>
      {dealersPage && (
        <Link href={dealersPage} className="mt-1 flex items-center justify-center gap-1 rounded-xl py-2 text-[13px] font-semibold text-primary hover:bg-primary/5">
          All property dealers in {cityName} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

/** Under a city's results: its societies, its verified agencies and its map. */
export async function CityExtras({ citySlug, cityId, cityName }: { citySlug: string; cityId?: string; cityName: string }) {
  const [societies, agencies, dealersPage] = await Promise.all([
    getSocieties(citySlug),
    cityId ? getCityAgencies(cityId) : Promise.resolve([]),
    dealersPageOf(cityName),
  ]);
  const mapCity = getCityBySlug(citySlug);
  if (!societies.length && !agencies.length && !mapCity) return null;
  const places = CITIES.map(({ slug, name, lat, lng, zoom }) => ({ slug, name, lat, lng, zoom }));

  return (
    <div className="border-t border-slate-200 bg-white">
      <div className="container mx-auto space-y-10 px-[var(--gutter)] py-8 sm:px-4 sm:py-10">
        {societies.length > 0 && (
          <section>
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-[21px] font-bold tracking-tight text-slate-900 sm:text-[24px]">Societies in {cityName}</h2>
                <p className="text-[14px] text-slate-500">Guides with prices, phases, maps and the listings in each.</p>
              </div>
              <Link href={`/societies/${citySlug}`} className="shrink-0 text-[14px] font-semibold text-primary hover:underline">
                All societies
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
              {societies.slice(0, 8).map((s) => (
                <div key={s._id}>
                  <SocietyCard s={s} />
                </div>
              ))}
            </div>
          </section>
        )}

        {agencies.length > 0 && (
          <section>
            <div className="mb-4 flex items-end justify-between gap-3">
              <h2 className="flex items-center gap-2 text-[21px] font-bold tracking-tight text-slate-900 sm:text-[24px]">
                <BadgeCheck className="h-6 w-6 text-sky-500" /> Verified agencies in {cityName}
              </h2>
              {dealersPage && (
                <Link href={dealersPage} className="shrink-0 text-[14px] font-semibold text-primary hover:underline">
                  All dealers
                </Link>
              )}
            </div>
            <div className="grid gap-1 rounded-2xl border border-slate-200 p-2 sm:grid-cols-2 lg:grid-cols-3">
              {agencies.map((a) => (
                <AgencyRow key={a._id} a={a} />
              ))}
            </div>
          </section>
        )}

        {mapCity && (
          <section>
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-[21px] font-bold tracking-tight text-slate-900 sm:text-[24px]">
                  <MapIcon className="h-6 w-6 text-primary" /> {cityName} map
                </h2>
                <p className="text-[14px] text-slate-500">Societies, their master plans and listings on the satellite map.</p>
              </div>
              <Link href={`/emap/${citySlug}`} className="shrink-0 text-[14px] font-semibold text-primary hover:underline">
                Open full map
              </Link>
            </div>
            <MapEmbed places={places} focus={{ lat: mapCity.lat, lng: mapCity.lng, zoom: mapCity.zoom }} city={{ slug: citySlug, name: mapCity.name }} label={`Explore the ${cityName} map`} />
          </section>
        )}
      </div>
    </div>
  );
}

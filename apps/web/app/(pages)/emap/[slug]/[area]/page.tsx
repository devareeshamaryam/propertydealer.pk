import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, MapPin } from "lucide-react";
import { CITIES, getCityBySlug } from "../../cities-data";
import MapExplorerClient from "@/components/map/MapExplorerClient";
import SocietyMapPageView from "@/components/society-map/SocietyMapPageView";
import { societyMapMeta } from "@/lib/seo/emap-meta";
import { getMapPlaces, getSocietyMap } from "@/lib/society-map";
import { getSiteName } from "@/lib/site-settings.server";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://propertydealer.pk";

// area name → URL slug (same function as in EMap.tsx)
function toSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export function generateStaticParams() {
  const params: { slug: string; area: string }[] = [];
  CITIES.forEach((city) => {
    city.areas.forEach((area) => {
      params.push({ slug: city.slug, area: toSlug(area.name) });
    });
  });
  return params;
}

const places = () => CITIES.map(({ slug, name, lat, lng, zoom }) => ({ slug, name, lat, lng, zoom }));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; area: string }>;
}): Promise<Metadata> {
  const site = await getSiteName();
  const { slug, area } = await params;

  // A society with a published map: its own title, description and share image.
  const society = await getSocietyMap(slug, area);
  if (society) {
    const { title, description } = societyMapMeta(society);
    const url = `${BASE_URL}/emap/${society.citySlug}/${society.slug}`;
    const image = society.thumb ? (society.thumb.startsWith("http") ? society.thumb : `${BASE_URL}${society.thumb}`) : undefined;
    return {
      title,
      description,
      alternates: { canonical: url },
      openGraph: { title, description, url, type: "website", ...(image ? { images: [{ url: image }] } : {}) },
      twitter: { card: "summary_large_image", title, ...(image ? { images: [image] } : {}) },
      // Only a society with a real plan on the map belongs in search; an outline or a scanned record stays out.
      ...(society.kind === "plan" ? {} : { robots: { index: false, follow: true } }),
    };
  }

  const city = getCityBySlug(slug);
  const areaData = city?.areas.find((a) => toSlug(a.name) === area);
  if (city && areaData) {
    // The original E-Map pages: kept in the index as they always were.
    return {
      title: `${areaData.name} Map | ${city.name} | ${site}`,
      description: `${areaData.name}, ${city.name} on the satellite map, with the properties for sale and rent there.`,
      alternates: { canonical: `${BASE_URL}/emap/${slug}/${area}` },
    };
  }
  // A society placed by its real listings: useful to open from the map, too
  // thin to stand in search results until it has a map of its own.
  const place = (await getMapPlaces(slug)).find((p) => p.slug === area);
  if (!place) return {};
  return {
    title: `${place.name} Map | ${place.cityName ?? city?.name ?? ""} | ${site}`,
    alternates: { canonical: `${BASE_URL}/emap/${slug}/${area}` },
    robots: { index: false, follow: true },
  };
}

/** A society without a map yet: where it is, and its listings. */
function PlaceView({ name, cityName, citySlug, areaSlug, listings, focus }: { name: string; cityName: string; citySlug: string; areaSlug: string; listings: number; focus: { lat: number; lng: number; zoom: number } }) {
  return (
    <>
      <MapExplorerClient places={places()} focus={focus} mode="page" />
      <section className="container mx-auto max-w-6xl pb-28 pt-4 lg:pb-12">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-[12.5px] text-slate-500">
          <Link href="/emap" className="hover:text-primary">E-Map</Link>
          <ChevronRight className="h-3 w-3 text-slate-300" />
          <Link href={`/emap/${citySlug}`} className="hover:text-primary">{cityName}</Link>
          <ChevronRight className="h-3 w-3 text-slate-300" />
          <span className="font-medium text-slate-700">{name}</span>
        </nav>
        <h1 className="mt-3 text-[24px] font-bold tracking-tight text-slate-900 sm:text-[30px]">{name} {cityName} Map</h1>
        <p className="mt-1 flex items-center gap-1.5 text-[14px] text-slate-600">
          <MapPin className="h-4 w-4 text-primary" /> {name}, {cityName}, Pakistan
        </p>
        <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-slate-700">
          {name} is marked on the satellite map above{listings ? `, with ${listings} ${listings === 1 ? "property" : "properties"} listed here` : ""}. Its outline and master plan are not on the map yet — the {cityName} map shows the societies that have them.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/properties/sale/${citySlug}/${areaSlug}`} className="inline-flex h-11 items-center rounded-md bg-slate-900 px-4 text-[14px] font-semibold text-white">
            Property for sale in {name}
          </Link>
          <Link href={`/properties/rent/${citySlug}/${areaSlug}`} className="inline-flex h-11 items-center rounded-md border border-slate-400 px-4 text-[14px] font-semibold text-slate-800">
            For rent
          </Link>
          <Link href={`/emap/${citySlug}`} className="inline-flex h-11 items-center rounded-md border border-slate-400 px-4 text-[14px] font-semibold text-slate-800">
            {cityName} map
          </Link>
        </div>
      </section>
    </>
  );
}

export default async function AreaPage({
  params,
}: {
  params: Promise<{ slug: string; area: string }>;
}) {
  const { slug, area } = await params;

  const society = await getSocietyMap(slug, area);
  if (society) return <SocietyMapPageView society={society} places={places()} />;

  // /emap/<city>/<area>: the property map, opened close on that area —
  // a hand-placed one, or one placed by its real listings.
  const city = getCityBySlug(slug);
  const areaData = city?.areas.find((a) => toSlug(a.name) === area);
  const place = (await getMapPlaces(slug)).find((p) => p.slug === area);
  if (areaData && city) {
    return (
      <PlaceView
        name={areaData.name}
        cityName={city.name}
        citySlug={slug}
        areaSlug={area}
        listings={place?.listings ?? 0}
        focus={{ lat: areaData.lat, lng: areaData.lng, zoom: 15 }}
      />
    );
  }
  if (!place) notFound();
  return (
    <PlaceView
      name={place.name}
      cityName={place.cityName ?? city?.name ?? slug}
      citySlug={slug}
      areaSlug={area}
      listings={place.listings}
      focus={{ lat: place.lat, lng: place.lng, zoom: 15 }}
    />
  );
}

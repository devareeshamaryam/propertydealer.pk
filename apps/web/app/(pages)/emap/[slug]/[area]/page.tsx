import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CITIES, getCityBySlug } from "../../cities-data";
import MapExplorerClient from "@/components/map/MapExplorerClient";
import SocietyMapPageView, { autoIntro } from "@/components/society-map/SocietyMapPageView";
import { getMapPlaces, getSocietyMap } from "@/lib/society-map";

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
  const { slug, area } = await params;

  // A society with a published map: its own title, description and share image.
  const society = await getSocietyMap(slug, area);
  if (society) {
    const what =
      society.kind === "plan"
        ? society.plotCount
          ? "Master Plan, Plot Finder & Location"
          : "Master Plan, Blocks & Location"
        : society.kind === "document"
          ? "Approved Layout Plan & Location"
          : "Location, Blocks & Landmarks";
    const title = society.seo.metaTitle || `${society.name} ${society.cityName} Map — ${what}`;
    const description = society.seo.metaDescription || society.seo.intro || autoIntro(society);
    const url = `${BASE_URL}/emap/${society.citySlug}/${society.slug}`;
    const image = society.thumb ? (society.thumb.startsWith("http") ? society.thumb : `${BASE_URL}${society.thumb}`) : undefined;
    return {
      title,
      description: description.slice(0, 200),
      alternates: { canonical: url },
      openGraph: { title, description: description.slice(0, 200), url, type: "website", ...(image ? { images: [{ url: image }] } : {}) },
      twitter: { card: "summary_large_image", title, ...(image ? { images: [image] } : {}) },
    };
  }

  const city = getCityBySlug(slug);
  const areaData = city?.areas.find((a) => toSlug(a.name) === area);
  if (city && areaData) {
    return { title: `${areaData.name} Map | ${city.name} | PropertyDealer.pk` };
  }
  // A society placed by its real listings.
  const place = (await getMapPlaces(slug)).find((p) => p.slug === area);
  if (!place) return {};
  return { title: `${place.name} Map | ${place.cityName ?? city?.name ?? ""} | PropertyDealer.pk` };
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
  if (areaData) {
    return <MapExplorerClient places={places()} focus={{ lat: areaData.lat, lng: areaData.lng, zoom: 15 }} />;
  }
  const place = (await getMapPlaces(slug)).find((p) => p.slug === area);
  if (!place) notFound();
  return <MapExplorerClient places={places()} focus={{ lat: place.lat, lng: place.lng, zoom: 15 }} />;
}

import { notFound } from "next/navigation";
import { CITIES, getCityBySlug } from "../../cities-data";
import MapExplorerClient from "@/components/map/MapExplorerClient";

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; area: string }>;
}) {
  const { slug, area } = await params;
  const city = getCityBySlug(slug);
  if (!city) return {};
  const areaData = city.areas.find((a) => toSlug(a.name) === area);
  if (!areaData) return {};
  return {
    title: `${areaData.name} Map | ${city.name} | PropertyDealer.pk`,
  };
}

export default async function AreaPage({
  params,
}: {
  params: Promise<{ slug: string; area: string }>;
}) {
  const { slug, area } = await params;

  const city = getCityBySlug(slug);
  if (!city) notFound();

  const areaData = city.areas.find((a) => toSlug(a.name) === area);
  if (!areaData) notFound();

  // /emap/<city>/<area>: the property map, opened close on that area.
  const places = CITIES.map(({ slug, name, lat, lng, zoom }) => ({ slug, name, lat, lng, zoom }));
  return <MapExplorerClient places={places} focus={{ lat: areaData.lat, lng: areaData.lng, zoom: 15 }} />;
}
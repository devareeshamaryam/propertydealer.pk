import { notFound } from "next/navigation";
import { CITIES, getCityBySlug } from "../../cities-data";
import AreaMapClient from "./AreaMapClient";

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

  return (
    <main style={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
      <AreaMapClient city={city} area={areaData} />
    </main>
  );
}
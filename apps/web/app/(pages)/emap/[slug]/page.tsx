import { getCityBySlug, CITIES } from "../cities-data";
import { notFound } from "next/navigation";
import { getMapPlaces } from "@/lib/society-map";
import EmapClient from "./EmapClient";

export function generateStaticParams() {
  return CITIES.map((c) => ({ slug: c.slug }));
}

/** A city from the static list, or one that has real pinned listings. */
async function findCity(slug: string) {
  const known = getCityBySlug(slug);
  if (known) return { name: known.name, lat: known.lat, lng: known.lng, zoom: known.zoom };
  const hit = (await getMapPlaces()).find((c) => c.slug === slug);
  return hit ? { name: hit.name, lat: hit.lat, lng: hit.lng, zoom: 12 } : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const city = await findCity(slug);
  if (!city) return {};
  const title = `${city.name} Map — Housing Societies, Plots & Property | PropertyDealer.pk`;
  const description = `Interactive ${city.name} map: every housing society with its outline, blocks, landmarks and approval status, official master and layout plans, and the houses and plots for sale and rent — on satellite.`;
  const url = `${BASE_URL}/emap/${slug}`;
  return { title, description, alternates: { canonical: url }, openGraph: { title, description, url, type: "website" } };
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://propertydealer.pk";

export default async function CityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const city = await findCity(slug);
  if (!city) notFound();

  return <EmapClient focusedSlug={slug} city={city} />;
}

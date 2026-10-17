import { getCityBySlug, CITIES } from "../cities-data";
import { notFound } from "next/navigation";
import { getMapPlaces, getSocietyMaps } from "@/lib/society-map";
import { serverApi } from "@/lib/server-api";
import { cityMapMeta } from "@/lib/seo/emap-meta";
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
  // Dashboard → Static Pages, slug "emap-<city>": its Meta Title / Description win; else the keyword defaults.
  const [page, maps] = await Promise.all([cityPage(slug), getSocietyMaps(slug)]);
  const fallback = cityMapMeta(city.name, maps.length);
  const title = page?.metaTitle?.trim() || fallback.title;
  const description = page?.metaDescription?.trim() || fallback.description;
  const url = `${BASE_URL}/emap/${slug}`;
  return { title, description, alternates: { canonical: url }, openGraph: { title, description, url, type: "website" } };
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://propertydealer.pk";

/** The admin's page for this city's map (Dashboard → Static Pages, slug "emap-<city>"), if published. */
async function cityPage(slug: string): Promise<{ title?: string; content?: string; metaTitle?: string; metaDescription?: string } | null> {
  try {
    return await serverApi.getPageBySlug(`emap-${slug}`);
  } catch {
    return null;
  }
}

export default async function CityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const city = await findCity(slug);
  if (!city) notFound();

  const page = await cityPage(slug);
  return <EmapClient focusedSlug={slug} city={city} content={page?.content ?? ""} heading={page?.title ?? ""} />;
}

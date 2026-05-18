 import { getCityBySlug, CITIES } from "../cities-data";
import { notFound } from "next/navigation";
import EmapClient from "./EmapClient";

export function generateStaticParams() {
  return CITIES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const city = getCityBySlug(slug);
  if (!city) return {};
  return { title: `${city.name} Map | PropertyDealer.pk` };
}

export default async function CityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const city = getCityBySlug(slug);
  if (!city) notFound();

  return <EmapClient focusedSlug={slug} />;
}
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import MaterialDetailClient from '@/components/MaterialRate/MaterialDetailClient';
import { getMaterialRate, getMaterialType, materialSlugFromPage } from '@/lib/materials';
import { getSiteName } from '@/lib/site-settings.server';

/**
 * /today-<material>-rate-in-pakistan/<product> for a material added from the
 * dashboard — the same product page the built-in materials have. Any other
 * two-level address that reaches here is a 404.
 */

export const revalidate = 60;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

interface Props {
  params: Promise<{ slug: string; item: string }>;
}

async function load(slug: string, item: string) {
  const material = materialSlugFromPage(slug);
  if (!material) return null;
  const type = await getMaterialType(material);
  if (!type) return null;
  const rate = await getMaterialRate(type.slug, item);
  return rate ? { type, rate } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, item } = await params;
  const data = await load(slug, item).catch(() => null);
  if (!data) return { title: 'Not found', robots: { index: false, follow: true } };
  const site = await getSiteName();
  const { type, rate } = data;
  const title = `${rate.brand} ${type.name} Price in Pakistan | ${site}`;
  const description = `Today's ${rate.brand} ${type.name.toLowerCase()} price is Rs ${Number(rate.price).toLocaleString('en-PK')}${rate.unit ? ` ${String(rate.unit).toLowerCase()}` : ''}. Check the latest rate and order online.`;
  return { title, description, alternates: { canonical: `/${slug}/${item}` }, openGraph: { title, description, type: 'website' } };
}

export default async function CustomMaterialItemPage({ params }: Props) {
  const { slug, item } = await params;
  const data = await load(slug, item);
  if (!data) notFound();
  return <MaterialDetailClient rate={data.rate} materialType={data.type.slug} />;
}

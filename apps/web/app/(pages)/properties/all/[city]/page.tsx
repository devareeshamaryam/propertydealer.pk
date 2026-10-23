import type { Metadata } from 'next';
import { CityArchive, cityMetadata } from './city-archive';

/*
 * Rendered on first visit, then served from cache; refreshed every 5 minutes
 * and as soon as a listing changes. "?type=" versions are rewritten to
 * ./by-type/[type] (next.config), so this page never reads the query string.
 */
export const revalidate = 300;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ city: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return cityMetadata((await params).city, '');
}

export default async function AllCityPage({ params }: Props) {
  return <CityArchive city={(await params).city} type="" />;
}

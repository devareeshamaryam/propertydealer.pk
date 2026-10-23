import type { Metadata } from 'next';
import { CityArchive, cityMetadata } from '../../city-archive';

/*
 * /properties/all/<city>?type=<type>, rewritten here (next.config) so it is
 * cached per city and type like every other archive page. Its canonical is
 * the "?type=" address, which is the one in links and search results.
 */
export const revalidate = 300;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ city: string; type: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city, type } = await params;
  return cityMetadata(city, decodeURIComponent(type));
}

export default async function CityTypePage({ params }: Props) {
  const { city, type } = await params;
  return <CityArchive city={city} type={decodeURIComponent(type)} />;
}

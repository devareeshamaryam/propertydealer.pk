import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SocietyGuideView from '@/components/societies/SocietyGuideView';
import { fetchInitialListings } from '@/lib/server-api';
import { getSocietyMap } from '@/lib/society-map';
import { getSocietyPage, guideFaqs, pkPrice } from '@/lib/societies';
import { toTitleCase } from '@/lib/utils';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealer.pk';

/* Rendered on first visit, then cached; refreshed when the guide or its listings change. */
export const revalidate = 600;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

type Params = { params: Promise<{ city: string; slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { city, slug } = await params;
  const s = await getSocietyPage(city, slug).catch(() => null);
  if (!s) return {};
  const name = `${toTitleCase(s.name)} ${s.city.name}`;
  const from = s.stats.house?.min || s.stats.plot?.min;
  const title = s.guide.metaTitle?.trim() || `${name} — Prices, Map, Phases & Guide ${new Date().getFullYear()}`;
  const description =
    s.guide.metaDescription?.trim() ||
    `${name}: ${s.guide.tagline ? `${s.guide.tagline}. ` : ''}House and plot prices${from ? ` from PKR ${pkPrice(from)}` : ''}, ${
      s.phases.length ? `${s.phases.length} phases, ` : ''
    }map, amenities and ${s.stats.sale + s.stats.rent} properties for sale and rent.`;
  const url = `${BASE_URL}/societies/${s.city.slug}/${s.slug}`;
  const image = s.guide.image || s.map?.thumb;
  const abs = image ? (image.startsWith('http') ? image : `${BASE_URL}${image}`) : undefined;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website', ...(abs ? { images: [{ url: abs }] } : {}) },
    twitter: { card: 'summary_large_image', title, description, ...(abs ? { images: [abs] } : {}) },
  };
}

export default async function SocietyGuidePage({ params }: Params) {
  const { city, slug } = await params;
  const s = await getSocietyPage(city, slug);
  if (!s) notFound();

  const [map, listings] = await Promise.all([
    s.map ? getSocietyMap(s.map.citySlug, s.map.slug).catch(() => null) : Promise.resolve(null),
    fetchInitialListings({ purpose: 'all', cityId: s.city._id, areaId: s._id }).catch(() => ({ properties: [] })),
  ]);

  const name = `${toTitleCase(s.name)} ${s.city.name}`;
  const url = `${BASE_URL}/societies/${s.city.slug}/${s.slug}`;
  const image = s.guide.image ? (s.guide.image.startsWith('http') ? s.guide.image : `${BASE_URL}${s.guide.image}`) : undefined;
  const schema = [
    {
      '@context': 'https://schema.org',
      '@type': 'Place',
      name,
      description: s.guide.tagline || undefined,
      url,
      image,
      address: { '@type': 'PostalAddress', addressLocality: s.city.name, addressCountry: 'PK', streetAddress: s.guide.address || undefined },
      ...(s.lat && s.lng ? { geo: { '@type': 'GeoCoordinates', latitude: s.lat, longitude: s.lng } } : {}),
      ...(s.guide.amenities?.length
        ? { amenityFeature: s.guide.amenities.map((a) => ({ '@type': 'LocationFeatureSpecification', name: a, value: true })) }
        : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE_URL}/` },
        { '@type': 'ListItem', position: 2, name: 'Societies', item: `${BASE_URL}/societies` },
        { '@type': 'ListItem', position: 3, name: s.city.name, item: `${BASE_URL}/societies/${s.city.slug}` },
        { '@type': 'ListItem', position: 4, name: toTitleCase(s.name), item: url },
      ],
    },
    ...(guideFaqs(s).length
      ? [
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: guideFaqs(s).map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
          },
        ]
      : []),
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <SocietyGuideView s={s} map={map} listings={listings.properties.slice(0, 6)} />
    </>
  );
}

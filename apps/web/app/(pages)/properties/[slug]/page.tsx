 import PropertyDetail from '@/components/PropertyDetail';
import Breadcrumbs from '@/components/Breadcrumbs';
import { serverApi, isNotFoundError } from '@/lib/server-api';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { toTitleCase } from '@/lib/utils';
import { buildPropertySchema, buildBreadcrumbSchema } from '@/lib/schema/listing-schema';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealer.pk';

type PageProps = {
  params: Promise<{ slug: string }>;
};

/*
 * Rendered once, then served from cache and refreshed every 5 minutes — or at
 * once when the listing changes (the API revalidates its tags). Listings are
 * not pre-built at deploy; each one is made on its first visit.
 */
export const revalidate = 300;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

const slugify = (s: string) => String(s ?? '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** The listing, or a 404 for a slug that does not exist. An API that is down throws (the cached page stays). */
async function getProperty(slug: string) {
  try {
    const property = await serverApi.getPropertyBySlug(slug);
    if (!property) notFound();
    return property;
  } catch (error) {
    if (isNotFoundError(error)) notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const property = await getProperty(slug);

  const title = property.title;
  // Plain text for the snippet: descriptions can carry HTML and line breaks.
  const description =
    String(property.description ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160) ||
    `View details for property: ${property.title}`;
  const imageUrl = property.mainPhotoUrl || '/og-image.jpg';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/properties/${property.slug || slug}`,
      images: [{ url: imageUrl }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
    alternates: {
      canonical: `/properties/${property.slug || slug}`,
    },
  };
}

export default async function PropertyDetailPage({ params }: PageProps) {
  const { slug } = await params;

  const property: any = await getProperty(slug);

  let propertySchema = null;
  let breadcrumbSchema = null;
  let breadcrumbItems: Array<{ name: string; url: string }> = [];

  if (property) {
    const areaObj = typeof property.area === 'object' ? property.area : null;
    const areaName = areaObj?.name;
    const areaSlug = areaObj?.areaSlug;
    const cityName = areaObj?.city?.name || property.city;
    // Cities have no slug field: the archive URLs use the name, lower-cased and hyphenated.
    const citySlug = cityName ? slugify(cityName) : '';
    const isSale = property.listingType === 'sale';
    const purposePath = isSale ? 'sale' : 'rent';

    propertySchema = buildPropertySchema({
      id: property._id,
      slug: property.slug,
      title: property.title,
      description: property.description,
      propertyType: property.propertyType,
      listingType: property.listingType,
      price: property.price,
      location: property.location,
      city: cityName,
      areaName,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      areaSize: property.areaSize,
      marla: property.marla,
      mainPhotoUrl: property.mainPhotoUrl,
      additionalPhotosUrls: property.additionalPhotosUrls,
      latitude: property.latitude,
      longitude: property.longitude,
      createdAt: property.createdAt,
      features: property.features,
    });

    const crumbs: Array<{ name: string; url: string }> = [
      { name: 'Home', url: BASE_URL },
      { name: `Properties for ${isSale ? 'Sale' : 'Rent'}`, url: `${BASE_URL}/properties/${purposePath}` },
    ];
    if (citySlug && cityName) {
      crumbs.push({ name: toTitleCase(cityName), url: `${BASE_URL}/properties/${purposePath}/${citySlug}` });
    }
    if (citySlug && areaSlug && areaName) {
      crumbs.push({ name: toTitleCase(areaName), url: `${BASE_URL}/properties/${purposePath}/${citySlug}/${areaSlug}` });
    }
    crumbs.push({ name: property.title, url: `${BASE_URL}/properties/${slug}` });

    breadcrumbSchema = buildBreadcrumbSchema(crumbs);
    breadcrumbItems = crumbs;
  }

  return (
    <>
      {propertySchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(propertySchema) }}
        />
      )}
      {breadcrumbSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        />
      )}

      {/* Breadcrumbs: sirf desktop pe show karo, mobile pe hidden */}
      {breadcrumbItems.length > 0 && (
        <div className="hidden md:block container mx-auto px-4 pt-3 pb-0">
          <Breadcrumbs items={breadcrumbItems} />
        </div>
      )}

      {/* PropertyDetail apni spacing khud handle karta hai */}
      <PropertyDetail slug={slug} initialProperty={property} />
    </>
  );
}
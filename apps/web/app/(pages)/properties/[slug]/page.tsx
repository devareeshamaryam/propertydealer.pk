 import PropertyDetail from '@/components/PropertyDetail';
import Breadcrumbs from '@/components/Breadcrumbs';
import { serverApi } from '@/lib/server-api';
import { Metadata } from 'next';
import { toTitleCase } from '@/lib/utils';
import { buildPropertySchema, buildBreadcrumbSchema } from '@/lib/schema/listing-schema';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealer.pk';

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const property = await serverApi.getPropertyBySlug(slug);

    if (!property) {
      return {
        title: 'Property Not Found',
        description: 'The requested property could not be found.',
      };
    }

    const title = property.title;
    const description = property.description?.substring(0, 160) || `View details for property: ${property.title}`;
    const imageUrl = property.mainPhotoUrl || '/og-image.jpg';

    return {
      title,
      description,
      openGraph: {
        title,
        description,
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
        canonical: `/properties/${slug}`,
      },
    };
  } catch (error) {
    console.error('Error generating metadata for property:', error);
    return {
      title: 'Property Details',
      description: 'View property details on Property Dealer',
    };
  }
}

export default async function PropertyDetailPage({ params }: PageProps) {
  const { slug } = await params;

  let property: any = null;
  try {
    property = await serverApi.getPropertyBySlug(slug);
  } catch (error) {
    console.error('Error fetching property for page:', error);
  }

  let propertySchema = null;
  let breadcrumbSchema = null;
  let breadcrumbItems: Array<{ name: string; url: string }> = [];

  if (property) {
    const areaObj = typeof property.area === 'object' ? property.area : null;
    const areaName = areaObj?.name;
    const areaSlug = areaObj?.areaSlug;
    const cityName = areaObj?.city?.name || property.city;
    const citySlug = areaObj?.city?.areaSlug;
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
        <div className="hidden md:block container mx-auto px-4 pt-24 pb-0">
          <Breadcrumbs items={breadcrumbItems} />
        </div>
      )}

      {/* PropertyDetail apni spacing khud handle karta hai */}
      <PropertyDetail slug={slug} initialProperty={property} />
    </>
  );
}
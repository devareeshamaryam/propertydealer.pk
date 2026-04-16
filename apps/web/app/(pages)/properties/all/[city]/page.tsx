import PropertiesListing from '@/components/PropertiesListing';
import { Suspense } from 'react';
import { Metadata, ResolvingMetadata } from 'next';
import { serverApi } from '@/lib/server-api';
import { toTitleCase } from '@/lib/utils';
import { buildCollectionPageSchema } from '@/lib/schema/listing-schema';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealer.pk';

interface PageProps {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata(
  props: PageProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { city: citySlug } = await props.params;
  const searchParams = await props.searchParams;
  const type = (searchParams.type as string) || '';

  try {
    const cityData = await serverApi.getCityByName(citySlug);
    const purpose = 'Rent & Sale';
    if (!cityData) return { title: `Properties in ${toTitleCase(citySlug)}` };
    const cityName = toTitleCase(cityData.name);
    const typeName = type && type !== 'all'
      ? (type.toLowerCase() === 'house' ? 'Property' : toTitleCase(type))
      : 'Properties';

    // If type is and no custom meta, auto-generate
    if (type && type !== 'all') {
      const specificContent = cityData.typeContents?.find(
        (tc: any) => tc.propertyType.toLowerCase() === type.toLowerCase() && tc.purpose === 'all'
      );
      if (specificContent?.metaTitle) return {
        title: specificContent.metaTitle,
        description: specificContent.metaDescription,
        alternates: { canonical: `/properties/all/${citySlug.toLowerCase()}?type=${type.toLowerCase()}` }
      };

      return {
        title: `${typeName} for ${purpose} in ${cityName}`,
        description: `Explore ${typeName.toLowerCase()} for ${purpose.toLowerCase()} in ${cityName}. Find your dream home with Property Dealer.`,
        alternates: { canonical: `/properties/all/${citySlug.toLowerCase()}?type=${type.toLowerCase()}` },
      };
    }

    return {
      title: cityData.metaTitle || `Properties for ${purpose} in ${cityName}`,
      description: cityData.metaDescription || `Explore all properties for ${purpose.toLowerCase()} in ${cityName}. Find your dream home with Property Dealer.`,
      alternates: { canonical: `/properties/all/${citySlug.toLowerCase()}` },
    };
  } catch {
    return { title: `Properties in ${toTitleCase(citySlug)}` };
  }
}

export default async function AllCityPage(props: PageProps) {
  const { city } = await props.params;
  const searchParams = await props.searchParams;
  const type = (searchParams.type as string) || '';
  let cityDetails: any = null;

  try {
    cityDetails = await serverApi.getCityByName(city);
  } catch (error) {
    console.error('Error fetching city details:', error);
  }

  const cityName = cityDetails ? toTitleCase(cityDetails.name) : toTitleCase(city);
  const typeName = type && type !== 'all'
    ? (type.toLowerCase() === 'house' ? 'Property' : toTitleCase(type))
    : 'Properties';
  const pageUrl = `${BASE_URL}/properties/all/${city}${type && type !== 'all' ? `?type=${type}` : ''}`;

  let pageTitle = cityDetails?.metaTitle || `Properties for Rent & Sale in ${cityName}`;
  let richDescription = cityDetails?.description;

  if (type && type !== 'all') {
    const specificContent = cityDetails?.typeContents?.find(
      (tc: any) => tc.propertyType.toLowerCase() === type.toLowerCase() && tc.purpose === 'all'
    );
    if (specificContent?.metaTitle) pageTitle = specificContent.metaTitle;
    else pageTitle = `${typeName} for Rent & Sale in ${cityName}`;

    if (specificContent?.content) richDescription = specificContent.content;
  }

  // Fetch top properties for schema
  let schemaProperties: any[] = [];
  try {
    const res = await serverApi.getProperties(`city=${city}&limit=20&page=1`);
    const rawProps: any[] = Array.isArray(res) ? res : (res as any).properties || [];
    schemaProperties = rawProps.map((p: any) => ({
      id: p._id, slug: p.slug, name: p.title, type: p.propertyType,
      price: p.price, purpose: p.listingType,
      city: typeof p.area === 'object' ? p.area?.city?.name || city : city,
      location: p.location, bedrooms: p.bedrooms, bathrooms: p.bathrooms,
      area: p.areaSize, image: p.mainPhotoUrl, createdAt: p.createdAt,
    }));
  } catch { /* non-critical */ }

  const collectionSchema = buildCollectionPageSchema({
    url: pageUrl,
    title: pageTitle,
    cityName,
    properties: schemaProperties.map(p => ({
      title: p.name,
      url: `${BASE_URL}/p/${p.slug || p.id}`
    })),
    totalItems: schemaProperties.length,
    crumbs: [
      { name: 'Home', url: BASE_URL },
      { name: 'Properties', url: `${BASE_URL}/properties/all` },
      { name: cityName, url: pageUrl },
    ]
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }} />
      <Suspense fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      }>
        <PropertiesListing
          purpose="all"
          city={city}
          type={type || 'all'}
          useCleanUrls={true}
          richDescription={richDescription}
        />
      </Suspense>
    </>
  );
}

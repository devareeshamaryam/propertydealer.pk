import PropertiesListing from '@/components/PropertiesListing';
import { CityAgenciesBox, CityExtras } from '@/components/societies/ArchiveBoxes';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { serverApi, fetchInitialListings } from '@/lib/server-api';
import { toTitleCase } from '@/lib/utils';
import { buildCollectionPageSchema } from '@/lib/schema/listing-schema';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealer.pk';

// Agar city segment mein yeh values aayein tou yeh misrouted URL hai
const PROPERTY_TYPES = ['house', 'plot', 'apartment', 'commercial', 'flat', 'room'];

/*
 * A city's archive: /properties/all/<city>, and the same filtered by type
 * (/properties/all/<city>?type=house — rewritten in next.config to the
 * by-type route, so the plain city page needs no query string and can be
 * served from cache).
 */

export async function cityMetadata(citySlug: string, type: string): Promise<Metadata> {
  // Bad URL — property type city segment mein aa gaya
  if (PROPERTY_TYPES.includes(citySlug.toLowerCase())) {
    return { title: 'Not Found' };
  }

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

export async function CityArchive({ city, type }: { city: string; type: string }) {
  // Bad URL — property type city segment mein aa gaya, 404 dikhao
  if (PROPERTY_TYPES.includes(city.toLowerCase())) {
    notFound();
  }

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

  // Page one of the list, rendered with the HTML (see fetchInitialListings).
  const initial = await fetchInitialListings({
    purpose: 'all',
    cityId: cityDetails?._id,
    cityName: city,
    type: type || 'all',
  });
  const schemaProperties = initial.raw.map((p: any) => ({ id: p._id, slug: p.slug, name: p.title }));

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
          initialProperties={initial.properties}
          initialTotalPages={initial.totalPages}
          cityId={cityDetails?._id}
          city={city}
          type={type || 'all'}
          useCleanUrls={true}
          richDescription={richDescription}
          sidebar={cityDetails ? <CityAgenciesBox cityId={cityDetails._id} cityName={cityName} /> : undefined}
          extras={cityDetails ? <CityExtras citySlug={city} cityId={cityDetails._id} cityName={cityName} /> : undefined}
        />
      </Suspense>
    </>
  );
}
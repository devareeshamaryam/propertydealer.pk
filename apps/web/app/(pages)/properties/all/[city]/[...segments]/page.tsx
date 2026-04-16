import PropertiesListing from '@/components/PropertiesListing';
import { Suspense } from 'react';
import { Metadata, ResolvingMetadata } from 'next';
import { serverApi } from '@/lib/server-api';
import { toTitleCase } from '@/lib/utils';
import { buildCollectionPageSchema } from '@/lib/schema/listing-schema';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealer.pk';

interface PageProps {
  params: Promise<{
    city: string;
    segments: string[]; // catch-all: ['type'] | ['area'] | ['area', 'type']
  }>;
}

async function resolveSegments(citySlug: string, segments: string[]) {
  try {
    const cityData = await serverApi.getCityByName(citySlug);
    if (!cityData) return { cityData: null, areaData: null, propertyType: null, areaSlug: null };

    const propertyTypes = await serverApi.getTypes();

    if (segments.length === 1) {
      const seg = segments[0] as string;
      const matchedType = propertyTypes.find(t => t.toLowerCase() === seg.toLowerCase());

      if (matchedType) {
        return { cityData, areaData: null, propertyType: matchedType, areaSlug: null };
      }

      try {
        const areaData = await serverApi.getAreaBySlug(seg, cityData._id);
        return { cityData, areaData, propertyType: null, areaSlug: seg };
      } catch {
        return { cityData, areaData: null, propertyType: null, areaSlug: null };
      }
    }

    if (segments.length >= 2) {
      const areaSeg = segments[0] as string;
      const typeSeg = segments[1] as string;
      const matchedType = propertyTypes.find(t => t.toLowerCase() === typeSeg.toLowerCase()) || null;

      try {
        const areaData = await serverApi.getAreaBySlug(areaSeg, cityData._id);
        return { cityData, areaData, propertyType: matchedType, areaSlug: areaSeg };
      } catch {
        return { cityData, areaData: null, propertyType: matchedType, areaSlug: areaSeg };
      }
    }

    return { cityData, areaData: null, propertyType: null, areaSlug: null };
  } catch (error) {
    console.error('Error resolving segments:', error);
    return { cityData: null, areaData: null, propertyType: null, areaSlug: null };
  }
}

export async function generateMetadata(
  props: PageProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { city: citySlug, segments } = await props.params;
  const { cityData, areaData, propertyType } = await resolveSegments(citySlug, segments);

  const purpose = 'Rent & Sale';
  const cityName = cityData ? toTitleCase(cityData.name) : toTitleCase(citySlug);

  // Helper: find typeContent matching type for 'all' purpose
  const findTypeContent = (type: string) =>
    cityData?.typeContents?.find(
      (tc: any) => tc.propertyType.toLowerCase() === type.toLowerCase() && tc.purpose === 'all'
    ) || null;

  if (areaData && propertyType) {
    // area + type → area's meta first, then auto-generated
    const areaName = toTitleCase(areaData.name);
    const typeName = propertyType.toLowerCase() === 'house' ? 'Property' : toTitleCase(propertyType);
    return {
      title: areaData.metaTitle || `${typeName} for ${purpose} in ${areaName}, ${cityName}`,
      description: areaData.metaDescription || `Find ${typeName.toLowerCase()} for ${purpose.toLowerCase()} in ${areaName}, ${cityName}. Browse verified listings on Property Dealer.`,
      alternates: { canonical: `/properties/all/${citySlug}/${segments.join('/')}` },
    };
  }

  if (areaData) {
    const areaName = toTitleCase(areaData.name);
    // For 'all' purpose, prefer general metaTitle, fallback to auto-generated
    return {
      title: areaData.metaTitle || `Properties in ${areaName}, ${cityName}`,
      description: areaData.metaDescription || `Discover properties in ${areaName}, ${cityName}. View photos, prices, and details on Property Dealer.`,
      alternates: { canonical: areaData.canonicalUrl || `/properties/all/${citySlug}/${segments[0]}` },
    };
  }

  if (propertyType) {
    const typeName = propertyType.toLowerCase() === 'house' ? 'Property' : toTitleCase(propertyType);
    const tc = findTypeContent(propertyType);
    // Use custom meta if set, otherwise auto-generate
    const titleText = tc?.metaTitle?.trim() || `${typeName} for ${purpose} in ${cityName}`;
    const descText = tc?.metaDescription?.trim() || `Find the best ${propertyType.toLowerCase()} for ${purpose.toLowerCase()} in ${cityName}. Browse verified listings on Property Dealer.`;
    return {
      title: titleText,
      description: descText,
      alternates: { canonical: `/properties/all/${citySlug}/${segments[0]}` },
    };
  }

  return { title: `Properties in ${cityName}` };
}

export default async function AllCitySegmentsPage(props: PageProps) {
  const { city, segments } = await props.params;
  const { cityData, areaData, propertyType, areaSlug } = await resolveSegments(city, segments);

  if (!cityData) console.error(`City ${city} not found`);

  const listingType = propertyType || 'all';
  const areaId = areaData?._id;

  // Find typeContent: match by type name + 'all' purpose
  const specificContent = propertyType && !areaData
    ? cityData?.typeContents?.find(
      (tc: any) =>
        tc.propertyType.toLowerCase() === propertyType.toLowerCase() &&
        tc.purpose === 'all'
    ) || null
    : null;

  // richDescription rules:
  // - area+type page  → nothing (no content shown)
  // - area-only page  → areaData.description (if set)
  // - type-only page  → specificContent.content ONLY if explicitly set by admin (no city fallback)
  // - city-only page  → city description (handled by [city]/page.tsx, not here)
  const richDescription = areaData && propertyType
    ? undefined
    : areaData
      ? (areaData.description || undefined)
      : (specificContent?.content?.trim() ? specificContent.content : undefined);

  // --- Schema.org ---
  const cityName = cityData ? toTitleCase(cityData.name) : toTitleCase(city);
  const areaName = areaData ? toTitleCase(areaData.name) : null;
  const typeName = propertyType ? (propertyType.toLowerCase() === 'house' ? 'Property' : toTitleCase(propertyType)) : null;
  const pageUrl = `${BASE_URL}/properties/all/${city}/${segments.join('/')}`;
  const pageTitle = [
    typeName ? (typeName === 'Property' ? 'Property' : `${typeName}s`) : 'Properties',
    'for Rent & Sale',
    areaName ? `in ${areaName}, ${cityName}` : `in ${cityName}`,
  ].join(' ');

  // Fetch a small set of properties server-side for schema (limit 20)
  let schemaProperties: any[] = [];
  try {
    const params: Record<string, string> = { city, limit: '20', page: '1' };
    if (areaId) params.areaId = areaId;
    if (listingType !== 'all') params.type = listingType;
    const qs = new URLSearchParams(params).toString();
    const res = await serverApi.getProperties(qs);
    const rawProps: any[] = Array.isArray(res) ? res : (res as any).properties || [];
    schemaProperties = rawProps.map((p: any) => ({
      id: p._id,
      slug: p.slug,
      name: p.title,
    }));
  } catch {
    // Schema is non-critical — fail silently
  }

  // Breadcrumb
  const breadcrumbs = [
    { name: 'Home', url: `${BASE_URL}/` },
    { name: 'Properties', url: `${BASE_URL}/properties/all` },
    { name: cityName, url: `${BASE_URL}/properties/all/${city}` },
    ...(areaName ? [{ name: areaName, url: `${BASE_URL}/properties/all/${city}/${areaSlug}` }] : []),
    ...(typeName && areaName
      ? [{ name: typeName === 'Property' ? 'Property' : `${typeName}s`, url: `${BASE_URL}/properties/all/${city}/${areaSlug}/${segments[1]}` }]
      : typeName
        ? [{ name: typeName === 'Property' ? 'Property' : `${typeName}s`, url: `${BASE_URL}/properties/all/${city}/${segments[0]}` }]
        : []),
  ];

  const collectionSchema = buildCollectionPageSchema({
    url: pageUrl,
    title: pageTitle,
    cityName,
    properties: schemaProperties.map(p => ({
      title: p.name,
      url: `${BASE_URL}/p/${p.slug || p.id}`
    })),
    totalItems: schemaProperties.length,
    crumbs: breadcrumbs
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />
      <Suspense fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      }>
        <PropertiesListing
          purpose="all"
          city={city}
          type={listingType}
          areaId={areaId}
          areaSlug={areaSlug || undefined}
          useCleanUrls={true}
          richDescription={richDescription}
        />
      </Suspense>
    </>
  );
}

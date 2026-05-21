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
    segments: string[]; // catch-all: ['type'] | ['area'] | ['area', 'type'] | ['type', '2marla'] etc.
  }>;
}

// ── Marla slug parser ────────────────────────────────────────────────────────
// '2marla' → 2, '10marla' → 10, '1kanal' → 20, anything else → null
function parseMarlaSlug(seg: string): number | null {
  const marlaMatch = seg.match(/^(\d+)marla$/i);
  if (marlaMatch) return parseInt(marlaMatch[1]!, 10);
  if (seg.toLowerCase() === '1kanal') return 20;
  return null;
}
// ────────────────────────────────────────────────────────────────────────────

async function resolveSegments(citySlug: string, segments: string[]) {
  try {
    const cityData = await serverApi.getCityByName(citySlug);
    if (!cityData) return { cityData: null, areaData: null, propertyType: null, areaSlug: null, marla: null };

    const propertyTypes = await serverApi.getTypes();

    // Marla segment pehle nikalo — baaki segments pe normal logic chalao
    const marlaSegIdx = segments.findIndex(s => parseMarlaSlug(s) !== null);
    const marla = marlaSegIdx >= 0 ? parseMarlaSlug(segments[marlaSegIdx]!) : null;
    const cleanSegments = segments.filter((_, i) => i !== marlaSegIdx);

    if (cleanSegments.length === 0) {
      // Sirf marla tha — city only page
      return { cityData, areaData: null, propertyType: null, areaSlug: null, marla };
    }

    if (cleanSegments.length === 1) {
      const seg = cleanSegments[0] as string;
      const matchedType = propertyTypes.find(t => t.toLowerCase() === seg.toLowerCase());

      if (matchedType) {
        return { cityData, areaData: null, propertyType: matchedType, areaSlug: null, marla };
      }

      try {
        const areaData = await serverApi.getAreaBySlug(seg, cityData._id);
        return { cityData, areaData, propertyType: null, areaSlug: seg, marla };
      } catch {
        return { cityData, areaData: null, propertyType: null, areaSlug: null, marla };
      }
    }

    if (cleanSegments.length >= 2) {
      const areaSeg = cleanSegments[0] as string;
      const typeSeg = cleanSegments[1] as string;
      const matchedType = propertyTypes.find(t => t.toLowerCase() === typeSeg.toLowerCase()) || null;

      try {
        const areaData = await serverApi.getAreaBySlug(areaSeg, cityData._id);
        return { cityData, areaData, propertyType: matchedType, areaSlug: areaSeg, marla };
      } catch {
        return { cityData, areaData: null, propertyType: matchedType, areaSlug: areaSeg, marla };
      }
    }

    return { cityData, areaData: null, propertyType: null, areaSlug: null, marla };
  } catch (error) {
    console.error('Error resolving segments:', error);
    return { cityData: null, areaData: null, propertyType: null, areaSlug: null, marla: null };
  }
}

export async function generateMetadata(
  props: PageProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { city: citySlug, segments } = await props.params;
  const { cityData, areaData, propertyType, marla } = await resolveSegments(citySlug, segments);

  const purpose = 'Rent & Sale';
  const cityName = cityData ? toTitleCase(cityData.name) : toTitleCase(citySlug);

  const findTypeContent = (type: string) =>
    cityData?.typeContents?.find(
      (tc: any) => tc.propertyType.toLowerCase() === type.toLowerCase() && tc.purpose === 'all'
    ) || null;

  if (areaData && propertyType) {
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
    return {
      title: areaData.metaTitle || `Properties in ${areaName}, ${cityName}`,
      description: areaData.metaDescription || `Discover properties in ${areaName}, ${cityName}. View photos, prices, and details on Property Dealer.`,
      alternates: { canonical: areaData.canonicalUrl || `/properties/all/${citySlug}/${segments[0]}` },
    };
  }

  if (propertyType) {
    const tc = findTypeContent(propertyType);
    // Type plural: Houses, Plots, Apartments etc.
    const typePlural = propertyType.toLowerCase() === 'house'
      ? 'Houses'
      : propertyType.toLowerCase() === 'plot'
        ? 'Plots'
        : `${toTitleCase(propertyType)}s`;
    // Marla prefix: "3 Marla " or "1 Kanal " or ""
    const marlaPrefix = marla
      ? (marla === 20 ? '1 Kanal ' : `${marla} Marla `)
      : '';
    // Purpose suffix: "For Sale" | "For Rent" | "For Rent & Sale"
    const purposeSuffix = 'For Rent & Sale';
    // Final: "3 Marla Houses For Rent & Sale in Lahore"
    const autoTitle = `${marlaPrefix}${typePlural} ${purposeSuffix} in ${cityName}`;
    const autoDesc  = `Find ${marlaPrefix.toLowerCase()}${typePlural.toLowerCase()} for rent & sale in ${cityName}. Browse verified listings on Property Dealer.`;
    return {
      title: tc?.metaTitle?.trim() || autoTitle,
      description: tc?.metaDescription?.trim() || autoDesc,
      alternates: { canonical: `/properties/all/${citySlug}/${segments.join('/')}` },
    };
  }

  return { title: `Properties in ${cityName}` };
}

export default async function AllCitySegmentsPage(props: PageProps) {
  const { city, segments } = await props.params;
  const { cityData, areaData, propertyType, areaSlug, marla } = await resolveSegments(city, segments);

  if (!cityData) console.error(`City ${city} not found`);

  const listingType = propertyType || 'all';
  const areaId = areaData?._id;

  const specificContent = propertyType && !areaData
    ? cityData?.typeContents?.find(
      (tc: any) =>
        tc.propertyType.toLowerCase() === propertyType.toLowerCase() &&
        tc.purpose === 'all'
    ) || null
    : null;

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

  let schemaProperties: any[] = [];
  try {
    const params: Record<string, string> = { city, limit: '20', page: '1' };
    if (areaId) params.areaId = areaId;
    if (listingType !== 'all') params.type = listingType;
    if (marla) { params.marlaMin = String(marla); params.marlaMax = String(marla); }
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
          initialMarla={marla ?? undefined}
        />
      </Suspense>
    </>
  );
}
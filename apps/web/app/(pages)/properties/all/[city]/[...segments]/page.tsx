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
    segments: string[];
  }>;
}

function parseMarlaSlug(seg: string): number | null {
  const marlaMatch = seg.match(/^(\d+)marla$/i);
  if (marlaMatch) return parseInt(marlaMatch[1]!, 10);
  if (seg.toLowerCase() === '1kanal') return 20;
  return null;
}

function toSizeSlug(marla: number): string {
  return marla === 20 ? '1kanal' : `${marla}marla`;
}

function findSizeEntry(cityData: any, marla: number, purposes: string[]) {
  const slug = toSizeSlug(marla);
  for (const p of purposes) {
    const entry = cityData?.sizeContents?.find(
      (s: any) => s.size === slug && s.purpose === p
    );
    if (entry) return entry;
  }
  return null;
}

// 🆕 Area ke sizeContents mein se match dhoondhna
function findAreaSizeEntry(areaData: any, marla: number, purposes: string[]) {
  const slug = toSizeSlug(marla);
  for (const p of purposes) {
    const entry = areaData?.sizeContents?.find(
      (s: any) => s.size === slug && s.purpose === p
    );
    if (entry) return entry;
  }
  return null;
}

async function resolveSegments(citySlug: string, segments: string[]) {
  try {
    const cityData = await serverApi.getCityByName(citySlug);
    if (!cityData) return { cityData: null, areaData: null, propertyType: null, areaSlug: null, marla: null };

    const propertyTypes = await serverApi.getTypes();

    const marlaSegIdx = segments.findIndex(s => parseMarlaSlug(s) !== null);
    const marla = marlaSegIdx >= 0 ? parseMarlaSlug(segments[marlaSegIdx]!) : null;
    const cleanSegments = segments.filter((_, i) => i !== marlaSegIdx);

    if (cleanSegments.length === 0) {
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

  const purpose  = 'Rent & Sale';
  const cityName = cityData ? toTitleCase(cityData.name) : toTitleCase(citySlug);

  if (areaData) {
    // 🆕 area + marla size meta (highest priority)
    if (marla) {
      const areaSizeEntry = findAreaSizeEntry(areaData, marla, ['all', 'rent', 'sale']);
      if (areaSizeEntry?.metaTitle?.trim()) {
        return {
          title: areaSizeEntry.metaTitle,
          description: areaSizeEntry.metaDescription || undefined,
          alternates: { canonical: `/properties/all/${citySlug}/${segments.join('/')}` },
        };
      }
    }

    if (propertyType) {
      const areaName = toTitleCase(areaData.name);
      const typeName = propertyType.toLowerCase() === 'house' ? 'Property' : toTitleCase(propertyType);
      return {
        title: areaData.metaTitle || `${typeName} for ${purpose} in ${areaName}, ${cityName}`,
        description: areaData.metaDescription || `Find ${typeName.toLowerCase()} for ${purpose.toLowerCase()} in ${areaName}, ${cityName}. Browse verified listings on Property Dealer.`,
        alternates: { canonical: `/properties/all/${citySlug}/${segments.join('/')}` },
      };
    }

    const areaName = toTitleCase(areaData.name);
    return {
      title: areaData.metaTitle || `Properties in ${areaName}, ${cityName}`,
      description: areaData.metaDescription || `Discover properties in ${areaName}, ${cityName}. View photos, prices, and details on Property Dealer.`,
      alternates: { canonical: areaData.canonicalUrl || `/properties/all/${citySlug}/${segments[0]}` },
    };
  }

  if (cityData) {
    if (marla && propertyType) {
      const sizeEntry = findSizeEntry(cityData, marla, ['all', 'rent', 'sale']);
      if (sizeEntry?.metaTitle?.trim()) {
        return {
          title: sizeEntry.metaTitle,
          description: sizeEntry.metaDescription || undefined,
          alternates: { canonical: `/properties/all/${citySlug}/${segments.join('/')}` },
        };
      }
    }

    if (propertyType) {
      const tc = cityData?.typeContents?.find(
        (tc: any) => tc.propertyType.toLowerCase() === propertyType.toLowerCase() && tc.purpose === 'all'
      ) || null;
      const typePlural = propertyType.toLowerCase() === 'house'
        ? 'Houses'
        : propertyType.toLowerCase() === 'plot'
          ? 'Plots'
          : `${toTitleCase(propertyType)}s`;
      const marlaPrefix = marla ? (marla === 20 ? '1 Kanal ' : `${marla} Marla `) : '';
      const autoTitle   = `${marlaPrefix}${typePlural} For Rent & Sale in ${cityName}`;
      const autoDesc    = `Find ${marlaPrefix.toLowerCase()}${typePlural.toLowerCase()} for rent & sale in ${cityName}. Browse verified listings on Property Dealer.`;
      return {
        title: tc?.metaTitle?.trim() || autoTitle,
        description: tc?.metaDescription?.trim() || autoDesc,
        alternates: { canonical: `/properties/all/${citySlug}/${segments.join('/')}` },
      };
    }
  }

  return { title: `Properties in ${cityName}` };
}

export default async function AllCitySegmentsPage(props: PageProps) {
  const { city, segments } = await props.params;
  const { cityData, areaData, propertyType, areaSlug, marla } = await resolveSegments(city, segments);

  if (!cityData) console.error(`City ${city} not found`);

  const listingType = propertyType || 'all';
  const areaId      = areaData?._id;

  const specificContent = propertyType && !areaData
    ? cityData?.typeContents?.find(
        (tc: any) =>
          tc.propertyType.toLowerCase() === propertyType.toLowerCase() &&
          tc.purpose === 'all'
      ) || null
    : null;

  const sizeEntry = marla && propertyType && cityData && !areaData
    ? findSizeEntry(cityData, marla, ['all', 'rent', 'sale'])
    : null;

  // 🆕 area + marla size content (highest priority)
  const areaSizeEntry = marla && areaData
    ? findAreaSizeEntry(areaData, marla, ['all', 'rent', 'sale'])
    : null;

  const richDescription = areaSizeEntry?.content?.trim()
    ? areaSizeEntry.content
    : areaData && propertyType
      ? undefined
      : areaData
        ? (areaData.description || undefined)
        : sizeEntry?.content?.trim()
          ? sizeEntry.content
          : (specificContent?.content?.trim() ? specificContent.content : undefined);

  const cityName  = cityData ? toTitleCase(cityData.name) : toTitleCase(city);
  const areaName  = areaData ? toTitleCase(areaData.name) : null;
  const typeName  = propertyType ? (propertyType.toLowerCase() === 'house' ? 'Property' : toTitleCase(propertyType)) : null;
  const pageUrl   = `${BASE_URL}/properties/all/${city}/${segments.join('/')}`;
  const pageTitle = [
    typeName ? (typeName === 'Property' ? 'Property' : `${typeName}s`) : 'Properties',
    'for Rent & Sale',
    areaName ? `in ${areaName}, ${cityName}` : `in ${cityName}`,
  ].join(' ');

  let schemaProperties: any[] = [];
  try {
    const params: Record<string, string> = { city, limit: '20', page: '1' };
    if (areaId)                params.areaId   = areaId;
    if (listingType !== 'all') params.type     = listingType;
    if (marla)               { params.marlaMin = String(marla); params.marlaMax = String(marla); }
    const qs  = new URLSearchParams(params).toString();
    const res = await serverApi.getProperties(qs);
    const rawProps: any[] = Array.isArray(res) ? res : (res as any).properties || [];
    schemaProperties = rawProps.map((p: any) => ({ id: p._id, slug: p.slug, name: p.title }));
  } catch { /* non-critical */ }

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
    properties: schemaProperties.map(p => ({ title: p.name, url: `${BASE_URL}/p/${p.slug || p.id}` })),
    totalItems: schemaProperties.length,
    crumbs: breadcrumbs,
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
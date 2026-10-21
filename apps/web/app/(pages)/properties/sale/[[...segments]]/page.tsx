 import PropertiesListing from '@/components/PropertiesListing';
import { AreaSocietyBox, CityAgenciesBox, CityExtras } from '@/components/societies/ArchiveBoxes';
import SocietyMapBanner from '@/components/society-map/SocietyMapBanner';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { serverApi, fetchInitialListings, isNotFoundError } from '@/lib/server-api';
import { toTitleCase } from '@/lib/utils';
import { buildCollectionPageSchema } from '@/lib/schema/listing-schema';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealer.pk';

/*
 * Rendered on first visit, then served from cache; refreshed every 5 minutes
 * and as soon as a listing changes (tag "properties"). Nothing is pre-built.
 */
export const revalidate = 300;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

interface PageProps {
  params: Promise<{ segments?: string[] }>;
}

const isMarlaSegment   = (s: string) => /^\d+marla$/i.test(s);
const isKanalSegment   = (s: string) => /^\d+kanal$/i.test(s);
const isSizeSegment    = (s: string) => isMarlaSegment(s) || isKanalSegment(s);
const parseSizeToMarla = (s: string) => {
  if (isKanalSegment(s)) return parseInt(s) * 20;
  return parseInt(s.replace(/marla/i, ''), 10);
};

const KNOWN_TYPES = [
  'house','apartment','flat','plot','shop','office',
  'land','commercial','factory','hotel','restaurant','other'
];

/** Canonical path; a merged duplicate's pages point at the area it was merged into. */
function canonicalPath(segments: string[], areaData: any) {
  const rest = segments.filter(s => !isSizeSegment(s));
  if (areaData?.__mergedFrom && areaData.areaSlug && rest[1]) rest[1] = areaData.areaSlug;
  return rest.join('/');
}

async function resolve(segments: string[]) {
  if (!segments.length) {
    return { cityData: null, citySlug: '', areaData: null, areaSlug: null, propertyType: null, marla: null };
  }

  const sizeSegment = segments.find(isSizeSegment) || null;
  const marla       = sizeSegment ? parseSizeToMarla(sizeSegment) : null;
  const rest        = segments.filter(s => !isSizeSegment(s));

  if (rest.length >= 1 && KNOWN_TYPES.includes(rest[0]!.toLowerCase())) {
    return { cityData: null, citySlug: '', areaData: null, areaSlug: null, propertyType: rest[0]!, marla };
  }

  const citySlug = rest[0] || '';
  let cityData: any = null;
  // Null for a city that does not exist; an API that is down throws (the cached page stays).
  cityData = await serverApi.getCityByName(citySlug);

  if (!cityData) {
    return { cityData: null, citySlug, areaData: null, areaSlug: null, propertyType: null, marla };
  }
  if (!rest[1]) {
    return { cityData, citySlug, areaData: null, areaSlug: null, propertyType: null, marla };
  }

  const seg2 = rest[1].toLowerCase();
  if (KNOWN_TYPES.includes(seg2)) {
    return { cityData, citySlug, areaData: null, areaSlug: null, propertyType: rest[1]!, marla };
  }

  let areaData: any = null;
  try { areaData = await serverApi.getAreaBySlug(rest[1]!, cityData._id); } catch (e) { if (!isNotFoundError(e)) throw e; }
  // A duplicate merged into another area keeps its URL, and shows that area's listings and content.
  if (areaData?.mergedIntoSlug) {
    try {
      const primary = await serverApi.getAreaBySlug(areaData.mergedIntoSlug, cityData._id);
      if (primary) areaData = { ...primary, __mergedFrom: rest[1] };
    } catch (e) { if (!isNotFoundError(e)) throw e; /* keep the duplicate */ }
  }

  const propertyType = rest[2] && KNOWN_TYPES.includes(rest[2].toLowerCase()) ? rest[2]! : null;
  return { cityData, citySlug, areaData, areaSlug: rest[1]!, propertyType, marla };
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

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { segments = [] } = await params;
  const { cityData, citySlug, areaData, propertyType, marla } = await resolve(segments);

  const purpose  = 'Sale';
  const cityName = cityData ? toTitleCase(cityData.name) : citySlug ? toTitleCase(citySlug) : '';
  const typeName = propertyType
    ? (propertyType.toLowerCase() === 'house' ? 'Property' : toTitleCase(propertyType))
    : 'Properties';
  const areaName = areaData ? toTitleCase(areaData.name) : null;
  const locationStr = areaName ? `${areaName}${cityName ? `, ${cityName}` : ''}` : cityName || 'Pakistan';
  const marlaStr = marla ? ` - ${marla >= 20 ? `${marla / 20} Kanal` : `${marla} Marla`}` : '';

  if (areaData) {
    // 🆕 area + marla size meta (highest priority)
    if (marla) {
      const areaSizeEntry = findAreaSizeEntry(areaData, marla, ['sale', 'all']);
      if (areaSizeEntry?.metaTitle?.trim()) {
        return {
          title: areaSizeEntry.metaTitle,
          description: areaSizeEntry.metaDescription || undefined,
          alternates: { canonical: `/properties/sale/${canonicalPath(segments, areaData)}` },
        };
      }
    }
    return {
      title: areaData.saleMetaTitle?.trim() || `${typeName} for ${purpose} in ${locationStr}${marlaStr}`,
      description: areaData.saleMetaDescription?.trim() || `Find ${typeName.toLowerCase()} for ${purpose.toLowerCase()} in ${locationStr}. Browse verified listings on Property Dealer.`,
      alternates: { canonical: `/properties/sale/${canonicalPath(segments, areaData)}` },
    };
  }

  if (cityData) {
    if (marla && propertyType) {
      const sizeEntry = findSizeEntry(cityData, marla, ['sale', 'all']);
      if (sizeEntry?.metaTitle?.trim()) {
        return {
          title: sizeEntry.metaTitle,
          description: sizeEntry.metaDescription || undefined,
          alternates: { canonical: `/properties/sale/${segments.filter(s => !isSizeSegment(s)).join('/')}` },
        };
      }
    }

    const findTypeContent = (type: string) =>
      cityData?.typeContents?.find(
        (tc: any) => tc.propertyType.toLowerCase() === type.toLowerCase() &&
          (tc.purpose === 'sale' || tc.purpose === 'all')
      ) || null;

    if (propertyType) {
      const tc = findTypeContent(propertyType);
      return {
        title: tc?.metaTitle?.trim() || `${typeName} for ${purpose} in ${cityName}${marlaStr}`,
        description: tc?.metaDescription?.trim() || `Find the best ${propertyType.toLowerCase()} for ${purpose.toLowerCase()} in ${cityName}. Browse verified listings on Property Dealer.`,
        alternates: { canonical: `/properties/sale/${segments.filter(s => !isSizeSegment(s)).join('/')}` },
      };
    }

    return {
      title: cityData.saleMetaTitle || `Properties for ${purpose} in ${cityName}`,
      description: cityData.saleMetaDescription || `Find the best properties for ${purpose.toLowerCase()} in ${cityName}. Browse the latest listings on Property Dealer.`,
      alternates: { canonical: `/properties/sale/${citySlug}` },
    };
  }

  return {
    title: propertyType ? `${typeName} for ${purpose} in Pakistan${marlaStr}` : `Properties for ${purpose} in Pakistan`,
    description: `Search and find properties for ${purpose.toLowerCase()} across Pakistan on Property Dealer.`,
    alternates: { canonical: `/properties/sale${segments.length ? `/${segments.join('/')}` : ''}` },
  };
}

export default async function SalePage({ params }: PageProps) {
  const { segments = [] } = await params;
  const { cityData, citySlug, areaData, areaSlug, propertyType, marla } = await resolve(segments);
  // An area segment that is not an area (unknown, or a hidden empty one) is a real 404, not an empty page.
  if (cityData && areaSlug && !areaData) notFound();

  const listingType = propertyType || 'all';
  const areaId      = areaData?._id;
  const cityName    = cityData ? toTitleCase(cityData.name) : '';

  const specificContent = propertyType && cityData && !areaData
    ? cityData?.typeContents?.find(
        (tc: any) => tc.propertyType.toLowerCase() === propertyType.toLowerCase() &&
          (tc.purpose === 'sale' || tc.purpose === 'all')
      ) || null
    : null;

  const sizeEntry = marla && propertyType && cityData && !areaData
    ? findSizeEntry(cityData, marla, ['sale', 'all'])
    : null;

  // 🆕 area + marla size content (highest priority)
  const areaSizeEntry = marla && areaData
    ? findAreaSizeEntry(areaData, marla, ['sale', 'all'])
    : null;

  const richDescription = areaSizeEntry?.content?.trim()
    ? areaSizeEntry.content
    : areaData && propertyType
      ? undefined
      : areaData
        ? (areaData.saleContent?.trim() || areaData.description || undefined)
        : sizeEntry?.content?.trim()
          ? sizeEntry.content
          : propertyType
            ? (specificContent?.content?.trim() || undefined)
            : (cityData?.saleContent || undefined);

  const typeName  = propertyType ? (propertyType.toLowerCase() === 'house' ? 'Property' : toTitleCase(propertyType)) : null;
  const areaName  = areaData ? toTitleCase(areaData.name) : null;
  const pageUrl   = `${BASE_URL}/properties/sale${segments.length ? `/${segments.join('/')}` : ''}`;
  const pageTitle = [
    typeName ? (typeName === 'Property' ? 'Property' : `${typeName}s`) : 'Properties',
    'for Sale',
    areaName ? `in ${areaName}, ${cityName}` : cityName ? `in ${cityName}` : 'in Pakistan',
  ].join(' ');

  // Page one of the list, rendered with the HTML (see fetchInitialListings).
  const initial = await fetchInitialListings({
    purpose: 'buy',
    cityId: cityData?._id,
    cityName: citySlug || undefined,
    areaId,
    type: listingType,
    marla,
  });
  const schemaProperties = initial.raw.map((p: any) => ({ id: p._id, slug: p.slug, name: p.title }));

  const nonSizeSegs = segments.filter(s => !isSizeSegment(s));
  const crumbs = [
    { name: 'Home', url: `${BASE_URL}/` },
    { name: 'Properties for Sale', url: `${BASE_URL}/properties/sale` },
    ...(cityName ? [{ name: cityName, url: `${BASE_URL}/properties/sale/${citySlug}` }] : []),
    ...(areaName ? [{ name: areaName, url: `${BASE_URL}/properties/sale/${citySlug}/${areaSlug}` }] : []),
    ...(typeName && nonSizeSegs.length > 1 ? [{ name: `${typeName}s`, url: `${BASE_URL}/properties/sale/${nonSizeSegs.join('/')}` }] : []),
  ];

  const collectionSchema = buildCollectionPageSchema({
    url: pageUrl, title: pageTitle,
    cityName: cityName || 'Pakistan',
    properties: schemaProperties.map((p: any) => ({ title: p.name, url: `${BASE_URL}/p/${p.slug || p.id}` })),
    totalItems: schemaProperties.length,
    crumbs,
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }} />
      <SocietyMapBanner city={citySlug} area={areaSlug} />
      <Suspense fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      }>
        <PropertiesListing
          purpose="buy"
          initialProperties={initial.properties}
          initialTotalPages={initial.totalPages}
          cityId={cityData?._id}
          city={citySlug}
          type={listingType}
          areaId={areaId}
          areaSlug={areaSlug || undefined}
          useCleanUrls={true}
          richDescription={richDescription}
          initialMarla={marla ?? undefined}
          sidebar={cityData ? (
            <>
              {areaData && areaSlug ? <AreaSocietyBox citySlug={citySlug} areaSlug={areaSlug!} purpose="sale" /> : null}
              <CityAgenciesBox cityId={cityData?._id} cityName={toTitleCase(cityData.name)} />
            </>
          ) : undefined}
          extras={cityData && !(areaData && areaSlug) ? <CityExtras citySlug={citySlug} cityId={cityData?._id} cityName={toTitleCase(cityData.name)} /> : undefined}
          heading={pageTitle}
        />
      </Suspense>
    </>
  );
}
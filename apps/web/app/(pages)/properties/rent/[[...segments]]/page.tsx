import PropertiesListing from '@/components/PropertiesListing';
import { Suspense } from 'react';
import { Metadata } from 'next';
import { serverApi } from '@/lib/server-api';
import { toTitleCase } from '@/lib/utils';
import { buildCollectionPageSchema } from '@/lib/schema/listing-schema';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealer.pk';

interface PageProps {
  params: Promise<{ segments?: string[] }>;
}

const isMarlaSegment  = (s: string) => /^\d+marla$/i.test(s);
const isKanalSegment  = (s: string) => /^\d+kanal$/i.test(s);
const isSizeSegment   = (s: string) => isMarlaSegment(s) || isKanalSegment(s);
const parseSizeToMarla = (s: string) => {
  if (isKanalSegment(s)) return parseInt(s) * 20;
  return parseInt(s.replace(/marla/i, ''), 10);
};

// Known property types (lowercase)
const KNOWN_TYPES = [
  'house','apartment','flat','plot','shop','office',
  'land','commercial','factory','hotel','restaurant','other'
];

// Resolve all segments → city, type, area, marla
// URL patterns:
//   /rent                              → segments = undefined
//   /rent/lahore                       → ['lahore']
//   /rent/house                        → ['house']         (no city)
//   /rent/house/5marla                 → ['house','5marla'] (no city)
//   /rent/lahore/house                 → ['lahore','house']
//   /rent/lahore/house/5marla          → ['lahore','house','5marla']
//   /rent/lahore/gulberg               → ['lahore','gulberg']
//   /rent/lahore/gulberg/house         → ['lahore','gulberg','house']
//   /rent/lahore/gulberg/house/5marla  → ['lahore','gulberg','house','5marla']
async function resolve(segments: string[]) {
  if (!segments.length) {
    return { cityData: null, citySlug: '', areaData: null, areaSlug: null, propertyType: null, marla: null };
  }

  // Pull out size segment first
  const sizeSegment = segments.find(isSizeSegment) || null;
  const marla       = sizeSegment ? parseSizeToMarla(sizeSegment) : null;
  const rest        = segments.filter(s => !isSizeSegment(s));

  // If first segment is a known type → no city
  if (rest.length >= 1 && KNOWN_TYPES.includes(rest[0]!.toLowerCase())) {
    return {
      cityData: null, citySlug: '', areaData: null, areaSlug: null,
      propertyType: rest[0]!, marla,
    };
  }

  // First segment is city
  const citySlug = rest[0] || '';
  let cityData: any = null;
  try { cityData = await serverApi.getCityByName(citySlug); } catch { /* not found */ }

  if (!cityData) {
    return { cityData: null, citySlug, areaData: null, areaSlug: null, propertyType: null, marla };
  }

  // rest[1] could be type or area
  if (!rest[1]) {
    return { cityData, citySlug, areaData: null, areaSlug: null, propertyType: null, marla };
  }

  const seg2 = rest[1].toLowerCase();

  // rest[1] is a known type
  if (KNOWN_TYPES.includes(seg2)) {
    return { cityData, citySlug, areaData: null, areaSlug: null, propertyType: rest[1]!, marla };
  }

  // rest[1] is area slug
  let areaData: any = null;
  try { areaData = await serverApi.getAreaBySlug(rest[1]!, cityData._id); } catch { /* not found */ }

  // rest[2] might be type
  const propertyType = rest[2] && KNOWN_TYPES.includes(rest[2].toLowerCase()) ? rest[2]! : null;

  return { cityData, citySlug, areaData, areaSlug: rest[1]!, propertyType, marla };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { segments = [] } = await params;
  const { cityData, citySlug, areaData, propertyType, marla } = await resolve(segments);

  const purpose  = 'Rent';
  const cityName = cityData ? toTitleCase(cityData.name) : citySlug ? toTitleCase(citySlug) : '';
  const typeName = propertyType
    ? (propertyType.toLowerCase() === 'house' ? 'Property' : toTitleCase(propertyType))
    : 'Properties';
  const areaName = areaData ? toTitleCase(areaData.name) : null;

  const locationStr = areaName
    ? `${areaName}${cityName ? `, ${cityName}` : ''}`
    : cityName || 'Pakistan';

  const marlaStr = marla ? ` - ${marla >= 20 ? `${marla / 20} Kanal` : `${marla} Marla`}` : '';

  if (areaData) {
    return {
      title: areaData.rentMetaTitle?.trim() || `${typeName} for ${purpose} in ${locationStr}${marlaStr}`,
      description: areaData.rentMetaDescription?.trim() || `Find ${typeName.toLowerCase()} for ${purpose.toLowerCase()} in ${locationStr}. Browse verified listings on Property Dealer.`,
      alternates: { canonical: `/properties/rent/${segments.filter(s => !isSizeSegment(s)).join('/')}` },
    };
  }

  if (cityData) {
    const findTypeContent = (type: string) =>
      cityData?.typeContents?.find(
        (tc: any) => tc.propertyType.toLowerCase() === type.toLowerCase() &&
          (tc.purpose === 'rent' || tc.purpose === 'all')
      ) || null;

    if (propertyType) {
      const tc = findTypeContent(propertyType);
      return {
        title: tc?.metaTitle?.trim() || `${typeName} for ${purpose} in ${cityName}${marlaStr}`,
        description: tc?.metaDescription?.trim() || `Find the best ${propertyType.toLowerCase()} for ${purpose.toLowerCase()} in ${cityName}. Browse verified listings on Property Dealer.`,
        alternates: { canonical: `/properties/rent/${segments.filter(s => !isSizeSegment(s)).join('/')}` },
      };
    }

    return {
      title: cityData.rentMetaTitle || `Properties for ${purpose} in ${cityName}`,
      description: cityData.rentMetaDescription || `Find the best properties for ${purpose.toLowerCase()} in ${cityName}. Browse the latest listings on Property Dealer.`,
      alternates: { canonical: `/properties/rent/${citySlug}` },
    };
  }

  // No city
  return {
    title: propertyType
      ? `${typeName} for ${purpose} in Pakistan${marlaStr}`
      : `Properties for ${purpose} in Pakistan`,
    description: `Search and find properties for ${purpose.toLowerCase()} across Pakistan on Property Dealer.`,
    alternates: { canonical: `/properties/rent${segments.length ? `/${segments.join('/')}` : ''}` },
  };
}

export default async function RentPage({ params }: PageProps) {
  const { segments = [] } = await params;
  const { cityData, citySlug, areaData, areaSlug, propertyType, marla } = await resolve(segments);

  const listingType = propertyType || 'all';
  const areaId      = areaData?._id;
  const cityName    = cityData ? toTitleCase(cityData.name) : '';

  // Rich description logic
  const specificContent = propertyType && cityData && !areaData
    ? cityData?.typeContents?.find(
        (tc: any) => tc.propertyType.toLowerCase() === propertyType.toLowerCase() &&
          (tc.purpose === 'rent' || tc.purpose === 'all')
      ) || null
    : null;

  const richDescription = areaData && propertyType
    ? undefined
    : areaData
      ? (areaData.rentContent?.trim() || areaData.description || undefined)
      : propertyType
        ? (specificContent?.content?.trim() || undefined)
        : (cityData?.rentContent || undefined);

  // Schema
  const typeName   = propertyType ? (propertyType.toLowerCase() === 'house' ? 'Property' : toTitleCase(propertyType)) : null;
  const areaName   = areaData ? toTitleCase(areaData.name) : null;
  const pageUrl    = `${BASE_URL}/properties/rent${segments.length ? `/${segments.join('/')}` : ''}`;
  const pageTitle  = [
    typeName ? (typeName === 'Property' ? 'Property' : `${typeName}s`) : 'Properties',
    'for Rent',
    areaName ? `in ${areaName}, ${cityName}` : cityName ? `in ${cityName}` : 'in Pakistan',
  ].join(' ');

  let schemaProperties: any[] = [];
  try {
    const p: Record<string, string> = { limit: '20', page: '1', purpose: 'rent' };
    if (citySlug)              p.city     = citySlug;
    if (areaId)                p.areaId   = areaId;
    if (listingType !== 'all') p.type     = listingType;
    if (marla)               { p.marlaMin = String(marla); p.marlaMax = String(marla); }
    const res      = await serverApi.getProperties(new URLSearchParams(p).toString());
    const rawProps = Array.isArray(res) ? res : (res as any).properties || [];
    schemaProperties = rawProps.map((p: any) => ({ id: p._id, slug: p.slug, name: p.title }));
  } catch { /* non-critical */ }

  const nonSizeSegs = segments.filter(s => !isSizeSegment(s));
  const crumbs = [
    { name: 'Home', url: `${BASE_URL}/` },
    { name: 'Properties for Rent', url: `${BASE_URL}/properties/rent` },
    ...(cityName ? [{ name: cityName, url: `${BASE_URL}/properties/rent/${citySlug}` }] : []),
    ...(areaName ? [{ name: areaName, url: `${BASE_URL}/properties/rent/${citySlug}/${areaSlug}` }] : []),
    ...(typeName && nonSizeSegs.length > 1 ? [{ name: `${typeName}s`, url: `${BASE_URL}/properties/rent/${nonSizeSegs.join('/')}` }] : []),
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
      <Suspense fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      }>
        <PropertiesListing
          purpose="rent"
          city={citySlug}
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
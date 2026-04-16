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

async function resolve(segments: string[]) {
  if (!segments.length) {
    return { cityData: null, citySlug: '', areaData: null, areaSlug: null, propertyType: null, marla: null };
  }

  const sizeSegment = segments.find(isSizeSegment) || null;
  const marla       = sizeSegment ? parseSizeToMarla(sizeSegment) : null;
  const rest        = segments.filter(s => !isSizeSegment(s));

  if (rest.length >= 1 && KNOWN_TYPES.includes(rest[0]!.toLowerCase())) {
    return {
      cityData: null, citySlug: '', areaData: null, areaSlug: null,
      propertyType: rest[0]!, marla,
    };
  }

  const citySlug = rest[0] || '';
  let cityData: any = null;
  try { cityData = await serverApi.getCityByName(citySlug); } catch { /* not found */ }

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
  try { areaData = await serverApi.getAreaBySlug(rest[1]!, cityData._id); } catch { /* not found */ }

  const propertyType = rest[2] && KNOWN_TYPES.includes(rest[2].toLowerCase()) ? rest[2]! : null;

  return { cityData, citySlug, areaData, areaSlug: rest[1]!, propertyType, marla };
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

  const locationStr = areaName
    ? `${areaName}${cityName ? `, ${cityName}` : ''}`
    : cityName || 'Pakistan';

  const marlaStr = marla ? ` - ${marla >= 20 ? `${marla / 20} Kanal` : `${marla} Marla`}` : '';

  if (areaData) {
    return {
      title: areaData.saleMetaTitle?.trim() || `${typeName} for ${purpose} in ${locationStr}${marlaStr}`,
      description: areaData.saleMetaDescription?.trim() || `Find ${typeName.toLowerCase()} for ${purpose.toLowerCase()} in ${locationStr}. Browse verified listings on Property Dealer.`,
      alternates: { canonical: `/properties/sale/${segments.filter(s => !isSizeSegment(s)).join('/')}` },
    };
  }

  if (cityData) {
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
    title: propertyType
      ? `${typeName} for ${purpose} in Pakistan${marlaStr}`
      : `Properties for ${purpose} in Pakistan`,
    description: `Search and find properties for ${purpose.toLowerCase()} across Pakistan on Property Dealer.`,
    alternates: { canonical: `/properties/sale${segments.length ? `/${segments.join('/')}` : ''}` },
  };
}

export default async function SalePage({ params }: PageProps) {
  const { segments = [] } = await params;
  const { cityData, citySlug, areaData, areaSlug, propertyType, marla } = await resolve(segments);

  const listingType = propertyType || 'all';
  const areaId      = areaData?._id;
  const cityName    = cityData ? toTitleCase(cityData.name) : '';

  const specificContent = propertyType && cityData && !areaData
    ? cityData?.typeContents?.find(
        (tc: any) => tc.propertyType.toLowerCase() === propertyType.toLowerCase() &&
          (tc.purpose === 'sale' || tc.purpose === 'all')
      ) || null
    : null;

  const richDescription = areaData && propertyType
    ? undefined
    : areaData
      ? (areaData.saleContent?.trim() || areaData.description || undefined)
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

  let schemaProperties: any[] = [];
  try {
    const p: Record<string, string> = { limit: '20', page: '1', purpose: 'sale' };
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
      <Suspense fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      }>
        <PropertiesListing
          purpose="buy"
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
// lib/schema/listing-schema.ts
// Schema.org JSON-LD generators for property listing pages

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealer.pk';

// Map property type string → schema.org @type
function getSchemaType(propertyType: string): string {
  const t = (propertyType || '').toLowerCase().trim();
  if (['flat', 'apartment'].includes(t)) return 'Apartment';
  if (t === 'house') return 'SingleFamilyResidence';
  if (['plot', 'land'].includes(t)) return 'Landform';
  if (t === 'shop') return 'Store';
  if (t === 'office') return 'OfficeBuilding';
  if (t === 'commercial') return 'CommercialProperty';
  if (t === 'factory') return 'IndustrialBuilding';
  if (t === 'hotel') return 'Hotel';
  if (t === 'restaurant') return 'Restaurant';
  return 'RealEstateListing';
}

/**
 * Collection Page Schema (for City and Location landing pages)
 * Includes CollectionPage, ItemList, and BreadcrumbList.
 */
export function buildCollectionPageSchema(data: {
  url: string;
  title: string;
  cityName: string;
  properties: Array<{
    title: string;
    url: string;
  }>;
  totalItems: number;
  crumbs: Array<{ name: string; url: string }>;
}) {
  const { url, title, properties, totalItems, crumbs } = data;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${url}#collection`,
        'url': url,
        'name': title,
        'isPartOf': {
          '@id': `${BASE_URL}/#website`
        }
      },
      {
        '@type': 'ItemList',
        '@id': `${url}#itemlist`,
        'name': title,
        'numberOfItems': totalItems,
        'itemListElement': properties.map((p, index) => ({
          '@type': 'ListItem',
          'position': index + 1,
          'url': p.url,
          'name': p.title
        }))
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumb`,
        'itemListElement': crumbs.map((crumb, index) => ({
          '@type': 'ListItem',
          'position': index + 1,
          'name': crumb.name,
          'item': crumb.url
        }))
      }
    ]
  };
}

/**
 * Build a full graph schema for a single property detail page as requested.
 * Contains RealEstateListing, Property (Specific type), Offer, and BreadcrumbList.
 */
export function buildListingPageSchema(data: {
  property: {
    id: string;
    slug?: string;
    title: string;
    description?: string;
    propertyType: string;
    listingType: 'rent' | 'sale';
    price: number;
    location?: string;
    city?: string;
    cityUrl?: string;
    areaName?: string;
    bedrooms?: number;
    bathrooms?: number;
    areaSize?: number;
    marla?: number;
    mainPhotoUrl?: string;
    additionalPhotosUrls?: string[];
    createdAt?: string;
    owner?: {
      name?: string;
      phone?: string;
    };
    contactNumber?: string;
  };
  crumbs?: Array<{ name: string; url: string }>;
}) {
  const { property } = data;
  const url = `${BASE_URL}/p/${property.slug || property.id}`;
  const isSale = property.listingType === 'sale';
  const propertySpecificType = getSchemaType(property.propertyType);

  // Strip HTML from description for plain text version
  const descriptionPlain = property.description
    ? property.description.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim()
    : `${property.title} located in ${property.location || property.city || 'Pakistan'}`;

  // Collect images (up to 3 as per requested snippet)
  const images = [
    ...(property.mainPhotoUrl ? [property.mainPhotoUrl] : []),
    ...(property.additionalPhotosUrls || []),
  ].slice(0, 3);

  // Default crumbs if not provided
  const cityUrl = property.cityUrl || `${BASE_URL}/properties/all/${(property.city || '').toLowerCase().replace(/\s+/g, '-')}`;
  
  const crumbs = data.crumbs || [
    { name: 'Home', url: `${BASE_URL}/` },
    { name: 'Properties', url: `${BASE_URL}/properties` },
    { name: property.city || 'City', url: cityUrl },
    { name: property.title, url: url }
  ];

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'RealEstateListing',
        '@id': `${url}#listing`,
        'url': url,
        'name': property.title,
        'description': descriptionPlain.substring(0, 300),
        'datePosted': property.createdAt ? new Date(property.createdAt).toISOString() : new Date().toISOString(),
        'mainEntity': {
          '@id': `${url}#property`
        },
        'offers': {
          '@id': `${url}#offer`
        }
      },
      {
        '@type': propertySpecificType,
        '@id': `${url}#property`,
        'name': property.title,
        'description': descriptionPlain,
        'image': images.length > 0 ? images : [`${BASE_URL}/og-image.jpg`],
        'numberOfRooms': property.bedrooms || 0,
        'numberOfBathroomsTotal': property.bathrooms || 0,
        'floorSize': {
          '@type': 'QuantitativeValue',
          'value': property.areaSize || property.marla || 0,
          'unitText': property.marla ? 'Marla' : 'sqft'
        },
        'address': {
          '@type': 'PostalAddress',
          'streetAddress': property.location || property.areaName,
          'addressLocality': property.city,
          'addressCountry': 'PK'
        },
        'offers': {
          '@id': `${url}#offer`
        }
      },
      {
        '@type': 'Offer',
        '@id': `${url}#offer`,
        'url': url,
        'price': String(property.price),
        'priceCurrency': 'PKR',
        'availability': 'https://schema.org/InStock',
        'itemOffered': {
          '@id': `${url}#property`
        },
        'businessFunction': isSale ? 'Sell' : 'Rent',
        'seller': {
          '@type': 'RealEstateAgent',
          'name': property.owner?.name || 'Property Dealer',
          'telephone': property.contactNumber || '+923030119992'
        }
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumb`,
        'itemListElement': crumbs.map((crumb, index) => ({
          '@type': 'ListItem',
          'position': index + 1,
          'name': crumb.name,
          'item': crumb.url
        }))
      }
    ]
  };

  return schema;
}

// ItemList schema (Legacy)
export function buildItemListSchema(
  properties: Array<{
    id: string;
    slug?: string;
    name: string;
    type: string;
    price: number;
    purpose: string;
    city: string;
    location?: string;
    bedrooms?: number;
    bathrooms?: number;
    area?: number;
    image?: string;
    createdAt?: string;
  }>,
  pageUrl: string,
  pageTitle: string
) {
  const items = properties.map((p, index) => {
    const detailUrl = `${BASE_URL}/p/${p.slug || p.id}`;
    return {
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'RealEstateListing',
        name: p.name || `${p.type} in ${p.city}`,
        url: detailUrl,
        ...(p.image && { image: p.image }),
        datePosted: p.createdAt
          ? new Date(p.createdAt).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
        offers: {
          '@type': 'Offer',
          price: String(Math.round(p.price)),
          priceCurrency: 'PKR',
          businessFunction: p.purpose === 'buy' || p.purpose === 'sale'
            ? 'https://purl.org/goodrelations/v1#Sell'
            : 'https://purl.org/goodrelations/v1#LeaseOut',
          availability: 'https://schema.org/InStock',
          url: detailUrl,
        },
        itemOffered: {
          '@type': getSchemaType(p.type),
          address: {
            '@type': 'PostalAddress',
            addressLocality: p.location || p.city,
            addressRegion: p.city,
            addressCountry: 'PK',
          },
        },
      },
    };
  });

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: pageTitle,
    url: pageUrl,
    numberOfItems: properties.length,
    itemListElement: items,
  };
}

// BreadcrumbList schema (Legacy)
export function buildBreadcrumbSchema(
  crumbs: Array<{ name: string; url: string }>
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  };
}

// RealEstateAgent / SearchAction schema for city landing pages
export function buildSearchActionSchema(cityName: string, citySlug: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    url: BASE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${BASE_URL}/properties/all/${citySlug}/{search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

// Deprecated (Combined into buildListingPageSchema)
export function buildPropertySchema(property: any) {
    return buildListingPageSchema({ property });
}


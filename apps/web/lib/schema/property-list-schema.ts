// lib/schema/property-list-schema.ts

export function generatePropertyListSchema(
  properties: Array<{
    id: string;
    slug?: string;
    name: string;
    type: string;           // 'Plot', 'House', 'Apartment', 'Commercial' etc.
    price: number;
    purpose: 'rent' | 'sale' | 'buy';
    city: string;
    location?: string;
    bedrooms?: number;
    bathrooms?: number;
    area?: number;          // in sqft or convert marla
    images?: string[];      // absolute URLs preferred
    status?: string;        // 'available', 'sold', etc.
    datePosted?: string;
  }>,
  pageUrl: string,
  pageTitle: string,
  baseUrl: string = process.env.NEXT_PUBLIC_BASE_URL || 'https://your-site.com'
) {
  const items = properties.map((p, index) => {
    const detailUrl = `${baseUrl}/property/${p.slug || p.id}`;

    // Map your type → schema.org @type (minimal version for list page)
    const getPropertyType = (t: string = '') => {
      const lower = t.toLowerCase().trim();
      if (['flat', 'apartment'].includes(lower)) return 'Apartment';
      if (lower === 'house') return 'SingleFamilyResidence';
      if (['plot', 'land'].includes(lower)) return 'Land';
      if (lower === 'shop') return 'Store';
      if (lower === 'office') return 'OfficeBuilding';
      if (lower === 'commercial') return 'LocalBusiness';
      return 'Accommodation'; // fallback
    };

    const itemType = getPropertyType(p.type);
    const isResidential = ['flat', 'apartment', 'house'].some(t => p.type?.toLowerCase().includes(t));

    return {
      "@type": "ListItem",
      "position": index + 1,
      "item": {
        "@type": "RealEstateListing",
        "name": p.name || `${p.type} in ${p.city}`,
        "url": detailUrl,
        ...(p.images?.[0] && { "image": p.images[0] }),
        "datePosted": p.datePosted || new Date().toISOString().split('T')[0],

        "offers": {
          "@type": "Offer",
          "price": String(Math.round(p.price)),
          "priceCurrency": "PKR",
          "businessFunction":
            p.purpose === 'buy' || p.purpose === 'sale'
              ? "https://purl.org/goodrelations/v1#Sell"
              : "https://purl.org/goodrelations/v1#LeaseOut",
          "availability": p.status?.toLowerCase().includes('sold') || p.status?.toLowerCase().includes('rented')
            ? "https://schema.org/SoldOut"
            : "https://schema.org/InStock",
          "url": detailUrl
        },

        "itemOffered": {
          "@type": itemType,
          ...(isResidential && {
            "numberOfBedrooms": p.bedrooms ?? undefined,
            "numberOfBathroomsTotal": p.bathrooms ?? undefined
          }),
          ...(p.area && {
            "floorSize": {
              "@type": "QuantitativeValue",
              "value": String(p.area),
              "unitText": "sqft"
            }
          })
        }
      }
    };
  });

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": pageTitle,
    "url": pageUrl,
    "numberOfItems": properties.length,
    "itemListElement": items
  };
}
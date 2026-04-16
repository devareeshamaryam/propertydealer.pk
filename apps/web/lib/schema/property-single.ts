// lib/schema/property-single.ts
import { toTitleCase } from "../utils";
export function generateSinglePropertySchema(property: any, images: string[], baseUrl: string) {
  if (!property) return null;

  const slugOrId = property.slug || property.id || '';
  const propertyUrl = `${baseUrl}/property/${slugOrId}`;

  // Map your type → schema.org itemOffered type
  const getItemType = (type: string = ''): string => {
    const t = type.toLowerCase().trim();

    if (t === 'flat' || t === 'apartment')          return 'Apartment';
    if (t === 'house')                              return 'SingleFamilyResidence'; // or 'House'
    if (t === 'plot' || t === 'land')               return 'Land';
    if (t === 'shop')                               return 'Store';
    if (t === 'office')                             return 'OfficeBuilding';
    if (t === 'commercial')                         return 'LocalBusiness';

    return 'Accommodation'; // fallback for 'other' or unknown
  };

  const itemType = getItemType(property.type);

  // Decide if residential-style fields make sense
  const isResidential = ['flat', 'apartment', 'house'].includes(
    property.type?.toLowerCase().trim() || ''
  );

  return {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    "name": property.name || 'Property Listing',
    "url": propertyUrl,
    "description": property.description ||
      `${property.name || 'Property'} in ${toTitleCase(property.location || '')}, ${toTitleCase(property.city || '')}`,
    "image": images.filter(Boolean), // filter out falsy values
    "datePosted": property.createdAt ||
      property.listedAt ||
      property.updatedAt ||
      new Date().toISOString().split('T')[0],

    "address": {
      "@type": "PostalAddress",
      "streetAddress": property.street || property.address || undefined,
      "addressLocality": toTitleCase(property.city || ''),
      "addressRegion": toTitleCase(property.location || ''),
      "postalCode": property.postalCode || undefined,
      "addressCountry": "PK"
    },

    "itemOffered": {
      "@type": itemType,
      "name": property.name || undefined,
      ...(isResidential && {
        "numberOfBedrooms": property.bedrooms ?? undefined,
        "numberOfBathroomsTotal": property.bathrooms ?? undefined, // correct name!
      }),
      "floorSize": property.area
        ? {
            "@type": "QuantitativeValue",
            "value": String(property.area),
            "unitText": "sqft", // safe & Google-friendly
            // "unitCode": "FTK" // optional UN/CEFACT code
          }
        : undefined,

      // Future extensions (add when you have data)
      // "amenityFeature": property.amenities?.map((a: string) => ({ "@type": "LocationFeatureSpecification", "name": a })),
      // "floorLevel": property.floor,
      // "numberOfRooms": property.roomsTotal,
    },

    "offers": {
      "@type": "Offer",
      "price": property.price ? String(property.price) : undefined,
      "priceCurrency": "PKR",
      "businessFunction":
        property.purpose === 'buy' || property.purpose?.toLowerCase().includes('sale')
          ? "https://purl.org/goodrelations/v1#Sell"
          : "https://purl.org/goodrelations/v1#LeaseOut",
      "availability":
        property.status === 'sold' ||
        property.status === 'rented' ||
        property.status === 'unavailable'
          ? "https://schema.org/SoldOut"
          : "https://schema.org/InStock",
      "url": propertyUrl,
      // Optional but powerful: "seller": { "@type": "RealEstateAgent", "name": "Your Agency" }
    }
  };
}
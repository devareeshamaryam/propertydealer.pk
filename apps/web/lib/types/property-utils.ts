import { Property } from '../data';

// Backend property type (from API response)
export interface BackendProperty {
  _id: string;
  listingType: 'rent' | 'sale';
  propertyType:
    | 'house'
    | 'apartment'
    | 'flat'
    | 'commercial'
    | 'land'
    | 'shop'
    | 'office'
    | 'warehouse'
    | 'factory'
    | 'hotel'
    | 'restaurant'
    | 'plot'
    | 'other';
  city?: string; // Legacy field, may not be present
  slug?: string;
  area?: {
    _id: string;
    name: string;
    areaSlug: string;
    city?: {
      _id: string;
      name: string;
      areaSlug: string;
      state: string;
      country: string;
    };
  } | string; // Can be populated object (Area) or ObjectId string
  title: string;
  location: string;
  bedrooms: number;
  bathrooms: number;
  areaSize?: number; // Property size in sq ft (new field)
  price: number;
  marla?: number;
  kanal?: number;
  description: string;
  contactNumber: string;
  whatsappNumber?: string;
  features?: string[];
  mainPhotoUrl?: string;
  additionalPhotosUrls?: string[];
  status: 'pending' | 'approved' | 'rejected';
  owner?: any;
  createdAt?: string;
  updatedAt?: string;
  latitude?: number;
  longitude?: number;
  videoUrl?: string | null;
}

export const PROPERTY_TYPE_ORDER = [
  'house',
  'apartment',
  'shop',
  'office',
  'flat',
  'commercial',
  'plot',
  'land',
  'factory',
  'hotel',
  'restaurant',
  'other'
];

export function sortPropertyTypes<T>(types: T[], getTypeValue: (t: T) => string): T[] {
  return [...types].sort((a, b) => {
    const valA = getTypeValue(a).toLowerCase();
    const valB = getTypeValue(b).toLowerCase();
    const indexA = PROPERTY_TYPE_ORDER.indexOf(valA);
    const indexB = PROPERTY_TYPE_ORDER.indexOf(valB);

    if (indexA === -1 && indexB === -1) return valA.localeCompare(valB);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Map backend property to frontend property format
export function mapBackendToFrontendProperty(backend: BackendProperty): Property {
  // Map propertyType to frontend format (capitalize first letter)
  const typeMap: Record<string, string> = {
    house: 'House',
    apartment: 'Apartment',
    flat: 'Flat',
    commercial: 'Commercial',
    land: 'Land',
    shop: 'Shop',
    office: 'Office',
    warehouse: 'Office', // Map warehouse to Office
    factory: 'Factory',
    hotel: 'Hotel',
    restaurant: 'Restaurant',
    plot: 'Plot',
    other: 'Other'
  };

  // Map listingType to purpose
  const purposeMap: Record<string, 'rent' | 'buy'> = {
    rent: 'rent',
    sale: 'buy',
  };


  // Extract city name from area.city or fallback to legacy city field
  let cityName = backend.city || '';
  let citySlug = '';
  if (backend.area && typeof backend.area === 'object') {
    cityName = backend.area.city?.name || cityName;
    citySlug = backend.area.city?.areaSlug || '';
  }
  // Fallback: derive city slug from city name if not available
  if (!citySlug && cityName) {
    citySlug = toSlug(cityName);
  }

  // Extract area name and slug
  const areaName = (backend.area && typeof backend.area === 'object') ? backend.area.name : '';
  const areaSlug = (backend.area && typeof backend.area === 'object') ? backend.area.areaSlug : '';

  // Convert image URL to full URL if it's a relative path
  const getImageUrl = (url?: string): string => {
    if (!url) return 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80';
    // If it's already a full URL, return as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    // If it's a relative path like /uploads/..., use Next.js proxy (works in dev and prod)
    if (url.startsWith('/uploads/')) {
      // Use the proxy path which Next.js will rewrite to the API server
      return url; // Next.js rewrite will handle /uploads/... -> http://localhost:3001/uploads/...
    }
    return url;
  };

  return {
    id: backend._id,
    name: backend.title,
    slug: backend.slug || toSlug(backend.title),
    type: (typeMap[backend.propertyType] || 'House') as Property['type'],
    city: cityName,
    citySlug: citySlug,
    location: backend.location,
    price: backend.price,
    bedrooms: backend.bedrooms,
    bathrooms: backend.bathrooms,
    area: backend.areaSize || 0, // Property size in sq ft
    areaSlug: areaSlug,
    marla: backend.marla,
    kenal: backend.kanal,
    purpose: purposeMap[backend.listingType] || 'rent',
    image: getImageUrl(backend.mainPhotoUrl),
    description: backend.description,
    features: backend.features || [],
    areaId: backend.area && typeof backend.area === 'object' ? backend.area._id : (typeof backend.area === 'string' ? backend.area : undefined),
    areaName: areaName,
    latitude: backend.latitude,
    longitude: backend.longitude,
    whatsappNumber: backend.whatsappNumber,
    contactNumber: backend.contactNumber,
    videoUrl: backend.videoUrl,
  };
}


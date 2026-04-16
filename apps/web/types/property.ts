export interface Property {
  id: string;
  title: string;
  description?: string;
  price: number;
  currency: string;
  images: string[];
  bedrooms: number;
  bathrooms: number;
  area: {
    value: number;
    unit: string;
  };
  location: {
    city: string;
    area: string;
    address?: string;
  };
  status: 'FOR_SALE' | 'FOR_RENT' | 'SOLD';
  featured: boolean;
  propertyType: 'HOUSE' | 'APARTMENT' | 'VILLA' | 'PLOT';
  createdAt: string;
  updatedAt: string;
}

export interface FeaturedPropertiesResponse {
  properties: Property[];
  total: number;
  page: number;
  limit: number;
}
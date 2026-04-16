export interface CreatePackageDto {
  name: string;
  description?: string;
  price: number;
  duration: number;
  propertyLimit: number;
  featuredListings?: number;
  photosPerProperty?: number;
  features?: string[];
}

export interface UpdatePackageDto {
  name?: string;
  description?: string;
  price?: number;
  duration?: number;
  propertyLimit?: number;
  featuredListings?: number;
  photosPerProperty?: number;
  isActive?: boolean;
  features?: string[];
}

export interface PackageResponse {
  _id: string;
  name: string;
  description?: string;
  price: number;
  duration: number;
  propertyLimit: number;
  featuredListings: number;
  photosPerProperty: number;
  isActive: boolean;
  features: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreatePackageDto {
  name: string;
  description?: string;
  price: number;
  duration: number;
  propertyLimit: number;
  featuredListings?: number;
  photosPerProperty?: number;
  features?: string[];
  verifiedBadge?: boolean;
  teamMembers?: number;
  socialLinks?: boolean;
  brandedProfile?: boolean;
  autoPublish?: boolean;
  spotlight?: boolean;
  highlight?: boolean;
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
  verifiedBadge?: boolean;
  teamMembers?: number;
  socialLinks?: boolean;
  brandedProfile?: boolean;
  autoPublish?: boolean;
  spotlight?: boolean;
  highlight?: boolean;
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
  verifiedBadge?: boolean;
  teamMembers?: number;
  socialLinks?: boolean;
  brandedProfile?: boolean;
  autoPublish?: boolean;
  spotlight?: boolean;
  highlight?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

'use client'
import { Heart, MapPin, Bed, Bath, Maximize, Loader2 } from 'lucide-react';
import Image from 'next/image';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { propertyApi } from '@/lib/api';
import { mapBackendToFrontendProperty, BackendProperty } from '@/lib/types/property-utils';
import { Property } from '@/lib/data';
import { toTitleCase } from '../lib/utils';

const toSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

type FeaturedProperty = {
  id: string | number;
  image: string;
  title: string;
  location: string;
  price: string;
  priceLabel?: string;
  beds: number;
  baths: number;
  marla: string;
  slug?: string;
};

const PropertyCard = ({ property }: { property: FeaturedProperty }) => {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 h-full flex flex-col">
      <Link href={`/properties/${property.slug || toSlug(property.title)}`}>
        <div className="relative h-64 overflow-hidden group cursor-pointer">
          <Image
            src={property.image}
            alt={property.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-110"
            sizes="(max-w-768px) 100vw, (max-w-1200px) 50vw, 33vw"
          />
        </div>
      </Link>

      <div className="p-5 flex flex-col flex-1">
        <Link href={`/properties/${property.slug || toSlug(property.title)}`}>
          <h3 className="text-xl font-bold text-gray-900 mb-3 hover:text-primary transition-colors cursor-pointer line-clamp-1">
            {property.title}
          </h3>
        </Link>

        <div className="flex items-center text-gray-600 mb-4">
          <MapPin className="w-4 h-4 mr-2" />
          <p className="text-sm truncate">{property.location}</p>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-6 text-gray-600">
          <div className="flex items-center gap-1.5">
            <Bed className="w-4 h-4" />
            <span className="text-xs font-medium">{property.beds} Beds</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Bath className="w-4 h-4" />
            <span className="text-xs font-medium">{property.baths} Baths</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Maximize className="w-4 h-4" />
            <span className="text-xs font-medium whitespace-nowrap">{property.marla}</span>
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between pt-4 border-t border-gray-100">
          <div>
            <p className="text-[10px] uppercase font-bold text-gray-400 mb-0.5 tracking-wider">{property.priceLabel || 'Monthly Rent'}</p>
            <p className="text-xl font-extrabold text-gray-900">{property.price}</p>
          </div>

          <Link href={`/properties/${property.slug || toSlug(property.title)}`}>
            <button className="px-4 py-2 bg-black text-white rounded-lg text-xs font-bold hover:bg-gray-800 transition-all duration-300 hover:shadow-lg uppercase tracking-wider">
              Explore
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
};

interface FeaturedSectionProps {
  initialProperties?: FeaturedProperty[];
}

const FeaturedSection: React.FC<FeaturedSectionProps> = ({ initialProperties }) => {
  const [featuredProperties, setFeaturedProperties] = useState<FeaturedProperty[]>(initialProperties || []);
  const [loading, setLoading] = useState(!initialProperties);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialProperties && initialProperties.length > 0) return;

    const fetchProperties = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await propertyApi.getAll();
        const backendProperties: BackendProperty[] = Array.isArray(response)
          ? response
          : (response as any).properties || [];

        const allProperties = backendProperties.map(mapBackendToFrontendProperty);

        const approvedProperties = allProperties
          .filter((p: Property) => p)
          .slice(0, 8);

        const mappedProperties: FeaturedProperty[] = approvedProperties.map((property, index) => ({
          id: property.id || `property-${index}-${Date.now()}`,
          image: property.image || 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',
          title: property.name,
          location: `${property.location}, ${toTitleCase(property.city)}`,
          price: `Rs. ${property.price.toLocaleString('en-PK')}`,
          priceLabel: property.purpose === 'buy' ? 'Total Price' : 'Monthly Rent',
          beds: property.bedrooms,
          baths: property.bathrooms,
          marla: property.marla && property.marla > 0 ? `${property.marla} marla` : `${property.marla} `,
          slug: property.slug,
        }));

        setFeaturedProperties(mappedProperties);
      } catch (err) {
        console.error('Error fetching featured properties:', err);
        setError('Failed to load properties');
      } finally {
        setLoading(false);
      }
    };

    fetchProperties();
  }, [initialProperties]);

  return (
    <section className="py-20 bg-white">
      <div className="max-w-[1440px] mx-auto px-4 lg:px-8">
        <div className="max-w-3xl mb-12">
          <Badge text="Featured Listings" />
          <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mt-4 mb-6 leading-tight">
            Premium Properties Handpicked for You
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl leading-relaxed">
            Discover our collection of high-end homes and investment opportunities in Pakistan's prime locations.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-3 text-gray-600">Loading properties...</span>
          </div>
        ) : error ? (
          <div className="text-center py-20 bg-red-50 rounded-3xl border border-red-100">
            <p className="text-red-600 mb-4 font-medium">{error}</p>
            <button
              onClick={() => typeof window !== 'undefined' && window.location.reload()}
              className="px-6 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
            >
              Retry Connection
            </button>
          </div>
        ) : featuredProperties.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 rounded-3xl border border-dashed border-gray-300">
            <p className="text-gray-600">No properties available at the moment.</p>
          </div>
        ) : (
          <div className="relative">
            <Carousel
              opts={{
                align: "start",
                loop: true,
              }}
              className="w-full"
            >
              <CarouselContent className="-ml-4 md:-ml-6">
                {featuredProperties.map((property, index) => (
                  <CarouselItem
                    key={property.slug || property.id || `property-${index}`}
                    className="pl-4 md:pl-6 sm:basis-1/2 lg:basis-1/3 xl:basis-1/4"
                  >
                    <PropertyCard property={property} />
                  </CarouselItem>
                ))}
              </CarouselContent>
              <div className="hidden lg:flex absolute -top-20 right-0 gap-3">
                <CarouselPrevious className="static translate-y-0 h-12 w-12 rounded-2xl border-gray-100" />
                <CarouselNext className="static translate-y-0 h-12 w-12 rounded-2xl bg-black text-white hover:bg-gray-800" />
              </div>
            </Carousel>
          </div>
        )}
      </div>
    </section>
  );
};

const Badge = ({ text }: { text: string }) => (
  <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-black text-white text-[10px] font-extrabold uppercase tracking-[0.2em] shadow-sm">
    {text}
  </span>
);

export default FeaturedSection;
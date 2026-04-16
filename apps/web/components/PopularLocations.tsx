'use client'
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MapPin, ArrowRight, Loader2 } from 'lucide-react';
import { cityApi, propertyApi } from '@/lib/api';
import { toTitleCase } from '@/lib/utils';

const DEFAULT_CITY_IMAGES: Record<string, string> = {
  'karachi': 'https://images.unsplash.com/photo-1570533113000-67623306634d?w=800&q=80',
  'lahore': 'https://images.unsplash.com/photo-1596422846543-75c6fc18a5ce?w=800&q=80',
  'islamabad': 'https://images.unsplash.com/photo-1621538356947-f495bf847683?w=800&q=80',
  'faisalabad': 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80',
  'multan': 'https://images.unsplash.com/photo-1570533113000-67623306634d?w=800&q=80',
  'gujranwala': 'https://images.unsplash.com/photo-1596422846543-75c6fc18a5ce?w=800&q=80',
};

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=800&q=80';

const cityToSlug = (cityName: string): string => {
  return cityName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

interface PopularLocationsProps {
  initialCities?: any[];
}

const CITY_ORDER = ['lahore', 'islamabad', 'karachi', 'multan', 'gujranwala', 'faisalabad'];

const PopularLocations: React.FC<PopularLocationsProps> = ({ initialCities }) => {
  const [cities, setCities] = useState<any[]>(initialCities || []);
  const [loading, setLoading] = useState(!initialCities);

  useEffect(() => {
    if (initialCities && initialCities.length > 0) return;

    const fetchCitiesWithCounts = async () => {
      try {
        setLoading(true);
        const cityList = await cityApi.getAll();

        // Filter and sort according to CITY_ORDER
        const topCities = cityList
          .filter((city: any) => {
            const cityName = city.name.trim().toLowerCase();
            return CITY_ORDER.includes(cityName) || cityName === 'faislabad';
          })
          .sort((a: any, b: any) => {
            const nameA = a.name.trim().toLowerCase();
            const nameB = b.name.trim().toLowerCase();
            const getIndex = (name: string) => {
              if (name === 'faislabad') return CITY_ORDER.indexOf('faisalabad');
              return CITY_ORDER.indexOf(name);
            };
            return getIndex(nameA) - getIndex(nameB);
          });

        // Fetch stats for each city to get property counts
        const citiesWithStats = await Promise.all(
          topCities.map(async (city: any) => {
            try {
              const stats = await propertyApi.getLocationStats(city.name);
              return {
                ...city,
                count: stats.total || 0,
                slug: cityToSlug(city.name),
                image: city.thumbnail || DEFAULT_CITY_IMAGES[city.name.trim().toLowerCase()] || DEFAULT_CITY_IMAGES['faisalabad'] || FALLBACK_IMAGE
              };
            } catch (err) {
              return {
                ...city,
                count: 0,
                slug: cityToSlug(city.name),
                image: city.thumbnail || DEFAULT_CITY_IMAGES[city.name.trim().toLowerCase()] || DEFAULT_CITY_IMAGES['faisalabad'] || FALLBACK_IMAGE
              };
            }
          })
        );

        // Property count sorting removed to respect CITY_ORDER
        setCities(citiesWithStats);
      } catch (error) {
        console.error('Error fetching cities:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCitiesWithCounts();
  }, [initialCities]);

  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-[1440px] mx-auto px-4 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-4">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Explore Popular Locations</h2>
            <p className="text-gray-600 max-w-xl">Find properties in the most sought-after cities across Pakistan. From bustling metros to serene suburbs.</p>
          </div>
          <Link href="/properties" className="group flex items-center gap-2 text-black font-bold hover:gap-3 transition-all">
            View All Cities <ArrowRight className="w-5 h-5" />
          </Link>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white/50 rounded-3xl border border-dashed border-gray-300">
            <Loader2 className="w-10 h-10 animate-spin text-gray-400 mb-4" />
            <p className="text-gray-500 font-medium">Fetching locations...</p>
          </div>
        ) : cities.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {cities.map((city) => (
              <Link
                key={city._id}
                href={`/properties/all/${city.slug}`}
                className="group relative h-64 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500"
              >
                <Image
                  src={city.image}
                  alt={`${city.name} Real Estate`}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-110"
                  sizes="(max-w-768px) 100vw, (max-w-1200px) 50vw, 33vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                <div className="absolute bottom-6 left-6 right-6">
                  <div className="flex items-center gap-2 text-white/80 text-sm font-medium mb-1">
                    <MapPin className="w-4 h-4" />
                    <span>Pakistan</span>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-1">{toTitleCase(city.name)}</h3>
                  <p className="text-white/90 text-sm font-semibold">{city.count} Properties</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white/50 rounded-3xl border border-dashed border-gray-300">
            <p className="text-gray-500 font-medium">No locations found.</p>
          </div>
        )}
      </div>
    </section>
  );
};

export default PopularLocations;

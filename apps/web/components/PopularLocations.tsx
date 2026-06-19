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
  return cityName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
};

interface PopularLocationsProps {
  initialCities?: any[];
}

const CITY_ORDER = ['lahore', 'islamabad', 'karachi', 'multan', 'gujranwala', 'faisalabad'];

const PopularLocations: React.FC<PopularLocationsProps> = ({ initialCities }) => {
  const [cities, setCities] = useState<any[]>(initialCities || []);
  const [loading, setLoading] = useState(!initialCities || initialCities.length === 0);

  useEffect(() => {
    // ✅ Agar server se data aa gaya toh client fetch mat karo
    if (initialCities && initialCities.length > 0) return;

    const fetchCitiesWithCounts = async () => {
      try {
        setLoading(true);
        const cityList = await cityApi.getAll();

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

        // ✅ Parallel fetch — await Promise.all sequential nahi
        const statsResults = await Promise.allSettled(
          topCities.map((city: any) => propertyApi.getLocationStats(city.name))
        );

        const citiesWithStats = topCities.map((city: any, index: number) => {
 const statsResult = statsResults[index];
const count = statsResult?.status === 'fulfilled' ? (statsResult as PromiseFulfilledResult<any>).value?.total ?? 0 : 0;          return {
            ...city,
            count,
            slug: cityToSlug(city.name),
            image: city.thumbnail || DEFAULT_CITY_IMAGES[city.name.trim().toLowerCase()] || FALLBACK_IMAGE,
          };
        });

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
        <div className="flex flex-row justify-between items-start mb-3 gap-3">
          <h2 className="text-xl sm:text-3xl md:text-4xl font-extrabold text-gray-900">Explore Popular Locations</h2>
          <Link href="/properties" className="group flex items-center gap-1.5 sm:gap-2 text-black font-bold hover:gap-3 transition-all text-sm sm:text-base shrink-0 pt-1 sm:pt-2">
            View All Cities <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </Link>
        </div>
        <p className="text-gray-600 max-w-xl mb-6 sm:mb-10 text-sm sm:text-base">Find properties in the most sought-after cities across Pakistan. From bustling metros to serene suburbs.</p>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white/50 rounded-3xl border border-dashed border-gray-300">
            <Loader2 className="w-10 h-10 animate-spin text-gray-400 mb-4" />
            <p className="text-gray-500 font-medium">Fetching locations...</p>
          </div>
        ) : cities.length > 0 ? (
          <>
            {/* ══════════════════════════════════════════════════════
                MOBILE — compact: small round image + text beside it
            ══════════════════════════════════════════════════════ */}
            <div className="sm:hidden grid grid-cols-2 gap-x-3 gap-y-4">
              {cities.map((city, index) => (
                <Link
                  key={`mobile-${city._id ?? index}`}
                  href={`/properties/all/${city.slug}`}
                  className="flex items-center gap-2.5"
                >
                  <div className="w-10 h-10 shrink-0 rounded-full overflow-hidden relative">
                    <Image
                      src={city.image}
                      alt={`${city.name} Real Estate`}
                      fill
                      loading="lazy"
                      className="object-cover"
                      sizes="40px"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-gray-900 truncate">{toTitleCase(city.name)}</p>
                    {city.count > 0 && (
                      <p className="text-[11px] text-gray-400">{city.count} Properties</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>

            {/* ══════════════════════════════════════════════════════
                DESKTOP / TABLET — original card grid, unchanged
            ══════════════════════════════════════════════════════ */}
            <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {cities.map((city, index) => (
                <Link
                  key={`desktop-${city._id ?? index}`}
                  href={`/properties/all/${city.slug}`}
                  className="group relative h-44 sm:h-64 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500"
                >
                  <Image
                    src={city.image}
                    alt={`${city.name} Real Estate`}
                    fill
                    priority={index < 2}
                    fetchPriority={index < 2 ? 'high' : 'auto'}
                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                    sizes="(max-width: 640px) 50vw, (max-width: 1200px) 50vw, 33vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                  <div className="absolute bottom-3 left-3 right-3 sm:bottom-6 sm:left-6 sm:right-6">
                    <div className="flex items-center gap-1 sm:gap-2 text-white/80 text-xs sm:text-sm font-medium mb-0.5 sm:mb-1">
                      <MapPin className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span>Pakistan</span>
                    </div>
                    <h3 className="text-lg sm:text-2xl font-bold text-white mb-0.5 sm:mb-1">{toTitleCase(city.name)}</h3>
                    {/* ✅ Count 0 ho toh hide karo */}
                    {city.count > 0 && (
                      <p className="text-white/90 text-xs sm:text-sm font-semibold">{city.count} Properties</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </>
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
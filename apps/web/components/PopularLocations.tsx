 'use client'
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { SectionHeading } from '@/components/SectionHeading';
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

  /*
   * Six cities as six small tiles, not six posters.
   *
   * These were 256px-tall photographs with a dark gradient over them, a
   * shadow that deepened on hover and an image that zoomed to 110% — the
   * biggest thing on the homepage after the hero, for what is a list of six
   * links. Portals show cities as a row of compact tiles: a photo, the name,
   * the count. One row on a desktop, two columns on a phone.
   */
  return (
    <section className="bg-white py-10 sm:py-12">
      <div className="container mx-auto px-4">
        <SectionHeading
          title="Popular cities"
          description="Browse property for sale and rent by city."
          action={
            <Link
              href="/properties"
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
            >
              All properties
              <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />

        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="aspect-[4/3] animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : cities.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
            {cities.map((city, index) => (
              <Link
                key={city._id ?? index}
                href={`/properties/all/${city.slug}`}
                className="group block"
              >
                <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-slate-100">
                  <Image
                    src={city.image}
                    alt={`Property in ${toTitleCase(city.name)}`}
                    fill
                    priority={index < 2}
                    className="object-cover transition-opacity group-hover:opacity-90"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                  />
                </div>
                <p className="mt-2 text-[15px] font-semibold text-slate-900 group-hover:text-primary">
                  {toTitleCase(city.name)}
                </p>
                {city.count > 0 && (
                  <p className="text-[13px] text-slate-500">
                    {city.count.toLocaleString('en-PK')} properties
                  </p>
                )}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default PopularLocations;
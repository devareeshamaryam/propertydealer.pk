'use client'
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { propertyApi } from '@/lib/api';
import { mapBackendToFrontendProperty, BackendProperty } from '@/lib/types/property-utils';
import { Property } from '@/lib/data';
import PropertyCard from '@/components/PropertyCard';
import { SectionHeading } from '@/components/SectionHeading';

/*
 * The homepage strip of listings.
 *
 * It had its own private card — a heavier copy of the real one, with a
 * shadow that grew on hover, a black "EXPLORE" pill and the full price
 * spelled out as "Rs. 11,000,000" — and a headline, "Premium Properties
 * Handpicked for You", over what is in fact the eight newest listings. Now it
 * uses the same card as everywhere else and says what it is — the same row
 * as the search results, two columns on a wide screen, one on a phone.
 */

interface FeaturedSectionProps {
  initialProperties?: Property[];
  /** How many to show (Settings → General → Homepage). */
  count?: number;
}

export default function FeaturedSection({ initialProperties, count = 8 }: FeaturedSectionProps) {
  const [properties, setProperties] = useState<Property[]>(initialProperties ?? []);
  const [loading, setLoading] = useState(!initialProperties || initialProperties.length === 0);

  useEffect(() => {
    if (initialProperties && initialProperties.length > 0) return;

    let cancelled = false;
    (async () => {
      try {
        const response = await propertyApi.getAll({ limit: 8 });
        const rows: BackendProperty[] = Array.isArray(response)
          ? response
          : (response as { properties?: BackendProperty[] })?.properties ?? [];
        if (!cancelled) setProperties(rows.map(mapBackendToFrontendProperty).slice(0, 8));
      } catch (error) {
        console.error('Error fetching latest properties:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialProperties]);

  if (!loading && properties.length === 0) return null;

  return (
    <section className="border-t border-slate-100 bg-slate-50 py-6 sm:py-12">
      <div className="container mx-auto px-4">
        <SectionHeading
          title="Latest properties"
          description="The newest listings from agents across Pakistan."
          action={
            <Link
              href="/properties"
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
            >
              View all
              <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />

        {loading ? (
          <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2 lg:gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[118px] animate-pulse rounded-lg bg-slate-100 sm:h-[172px]" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2 lg:gap-3">
            {properties.slice(0, count).map((property, index) => (
              <PropertyCard key={property.slug || property.id || `property-${index}`} property={property} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

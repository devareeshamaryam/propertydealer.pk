 'use client'

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import PropertiesListing from '@/components/PropertiesListing';
import { Suspense } from 'react';
import { Property } from '@/lib/data';

interface PropertiesContentProps {
  initialProperties?: Property[];
}

function PropertiesContent({ initialProperties }: PropertiesContentProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const purpose = (searchParams.get('purpose') as 'rent' | 'buy' | 'all') || 'all';
  const city    = searchParams.get('city') || '';
  const type    = searchParams.get('type') || 'all';

  // Redirect query-param URLs to clean URLs
  useEffect(() => {
    // Only redirect if there are query params that we can clean up
    const hasQueryParams = searchParams.get('purpose') || searchParams.get('city') || searchParams.get('type');
    if (!hasQueryParams) return;

    const pp     = purpose === 'buy' ? 'sale' : purpose === 'rent' ? 'rent' : null;
    const cSlug  = city ? city.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-') : '';
    const tSlug  = type && type !== 'all' ? `/${type.toLowerCase()}` : '';

    if (pp) {
      // Has purpose → go to /properties/rent or /properties/sale
      const url = cSlug
        ? `/properties/${pp}/${cSlug}${tSlug}`
        : `/properties/${pp}${tSlug}`;
      router.replace(url);
    } else {
      // No purpose (all) → go to /properties/all
      const url = cSlug
        ? `/properties/all/${cSlug}${tSlug}`
        : type && type !== 'all'
          ? `/properties/all${tSlug}`
          : '/properties';
      router.replace(url);
    }
  }, []);

  return (
    <PropertiesListing
      purpose={purpose}
      city={city}
      type={type}
      useCleanUrls={true}
      initialProperties={initialProperties}
    />
  );
}

export default function PropertiesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    }>
      <PropertiesContent />
    </Suspense>
  );
}
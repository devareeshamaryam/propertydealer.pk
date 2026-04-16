 'use client'
/**
 * Properties Filter Bar Component
 * 
 * Persistent filter bar that appears in the properties layout.
 * Handles navigation to clean URL routes based on selected filters.
 */

import { useState, useMemo, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Search, Loader2 } from 'lucide-react';
import { propertyApi, cityApi } from '@/lib/api';
import { BackendProperty, mapBackendToFrontendProperty, sortPropertyTypes } from '@/lib/types/property-utils';
import { Property } from '@/lib/data';
import { cn, toTitleCase } from '@/lib/utils';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"

export default function PropertiesFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // STATE: Properties for filter options
  const [properties, setProperties] = useState<Property[]>([]);
  const [allCities, setAllCities] = useState<any[]>([]);
  const [allPropertyTypes, setAllPropertyTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Extract current filters from URL
  const currentPurpose = useMemo(() => {
    if (!pathname) return 'all';
    const pathParts = pathname.split('/').filter(Boolean);
    if (pathParts[1] === 'rent') return 'rent';
    if (pathParts[1] === 'sale' || pathParts[1] === 'buy') return 'sale';
    if (pathParts[1] === 'all') return 'all';

    const purpose = searchParams.get('purpose');
    if (purpose === 'buy' || purpose === 'sale') return 'sale';
    if (purpose === 'rent') return 'rent';
    return 'all';
  }, [pathname, searchParams]);

  const currentCity = useMemo(() => {
    if (!pathname) return '';
    const pathParts = pathname.split('/').filter(Boolean);
    if (pathParts.length >= 3 && (pathParts[1] === 'rent' || pathParts[1] === 'sale' || pathParts[1] === 'all')) {
      return pathParts[2];
    }
    return searchParams.get('city') || '';
  }, [pathname, searchParams]);

  const currentType = useMemo(() => {
    if (!pathname) return 'all';
    const pathParts = pathname.split('/').filter(Boolean);
    if (pathParts.length >= 4 && (pathParts[1] === 'rent' || pathParts[1] === 'sale' || pathParts[1] === 'all')) {
      return pathParts[3];
    }
    return searchParams.get('type') || 'all';
  }, [pathname, searchParams]);

  // Temporary filter state (before applying)
  const [tempPurpose, setTempPurpose] = useState<'rent' | 'sale' | 'all'>(currentPurpose);
  const [tempCity, setTempCity] = useState('');
  const [tempType, setTempType] = useState('all');

  // FETCH PROPERTIES AND CITIES FOR FILTER OPTIONS
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [propsResponse, citiesResponse, typesResponse] = await Promise.all([
          propertyApi.getAll(),
          cityApi.getAll(),
          propertyApi.getTypes()
        ]);

        const backendProperties = (propsResponse as any).properties || [] as BackendProperty[];
        const transformedProperties = backendProperties.map(mapBackendToFrontendProperty);
        setProperties(transformedProperties);
        setAllCities(citiesResponse);
        setAllPropertyTypes(typesResponse);

      } catch (err) {
        console.error('Error fetching data for filters:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Update temp state when URL changes
  useEffect(() => {
    setTempPurpose(currentPurpose);
    const matchedCity = currentCity ? slugToCity(currentCity) : null;
    setTempCity(matchedCity || currentCity || '');
    setTempType(currentType || 'all');
  }, [currentPurpose, currentCity, currentType]);

  // Extract unique cities and property types
  const cities = useMemo(() => {
    if (allCities && allCities.length > 0) {
      return allCities.map(c => c.name).sort();
    }
    const uniqueCities = Array.from(new Set(properties.map((p: Property) => p.city).filter(Boolean))) as string[];
    return uniqueCities.sort();
  }, [properties, allCities]);

  const propertyTypes = useMemo(() => {
    if (allPropertyTypes && allPropertyTypes.length > 0) {
      const mapped = allPropertyTypes.map(t => t.charAt(0).toUpperCase() + t.slice(1));
      return sortPropertyTypes(mapped, t => t);
    }
    const uniqueTypes = Array.from(new Set(properties.map((p: Property) => p.type).filter(Boolean))) as string[];
    return sortPropertyTypes(uniqueTypes, t => t);
  }, [properties, allPropertyTypes]);

  // Helper functions for city slug conversion
  const cityToSlug = (cityName: string): string => {
    return cityName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const slugToCity = (slug: string): string | null => {
    if (!slug) return null;
    const normalizedSlug = slug.toLowerCase().trim();

    const exactMatch = cities.find(c => cityToSlug(c) === normalizedSlug);
    if (exactMatch) return exactMatch;

    const words = normalizedSlug.split('-');
    if (words.length > 0) {
      const firstLetters = words.map(w => w[0] || '').join('');
      const abbreviationMatch = cities.find(c => {
        const cityWords = c.toLowerCase().split(/\s+/);
        const cityAbbr = cityWords.map((w: string) => w[0] || '').join('');
        return cityAbbr === firstLetters;
      });
      if (abbreviationMatch) return abbreviationMatch;
    }

    const partialMatch = cities.find(c =>
      cityToSlug(c).startsWith(normalizedSlug) ||
      normalizedSlug.startsWith(cityToSlug(c).substring(0, 3))
    );
    if (partialMatch) return partialMatch;

    return null;
  };

  // Navigate to clean URL based on filters
  const applyFilters = () => {
    const purpose = tempPurpose;
    const citySlug = tempCity && toTitleCase(tempCity) ? cityToSlug(tempCity) : '';
    const typeSlug = tempType && tempType !== 'all' ? `/${tempType.toLowerCase()}` : '';

    const params = new URLSearchParams(searchParams.toString());
    params.delete('city');
    params.delete('type');
    params.delete('purpose');

    const queryString = params.toString();
    const suffix = queryString ? `?${queryString}` : '';

    if (citySlug) {
      router.push(`/properties/${purpose}/${citySlug}${typeSlug}${suffix}`);
    } else {
      router.push(`/properties/${purpose}${suffix}`);
    }
  };

  // Navigate to purpose page
  const navigateToPurpose = (newPurpose: 'rent' | 'sale' | 'all') => {
    const purpose = newPurpose;
    const citySlug = tempCity && toTitleCase(tempCity) ? cityToSlug(tempCity) : '';
    const typeSlug = tempType && tempType !== 'all' ? `/${tempType.toLowerCase()}` : '';

    const params = new URLSearchParams(searchParams.toString());
    params.delete('city');
    params.delete('type');
    params.delete('purpose');

    const queryString = params.toString();
    const suffix = queryString ? `?${queryString}` : '';

    if (citySlug) {
      router.push(`/properties/${purpose}/${citySlug}${typeSlug}${suffix}`);
    } else {
      router.push(`/properties/${purpose}${suffix}`);
    }
  };

  // Determine if we are on a property detail page
  const isDetailPage = useMemo(() => {
    if (!pathname) return false;
    if (pathname === '/properties') return false;
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length === 1) return false;
    if (parts.length >= 2 && (parts[1] === 'rent' || parts[1] === 'sale' || parts[1] === 'all')) {
      return false;
    }
    return true;
  }, [pathname]);

  const [open, setOpen] = useState(false);

  const handleApplyFilters = () => {
    applyFilters();
    setOpen(false);
  };

  if (isDetailPage) {
    return null;
  }

  // Shared Filter Controls Component
  const FilterControls = ({ mobile = false }) => (
    <>
      {/* Purpose Selection - Only in Mobile Drawer */}
      {mobile && (
        <div className="w-full">
          <label className="block text-sm font-medium text-gray-700 mb-2">Purpose</label>
          <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setTempPurpose('rent')}
              className={`flex-1 relative px-6 py-2 rounded-md text-sm font-semibold transition-all duration-300 ${tempPurpose === 'rent'
                ? 'bg-black text-white shadow-lg'
                : 'bg-transparent text-gray-700 hover:bg-gray-200'
                }`}
            >
              For Rent
            </button>
            <button
              onClick={() => setTempPurpose('sale')}
              className={`flex-1 relative px-6 py-2 rounded-md text-sm font-semibold transition-all duration-300 ${tempPurpose === 'sale'
                ? 'bg-black text-white shadow-lg'
                : 'bg-transparent text-gray-700 hover:bg-gray-200'
                }`}
            >
              For Sale
            </button>
            <button
              onClick={() => setTempPurpose('all')}
              className={`flex-1 relative px-6 py-2 rounded-md text-sm font-semibold transition-all duration-300 ${tempPurpose === 'all'
                ? 'bg-black text-white shadow-lg'
                : 'bg-transparent text-gray-700 hover:bg-gray-200'
                }`}
            >
              All
            </button>
          </div>
        </div>
      )}

      {/* City Filter */}
      <div className={`relative w-full ${!mobile ? 'sm:w-auto sm:min-w-[160px]' : ''}`}>
        {mobile && <label className="block text-sm font-medium text-gray-700 mb-2">City</label>}
        <select
          value={tempCity}
          onChange={(e) => setTempCity(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg border-2 border-gray-300 focus:border-black focus:outline-none transition-all duration-300 bg-white text-sm font-medium hover:border-gray-500 hover:shadow-md appearance-none cursor-pointer"
          title="Select City"
        >
          <option value="">All Cities</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Type Filter */}
      <div className={`relative w-full ${!mobile ? 'sm:w-auto sm:min-w-[160px]' : ''}`}>
        {mobile && <label className="block text-sm font-medium text-gray-700 mb-2">Property Type</label>}
        <select
          value={tempType}
          onChange={(e) => setTempType(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg border-2 border-gray-300 focus:border-black focus:outline-none transition-all duration-300 bg-white text-sm font-medium hover:border-gray-500 hover:shadow-md appearance-none cursor-pointer"
          title="Select Property Type"
        >
          <option value="all">All Types</option>
          {propertyTypes.map((t: string) => (
            <option key={t} value={t.toLowerCase()}>
              {t}
            </option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Apply Button */}
      <button
        className={`relative bg-black text-white px-6 py-2.5 rounded-lg font-semibold text-sm transform transition-all duration-300 flex items-center justify-center gap-2 shadow-lg hover:shadow-2xl overflow-hidden group w-full ${!mobile ? 'sm:w-auto hover:scale-105 active:scale-95' : 'active:scale-95'} ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
        onClick={handleApplyFilters}
        disabled={loading}
      >
        <span className="relative z-10 flex items-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {loading ? 'Loading...' : 'Apply Filters'}
        </span>
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-30 transform -skew-x-12 translate-x-[-200%] group-hover:translate-x-[200%] transition-all duration-1000"></div>
      </button>
    </>
  );

  return (
    // ✅ KEY CHANGE: Added "hidden md:block" — entire bar is hidden on mobile.
    // Mobile now uses the Zameen-style sticky header inside PropertiesListing instead.
    <section className="hidden md:block py-3 border-b border-border bg-white/95 backdrop-blur-md sticky top-16 md:top-20 z-40 shadow-sm transition-all duration-300">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center gap-4 max-w-6xl mx-auto">

          {/* Purpose Tabs - Desktop Only */}
          <div className="hidden md:flex gap-2 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => {
                setTempPurpose('rent');
                navigateToPurpose('rent');
              }}
              className={`relative px-6 py-2 rounded-md text-sm font-semibold transition-all duration-300 overflow-hidden group whitespace-nowrap ${tempPurpose === 'rent'
                ? 'bg-black text-white shadow-lg'
                : 'bg-transparent text-gray-700 hover:bg-gray-200'
                }`}
            >
              <span className="relative z-10">For Rent</span>
            </button>
            <button
              onClick={() => {
                setTempPurpose('sale');
                navigateToPurpose('sale');
              }}
              className={`relative px-6 py-2 rounded-md text-sm font-semibold transition-all duration-300 overflow-hidden group whitespace-nowrap ${tempPurpose === 'sale'
                ? 'bg-black text-white shadow-lg'
                : 'bg-transparent text-gray-700 hover:bg-gray-200'
                }`}
            >
              <span className="relative z-10">For Sale</span>
            </button>
            <button
              onClick={() => {
                setTempPurpose('all');
                navigateToPurpose('all');
              }}
              className={`relative px-6 py-2 rounded-md text-sm font-semibold transition-all duration-300 overflow-hidden group whitespace-nowrap ${tempPurpose === 'all'
                ? 'bg-black text-white shadow-lg'
                : 'bg-transparent text-gray-700 hover:bg-gray-200'
                }`}
            >
              <span className="relative z-10">All</span>
            </button>
          </div>

          {/* Desktop Filter Controls */}
          <div className="hidden md:flex flex-1 flex-wrap gap-3 justify-end w-full md:w-auto">
            <FilterControls />
          </div>

        </div>
      </div>
    </section>
  );
}
 'use client'
/**
 * Properties Filter Bar Component
 * 
 * Persistent filter bar that appears in the properties layout.
 * Handles navigation to clean URL routes based on selected filters.
 */

import { useState, useMemo, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Search, Loader2, ChevronDown } from 'lucide-react';
import { propertyApi, cityApi } from '@/lib/api';
import { sortPropertyTypes } from '@/lib/types/property-utils';
import { cn, toTitleCase } from '@/lib/utils';

export default function PropertiesFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // STATE: Properties for filter options
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
        // Cities and types are all the two dropdowns need — this used to
        // download the whole listing feed as well, on every results page.
        const [citiesResponse, typesResponse] = await Promise.all([
          cityApi.getNames(),
          propertyApi.getTypes()
        ]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPurpose, currentCity, currentType, allCities]);

  // Extract unique cities and property types
  const cities = useMemo(
    () => (allCities ?? []).map((c: any) => c.name as string).sort(),
    [allCities],
  );

  const propertyTypes = useMemo(() => {
    const mapped = (allPropertyTypes ?? []).map(t => t.charAt(0).toUpperCase() + t.slice(1));
    return sortPropertyTypes(mapped, t => t);
  }, [allPropertyTypes]);

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

  const handleApplyFilters = () => {
    applyFilters();
  };

  if (isDetailPage) {
    return null;
  }

  const selectClass =
    'h-9 w-full appearance-none rounded-md border border-slate-300 bg-white pl-3 pr-8 text-[14px] text-slate-900 outline-none transition-colors hover:border-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/15 cursor-pointer';

  const PURPOSES: { value: 'sale' | 'rent' | 'all'; label: string }[] = [
    { value: 'sale', label: 'Buy' },
    { value: 'rent', label: 'Rent' },
    { value: 'all', label: 'All' },
  ];

  /*
   * One slim bar: purpose, city, type, search. It was a 60px band with
   * black pill toggles carrying shadow-lg, selects with 2px borders that
   * grew a shadow on hover, a frosted backdrop, and an "Apply" button that
   * scaled up 5% and swept a white shimmer across itself on hover.
   */
  return (
    // Phones use the Buy / Rent / Filters row inside PropertiesListing.
    <section className="sticky top-16 z-40 hidden border-b border-slate-200 bg-white md:block">
      <div className="container mx-auto flex h-14 items-center gap-3 px-4">
        <div role="tablist" aria-label="Purpose" className="flex h-9 shrink-0 overflow-hidden rounded-lg border border-slate-300">
          {PURPOSES.map(({ value, label }, i) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tempPurpose === value}
              onClick={() => {
                setTempPurpose(value);
                navigateToPurpose(value);
              }}
              className={cn(
                'px-4 text-[14px] font-medium transition-colors',
                i > 0 && 'border-l border-slate-300',
                tempPurpose === value
                  ? 'bg-primary text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <label className="relative w-44 lg:w-52">
          <span className="sr-only">City</span>
          <select value={tempCity} onChange={(e) => setTempCity(e.target.value)} className={selectClass}>
            <option value="">All cities</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </label>

        <label className="relative w-44 lg:w-52">
          <span className="sr-only">Property type</span>
          <select value={tempType} onChange={(e) => setTempType(e.target.value)} className={selectClass}>
            <option value="all">All property types</option>
            {propertyTypes.map((t: string) => (
              <option key={t} value={t.toLowerCase()}>
                {t}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </label>

        <button
          type="button"
          onClick={handleApplyFilters}
          disabled={loading}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-[14px] font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-60 btn-shape"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Search
        </button>
      </div>
    </section>
  );
}

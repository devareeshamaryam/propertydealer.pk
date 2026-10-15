'use client'
import { useState, useEffect, useRef } from 'react';
import { Search, X, MapPin, Home, ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { propertyApi, cityApi, areaApi } from '@/lib/api';
import { mapBackendToFrontendProperty, BackendProperty, sortPropertyTypes } from '@/lib/types/property-utils';
import { Property } from '@/lib/data';
import { cn, toTitleCase } from '@/lib/utils';
import { amountShort } from '@/lib/pk';
import { useSiteSettings } from '@/components/SiteSettingsProvider';
import { DEFAULT_HERO_SUBTITLE, DEFAULT_HERO_TITLE } from '@/lib/site-settings';

/*
 * The search band at the top of the homepage.
 *
 * Portals open with one job: pick buy or rent, a city, maybe an area and a
 * type, and go. The old hero wrapped that in a 400px canvas of three pastel
 * radial gradients over a grid pattern, a 60px black headline with an
 * animated underline, and a frosted card with 24px corners and a hover
 * shadow — and on phones a separate layout with a hand-drawn wave and two
 * full-screen modals just to choose a city. Everything a search needs fits in
 * one compact panel that works the same way at every width; native selects
 * already give phones a proper picker.
 */

interface HeroSectionProps {
  initialCities?: any[];
  initialProperties?: any[];
  initialTypes?: string[];
}

const CITY_ORDER = ['lahore', 'islamabad', 'karachi', 'multan', 'gujranwala', 'faisalabad'];

const selectClass =
  'h-11 w-full appearance-none rounded-md border border-slate-300 bg-white pl-3 pr-9 text-[14px] text-slate-900 outline-none transition-colors hover:border-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400';

const HeroSection: React.FC<HeroSectionProps> = ({ initialCities, initialProperties, initialTypes }) => {
  const router = useRouter();
  const { heroTitle, heroSubtitle } = useSiteSettings();
  const [purpose, setPurpose] = useState<'rent' | 'buy'>('rent');
  // Lahore has the most listings, so it is the better starting point than
  // whichever city sorts first alphabetically.
  const defaultCity =
    initialCities?.find((c: any) => c.name?.toLowerCase() === 'lahore') ?? initialCities?.[0];
  const [city, setCity] = useState(defaultCity?.name || '');
  const [cityId, setCityId] = useState(defaultCity?._id || '');
  const [area, setArea] = useState('');
  const [areaSlug, setAreaSlug] = useState('');
  const [type, setType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<Property[]>([]);
  const [allProperties, setAllProperties] = useState<Property[]>(initialProperties || []);
  const [cityList, setCityList] = useState<{ _id: string; name: string }[]>(initialCities || []);
  const [areaList, setAreaList] = useState<{ _id: string; name: string; areaSlug: string }[]>([]);
  const [propertyTypes, setPropertyTypes] = useState<string[]>(initialTypes ? sortPropertyTypes(initialTypes, t => t) : []);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const cityToSlug = (cityName: string): string =>
    cityName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  const typeToSlug = (typeName: string): string =>
    typeName.toLowerCase().trim();

  useEffect(() => {
    const hasInitialData =
      initialCities && initialCities.length > 0 &&
      initialProperties && initialProperties.length > 0 &&
      initialTypes && initialTypes.length > 0;
    if (hasInitialData) return;

    const fetchInitialData = async () => {
      try {
        const [citiesData, propertiesData, typesData] = await Promise.all([
          cityApi.getAll(),
          propertyApi.getAll(),
          propertyApi.getTypes()
        ]);
        const sortedCities = (citiesData as any[]).sort((a: any, b: any) => {
          const aIndex = CITY_ORDER.indexOf(a.name.toLowerCase());
          const bIndex = CITY_ORDER.indexOf(b.name.toLowerCase());
          if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
          if (aIndex !== -1) return -1;
          if (bIndex !== -1) return 1;
          return a.name.localeCompare(b.name);
        });
        setCityList(sortedCities);
        const backendProperties = (propertiesData as any).properties || [] as BackendProperty[];
        setAllProperties(backendProperties.map(mapBackendToFrontendProperty));
        const mappedTypes = typesData.map((t: string) => t.charAt(0).toUpperCase() + t.slice(1));
        setPropertyTypes(sortPropertyTypes(mappedTypes, t => t));
        if (sortedCities.length > 0 && !city) {
          setCity(sortedCities[0].name);
          setCityId(sortedCities[0]._id);
        }
      } catch (error) {
        console.error('Error fetching initial data:', error);
      }
    };
    fetchInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCities, initialProperties, initialTypes]);

  useEffect(() => {
    const fetchAreas = async () => {
      if (!cityId) { setAreaList([]); setArea(''); setAreaSlug(''); return; }
      try {
        setLoadingAreas(true);
        const areasData = await areaApi.getAreasByCity(cityId);
        const sortedAreas = (areasData as any[]).sort((a, b) => a.name.localeCompare(b.name));
        setAreaList(sortedAreas);
        setArea(''); setAreaSlug('');
      } catch (error) {
        console.error('Error fetching areas:', error);
        setAreaList([]);
      } finally {
        setLoadingAreas(false);
      }
    };
    fetchAreas();
  }, [cityId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchQuery.trim().length >= 2) {
        const searchTerm = searchQuery.toLowerCase().trim();
        try {
          const response = await propertyApi.getAll({ search: searchTerm, limit: 8 });
          let backendProperties: BackendProperty[] = [];
          if (Array.isArray(response)) backendProperties = response;
          else if (response && (response as any).properties) backendProperties = (response as any).properties;
          const transformed = backendProperties.map(mapBackendToFrontendProperty);
          setFilteredSuggestions(transformed);
          setShowSuggestions(transformed.length > 0);
        } catch {
          const filtered = allProperties.filter(property =>
            property.name?.toLowerCase().includes(searchTerm) ||
            property.city?.toLowerCase().includes(searchTerm) ||
            property.type?.toLowerCase().includes(searchTerm) ||
            property.location?.toLowerCase().includes(searchTerm)
          ).slice(0, 8);
          setFilteredSuggestions(filtered);
          setShowSuggestions(filtered.length > 0);
        }
      } else {
        setFilteredSuggestions([]);
        setShowSuggestions(false);
      }
    };
    const timeoutId = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, allProperties]);

  const handleSearch = () => {
    const purposeSlug = purpose === 'buy' ? 'sale' : 'rent';
    const typeSlug = type ? typeToSlug(type) : 'all';
    const params = new URLSearchParams();
    if (searchQuery) params.set('search', searchQuery);
    const queryString = params.toString();
    const suffix = queryString ? `?${queryString}` : '';
    if (!city) { router.push(`/properties${suffix}`); return; }
    const citySlug = cityToSlug(city);
    const pathSegment = areaSlug || (typeSlug !== 'all' ? typeSlug : '');
    if (!pathSegment) {
      router.push(`/properties/${purposeSlug}/${citySlug}${suffix}`);
    } else {
      router.push(`/properties/${purposeSlug}/${citySlug}/${pathSegment}${suffix}`);
    }
  };

  const handlePropertyClick = (property: Property) => {
    router.push(`/properties/${property.slug}`);
    setShowSuggestions(false);
    setSearchQuery('');
  };

  const clearSearch = () => { setSearchQuery(''); setShowSuggestions(false); };

  return (
    <section className="bg-navy">
      <div className="container mx-auto px-4 py-8 sm:py-12 lg:py-14">
        <h1 className="text-center text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-[34px]">
          {heroTitle || DEFAULT_HERO_TITLE}
        </h1>
        <p className="mt-2 text-center text-[14px] text-slate-300 sm:text-[15px]">
          {heroSubtitle || DEFAULT_HERO_SUBTITLE}
        </p>

        <form
          onSubmit={(e) => { e.preventDefault(); handleSearch(); }}
          className="mx-auto mt-6 max-w-5xl overflow-visible rounded-lg bg-white shadow-lg sm:mt-8"
        >
          {/* Buy / Rent — tabs along the top edge of the panel. */}
          <div role="tablist" aria-label="Purpose" className="flex border-b border-slate-200 px-2">
            {([
              ['buy', 'Buy'],
              ['rent', 'Rent'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={purpose === value}
                onClick={() => setPurpose(value)}
                className={cn(
                  '-mb-px border-b-2 px-4 py-3 text-[14px] font-semibold transition-colors',
                  purpose === value
                    ? 'border-primary text-primary'
                    : 'border-transparent text-slate-500 hover:text-slate-900',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2.5 p-3 sm:p-4 lg:grid-cols-[1fr_1fr_1fr_1.4fr_auto] lg:gap-3">
            <label className="relative col-span-1">
              <span className="sr-only">City</span>
              <select
                value={city}
                onChange={(e) => {
                  const sel = e.target.value;
                  setCity(sel);
                  setCityId(cityList.find(c => c.name === sel)?._id || '');
                }}
                className={selectClass}
              >
                <option value="">All cities</option>
                {cityList.map((c) => <option key={c._id} value={c.name}>{toTitleCase(c.name)}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </label>

            <label className="relative col-span-1">
              <span className="sr-only">Area</span>
              <select
                value={area}
                onChange={(e) => {
                  const sel = e.target.value;
                  setArea(sel);
                  setAreaSlug(areaList.find(a => a.name === sel)?.areaSlug || '');
                }}
                disabled={!city || areaList.length === 0}
                className={selectClass}
              >
                <option value="">
                  {!city ? 'Select city first' : loadingAreas ? 'Loading areas…' : areaList.length > 0 ? 'All areas' : 'No areas'}
                </option>
                {areaList.map((a) => <option key={a._id} value={a.name}>{toTitleCase(a.name)}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </label>

            <label className="relative col-span-2 lg:col-span-1">
              <span className="sr-only">Property type</span>
              <select value={type} onChange={(e) => setType(e.target.value)} className={selectClass}>
                <option value="">All property types</option>
                {propertyTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </label>

            <div ref={searchRef} className="relative col-span-2 lg:col-span-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => filteredSuggestions.length > 0 && setShowSuggestions(true)}
                placeholder="Keyword, society or building"
                aria-label="Keyword"
                className="h-11 w-full rounded-md border border-slate-300 bg-white pl-9 pr-9 text-[14px] text-slate-900 outline-none transition-colors placeholder:text-slate-400 hover:border-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={clearSearch}
                  aria-label="Clear"
                  className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}

              {showSuggestions && filteredSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-[360px] overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg lg:left-auto lg:w-[460px]">
                  {filteredSuggestions.map((property) => (
                    <button
                      key={property.id}
                      type="button"
                      onClick={() => handlePropertyClick(property)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-500">
                        <Home className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium text-slate-900">{property.name}</span>
                        <span className="flex items-center gap-1 truncate text-[12px] text-slate-500">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {[property.location, toTitleCase(property.city)].filter(Boolean).join(', ')}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-[13px] font-semibold text-slate-900">
                          PKR {amountShort(property.price) || property.price}
                        </span>
                        <span className="block text-[11px] capitalize text-slate-400">{property.type}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="col-span-2 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-6 text-[15px] font-semibold text-white transition-colors hover:bg-primary/90 lg:col-span-1"
            >
              <Search className="h-4 w-4" />
              Find
            </button>
          </div>
        </form>
      </div>
    </section>
  );
};

export default HeroSection;

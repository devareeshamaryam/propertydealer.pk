 'use client'
import { useState, useEffect, useRef } from 'react';
import { Search, X, MapPin, Home, Map, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { propertyApi, cityApi, areaApi } from '@/lib/api';
import { mapBackendToFrontendProperty, BackendProperty, sortPropertyTypes } from '@/lib/types/property-utils';
import { Property } from '@/lib/data';
import { toTitleCase } from '@/lib/utils';

interface HeroSectionProps {
  initialCities?: any[];
  initialProperties?: any[];
  initialTypes?: string[];
}

const CITY_ORDER = ['lahore', 'islamabad', 'karachi', 'multan', 'gujranwala', 'faisalabad'];
const POPULAR_CITIES = ['lahore', 'islamabad', 'karachi', 'rawalpindi', 'faisalabad', 'multan'];

const HeroSection: React.FC<HeroSectionProps> = ({ initialCities, initialProperties, initialTypes }) => {
  const router = useRouter();
  const [purpose, setPurpose] = useState<'rent' | 'buy'>('rent');
  const [city, setCity] = useState(initialCities?.[0]?.name || '');
  const [cityId, setCityId] = useState(initialCities?.[0]?._id || '');
  const [area, setArea] = useState('');
  const [areaId, setAreaId] = useState('');
  const [areaSlug, setAreaSlug] = useState('');
  const [type, setType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<Property[]>([]);
  const [allProperties, setAllProperties] = useState<Property[]>(initialProperties || []);
  const [cityList, setCityList] = useState<{ _id: string; name: string }[]>(initialCities || []);
  const [areaList, setAreaList] = useState<{ _id: string; name: string; areaSlug: string }[]>([]);
  const [propertyTypes, setPropertyTypes] = useState<string[]>(initialTypes ? sortPropertyTypes(initialTypes, t => t) : []);
  const [loading, setLoading] = useState(!initialCities || !initialProperties || !initialTypes);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Mobile modal states
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showCityModal, setShowCityModal] = useState(false);
  const [citySearch, setCitySearch] = useState('');

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
        setLoading(true);
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
        const transformedProperties = backendProperties.map(mapBackendToFrontendProperty);
        setAllProperties(transformedProperties);
        const mappedTypes = typesData.map((t: string) => t.charAt(0).toUpperCase() + t.slice(1));
        setPropertyTypes(sortPropertyTypes(mappedTypes, t => t));
        if (sortedCities.length > 0 && !city) {
          setCity(sortedCities[0].name);
          setCityId(sortedCities[0]._id);
        }
      } catch (error) {
        console.error('Error fetching initial data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, [initialCities, initialProperties, initialTypes]);

  useEffect(() => {
    const fetchAreas = async () => {
      if (!cityId) { setAreaList([]); setArea(''); setAreaId(''); return; }
      try {
        setLoadingAreas(true);
        const areasData = await areaApi.getAreasByCity(cityId);
        const sortedAreas = (areasData as any[]).sort((a, b) => a.name.localeCompare(b.name));
        setAreaList(sortedAreas);
        setArea(''); setAreaId(''); setAreaSlug('');
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
        } catch (error) {
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

  const handleMobileFind = () => {
    setShowFilterModal(false);
    handleSearch();
  };

  const handleCitySelect = (selectedCity: any) => {
    setCity(selectedCity.name);
    setCityId(selectedCity._id);
  };

  const popularCities = cityList.filter(c => POPULAR_CITIES.includes(c.name.toLowerCase()));
  const allCitiesFiltered = citySearch
    ? cityList.filter(c => c.name.toLowerCase().includes(citySearch.toLowerCase()))
    : cityList;
  const otherCities = citySearch
    ? allCitiesFiltered
    : cityList.filter(c => !POPULAR_CITIES.includes(c.name.toLowerCase()));

  return (
    <>
      {/* ============================================================
          DESKTOP LAYOUT — unchanged
      ============================================================ */}
      <div className="hidden md:flex relative min-h-[400px] items-center justify-center overflow-hidden bg-white">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(216,180,254,0.3)_0%,transparent_60%)]"></div>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(191,219,254,0.25)_0%,transparent_60%)]"></div>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(251,207,232,0.2)_0%,transparent_60%)]"></div>
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(255,255,255,0.8)_100%)]"></div>
        </div>
        <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-24">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-gray-900 mb-6 drop-shadow-sm">
              Find Your Perfect{' '}
              <span className="relative inline-block text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-gray-700 to-gray-900">
                Home
                <div className="absolute -bottom-2 left-0 w-full h-1.5 bg-black/80 rounded-full transform scale-x-0 animate-expand-width origin-left"></div>
              </span>
              <br />
              {' '}in Pakistan
            </h2>
          </div>
          <div className="max-w-4xl mx-auto">
            <div className="relative bg-white/80 backdrop-blur-sm rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-black/15 p-6 md:p-8 transition-shadow duration-300 hover:shadow-[0_25px_60px_rgba(0,0,0,0.15)]">
              <div ref={searchRef} className="relative mb-8">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => searchQuery.length > 0 && setShowSuggestions(true)}
                    placeholder="Search by building, area, or city..."
                    className="w-full h-14 pl-14 pr-12 rounded-2xl border border-gray-300 bg-white focus:border-black focus:ring-4 focus:ring-black/5 outline-none transition-colors duration-200 text-gray-900 font-medium placeholder:text-gray-400"
                  />
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
                  {searchQuery && (
                    <button onClick={clearSearch} className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 hover:bg-gray-100 rounded-full transition-colors">
                      <X className="w-4 h-4 text-gray-500" />
                    </button>
                  )}
                </div>
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <div className="absolute top-[calc(100%+0.75rem)] left-0 right-0 bg-white border border-gray-200 rounded-2xl shadow-2xl max-h-[400px] overflow-y-auto z-50 p-2">
                    {filteredSuggestions.map((property) => (
                      <button key={property.id} onClick={() => handlePropertyClick(property)} className="w-full flex items-center gap-4 p-3 hover:bg-gray-50 rounded-xl transition-colors duration-150 text-left">
                        <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                          <Home className="w-6 h-6 text-gray-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-gray-900 truncate">{property.name}</h4>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <MapPin className="w-3.5 h-3.5" />
                            <span>{property.location}, {toTitleCase(property.city)}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-black text-black">{property.price.toLocaleString()}</div>
                          <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">{property.type}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="flex bg-gray-100 p-1.5 rounded-2xl w-full md:w-auto border border-gray-200">
                  <button onClick={() => setPurpose('rent')} className={`flex-1 md:w-28 py-2.5 rounded-xl text-sm font-bold transition-colors duration-200 border ${purpose === 'rent' ? 'bg-black text-white border-black shadow-md' : 'text-gray-500 hover:text-black border-transparent'}`}>For Rent</button>
                  <button onClick={() => setPurpose('buy')} className={`flex-1 md:w-28 py-2.5 rounded-xl text-sm font-bold transition-colors duration-200 border ${purpose === 'buy' ? 'bg-black text-white border-black shadow-md' : 'text-gray-500 hover:text-black border-transparent'}`}>For Sale</button>
                </div>
                <div className="hidden md:block w-px h-8 bg-gray-200 mx-2"></div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1 w-full">
                  <div className="relative">
                    <select value={city} onChange={(e) => { const sel = e.target.value; setCity(sel); const found = cityList.find(c => c.name === sel); setCityId(found?._id || ''); }} className="w-full h-12 pl-4 pr-10 rounded-xl border border-gray-300 bg-white hover:border-black transition-colors duration-200 appearance-none text-sm font-semibold cursor-pointer outline-none focus:border-black">
                      <option value="">All Cities</option>
                      {cityList.map((c) => <option key={c._id} value={c.name}>{toTitleCase(c.name)}</option>)}
                    </select>
                    <MapPin className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                  <div className="relative">
                    <select value={area} onChange={(e) => { const sel = e.target.value; setArea(sel); const found = areaList.find(a => a.name === sel); setAreaId(found?._id || ''); setAreaSlug(found?.areaSlug || ''); }} disabled={!city || areaList.length === 0} className="w-full h-12 pl-4 pr-10 rounded-xl border border-gray-300 bg-white hover:border-black transition-colors duration-200 appearance-none text-sm font-semibold cursor-pointer outline-none focus:border-black disabled:opacity-50">
                      <option value="">{city ? (areaList.length > 0 ? 'All Areas' : 'No Areas') : 'Select City'}</option>
                      {areaList.map((a) => <option key={a._id} value={a.name}>{toTitleCase(a.name)}</option>)}
                    </select>
                    <Map className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                  <div className="relative">
                    <select value={type} onChange={(e) => setType(e.target.value)} className="w-full h-12 pl-4 pr-10 rounded-xl border border-gray-300 bg-white hover:border-black transition-colors duration-200 appearance-none text-sm font-semibold cursor-pointer outline-none focus:border-black">
                      <option value="">Property Type</option>
                      {propertyTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <Home className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <button onClick={handleSearch} className="w-full md:w-auto h-12 px-8 rounded-xl bg-black text-white font-bold hover:bg-gray-800 border border-black transition-colors duration-200 flex items-center justify-center gap-2 shadow-lg">
                  <Search className="w-5 h-5" />
                  <span>Find</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        <style jsx>{`
          @keyframes expand { from { transform: scaleX(0); } to { transform: scaleX(1); } }
          .animate-expand-width { animation: expand 1s cubic-bezier(0.16, 1, 0.3, 1) forwards; animation-delay: 0.5s; }
        `}</style>
      </div>

      {/* ============================================================
          MOBILE LAYOUT — white top, wave bottom with thin black line
      ============================================================ */}
      <div className="md:hidden bg-white relative">
        <div className="bg-white px-4 pt-20 pb-4">

          {/* Hero Text */}
          <p className="text-center text-sm font-bold text-gray-800 mb-5 tracking-wide">
             Find your perfect home in Pakistan
          </p>

          {/* Buy / Rent Buttons */}
          <div className="flex gap-2 justify-center mb-4">
            <button
              onClick={() => { setPurpose('buy'); setShowFilterModal(true); }}
              className="w-32 py-2.5 rounded-full text-sm font-bold bg-black text-white active:bg-gray-900 transition-colors tracking-wide"
            >
              BUY
            </button>
            <button
              onClick={() => { setPurpose('rent'); setShowFilterModal(true); }}
              className="w-32 py-2.5 rounded-full text-sm font-bold bg-black text-white active:bg-gray-900 transition-colors tracking-wide"
            >
              RENT
            </button>
          </div>

          {/* Search Bar — pill shape, same total width as both buttons + gap */}
          <div ref={searchRef} className="relative flex justify-center">
            <div className="flex items-center bg-gray-100 rounded-full px-4 py-2.5 gap-2 border border-gray-200 w-[290px]">
              <Search className="w-4 h-4 text-black shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery.length > 0 && setShowSuggestions(true)}
                placeholder="Search by area or city..."
                className="bg-transparent outline-none text-xs text-gray-700 placeholder:text-gray-400 font-medium flex-1"
              />
              {searchQuery && (
                <button onClick={clearSearch}>
                  <X className="w-3.5 h-3.5 text-gray-400" />
                </button>
              )}
            </div>
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div className="absolute top-[calc(100%+0.5rem)] left-0 right-0 bg-white border border-gray-200 rounded-2xl shadow-2xl max-h-[300px] overflow-y-auto z-50 p-2">
                {filteredSuggestions.map((property) => (
                  <button key={property.id} onClick={() => handlePropertyClick(property)} className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl transition-colors text-left">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                      <Home className="w-5 h-5 text-gray-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 truncate text-sm">{property.name}</p>
                      <p className="text-xs text-gray-500">{property.location}, {toTitleCase(property.city)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Wave bottom shape — white bg upar, neeche curve + thin black line */}
        <div className="w-full overflow-hidden leading-[0]" style={{ height: '44px', marginTop: '-1px' }}>
          <svg
            viewBox="0 0 390 44"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="none"
            className="w-full h-full"
          >
            {/* White fill covering top portion down to the wave */}
            <path
              d="M0,0 L0,22 Q97.5,46 195,22 Q292.5,-2 390,22 L390,0 Z"
              fill="white"
            />
            {/* Thin black stroke line along the wave */}
            <path
              d="M0,22 Q97.5,46 195,22 Q292.5,-2 390,22"
              fill="none"
              stroke="black"
              strokeWidth="1.5"
            />
          </svg>
        </div>
      </div>

      {/* ============================================================
          MOBILE — Filter Modal (Full Screen)
      ============================================================ */}
      {showFilterModal && (
        <div className="md:hidden fixed inset-0 z-50 bg-white flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-bold text-black">Find a Property</h2>
            <button
              onClick={() => setShowFilterModal(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-black font-bold text-sm"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
            {/* Buy / Rent Toggle */}
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">I want to</p>
              <div className="flex bg-gray-100 rounded-2xl p-1 gap-1">
                <button
                  onClick={() => setPurpose('buy')}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${purpose === 'buy' ? 'bg-black text-white' : 'text-gray-500'}`}
                >
                  Buy
                </button>
                <button
                  onClick={() => setPurpose('rent')}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${purpose === 'rent' ? 'bg-black text-white' : 'text-gray-500'}`}
                >
                  Rent
                </button>
              </div>
            </div>

            {/* City */}
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">City</p>
              <button
                onClick={() => setShowCityModal(true)}
                className="w-full flex items-center justify-between px-4 py-3 border-2 border-gray-200 rounded-2xl hover:border-black transition-colors"
              >
                <div className="text-left">
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest">Selected</p>
                  <p className="text-sm font-bold text-black">{city ? toTitleCase(city) : 'All Cities'}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* Area */}
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Area</p>
              <div className="relative">
                <select
                  value={area}
                  onChange={(e) => {
                    const sel = e.target.value;
                    setArea(sel);
                    const found = areaList.find(a => a.name === sel);
                    setAreaId(found?._id || '');
                    setAreaSlug(found?.areaSlug || '');
                  }}
                  disabled={!city || areaList.length === 0}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl text-sm font-bold text-black appearance-none outline-none focus:border-black disabled:opacity-40 bg-white"
                >
                  <option value="">{city ? (areaList.length > 0 ? 'All Areas' : 'No Areas') : 'Select City First'}</option>
                  {areaList.map((a) => <option key={a._id} value={a.name}>{toTitleCase(a.name)}</option>)}
                </select>
                <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none rotate-90" />
              </div>
            </div>

            {/* Property Type */}
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Property Type</p>
              <div className="relative">
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl text-sm font-bold text-black appearance-none outline-none focus:border-black bg-white"
                >
                  <option value="">All Types</option>
                  {propertyTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none rotate-90" />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 pb-8 pt-4 border-t border-gray-100 space-y-3">
            <button
              onClick={handleMobileFind}
              className="w-full py-4 bg-black text-white font-bold text-base rounded-2xl active:bg-gray-900 transition-colors"
            >
              Find Properties
            </button>
            <button
              onClick={() => {
                setCity(initialCities?.[0]?.name || '');
                setCityId(initialCities?.[0]?._id || '');
                setArea(''); setAreaId(''); setAreaSlug('');
                setType(''); setPurpose('rent');
              }}
              className="w-full py-3 text-sm font-semibold text-gray-400 text-center"
            >
              Reset Filters
            </button>
          </div>
        </div>
      )}

      {/* ============================================================
          MOBILE — City Select Modal (Full Screen)
      ============================================================ */}
      {showCityModal && (
        <div className="md:hidden fixed inset-0 z-[60] bg-white flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-bold text-black">Select City</h2>
            <button
              onClick={() => setShowCityModal(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-black font-bold text-sm"
            >
              ✕
            </button>
          </div>

          <div className="px-5 pt-4 pb-2">
            <input
              type="text"
              value={citySearch}
              onChange={(e) => setCitySearch(e.target.value)}
              placeholder="Search city..."
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl text-sm font-medium text-black outline-none focus:border-black placeholder:text-gray-400 bg-gray-50"
            />
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-2">
            {!citySearch && popularCities.length > 0 && (
              <>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mt-3 mb-2">Popular Cities</p>
                {popularCities.map((c) => (
                  <button
                    key={c._id}
                    onClick={() => { handleCitySelect(c); setCitySearch(''); setShowCityModal(false); }}
                    className={`w-full text-left py-3 text-sm border-b border-gray-50 transition-colors ${city === c.name ? 'font-bold text-black' : 'font-medium text-gray-700'}`}
                  >
                    {toTitleCase(c.name)}
                  </button>
                ))}
              </>
            )}
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mt-4 mb-2">
              {citySearch ? 'Results' : 'All Cities'}
            </p>
            {(citySearch ? allCitiesFiltered : otherCities).map((c) => (
              <button
                key={c._id}
                onClick={() => { handleCitySelect(c); setCitySearch(''); setShowCityModal(false); }}
                className={`w-full text-left py-3 text-sm border-b border-gray-50 transition-colors ${city === c.name ? 'font-bold text-black' : 'font-medium text-gray-700'}`}
              >
                {toTitleCase(c.name)}
              </button>
            ))}
          </div>

          <div className="px-5 pb-8 pt-4 border-t border-gray-100">
            <button
              onClick={() => setShowCityModal(false)}
              className="w-full py-4 bg-black text-white font-bold text-base rounded-2xl active:bg-gray-900 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default HeroSection;
'use client'
import { useState, useEffect, useRef } from 'react';
import { Search, X, MapPin, Home, Loader2, Map } from 'lucide-react';
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

  // Helper function to convert city name to slug
  const cityToSlug = (cityName: string): string => {
    return cityName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  // Helper function to convert property type to slug
  const typeToSlug = (typeName: string): string => {
    return typeName.toLowerCase().trim();
  };

  // Fetch initial data if not provided via props or if they are empty arrays (server fetch failure)
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

          // If both are in CITY_ORDER, use their specific order
          if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;

          // If only one is in CITY_ORDER, it comes first
          if (aIndex !== -1) return -1;
          if (bIndex !== -1) return 1;

          // Otherwise, sort alphabetically
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

  // Fetch areas when city changes
  useEffect(() => {
    const fetchAreas = async () => {
      if (!cityId) {
        setAreaList([]);
        setArea('');
        setAreaId('');
        return;
      }

      try {
        setLoadingAreas(true);
        const areasData = await areaApi.getAreasByCity(cityId);
        const sortedAreas = (areasData as any[]).sort((a, b) => a.name.localeCompare(b.name));
        setAreaList(sortedAreas);

        // Reset area when city changes
        setArea('');
        setAreaId('');
        setAreaSlug('');
      } catch (error) {
        console.error('Error fetching areas:', error);
        setAreaList([]);
      } finally {
        setLoadingAreas(false);
      }
    };

    fetchAreas();
  }, [cityId]);

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter suggestions based on search query
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchQuery.trim().length >= 2) {
        const searchTerm = searchQuery.toLowerCase().trim();

        try {
          // Fetch from API using search filter
          const response = await propertyApi.getAll({
            search: searchTerm,
            limit: 8
          });

          let backendProperties: BackendProperty[] = [];
          if (Array.isArray(response)) {
            backendProperties = response;
          } else if (response && (response as any).properties) {
            backendProperties = (response as any).properties;
          }

          const transformed = backendProperties.map(mapBackendToFrontendProperty);
          setFilteredSuggestions(transformed);
          setShowSuggestions(transformed.length > 0);
        } catch (error) {
          console.error('Error fetching suggestions:', error);
          // Fallback to local filtering if API fails
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

    const timeoutId = setTimeout(fetchSuggestions, 300); // Debounce
    return () => clearTimeout(timeoutId);
  }, [searchQuery, allProperties]);

  const handleSearch = () => {
    const purposeSlug = purpose === 'buy' ? 'sale' : 'rent';
    const typeSlug = type ? typeToSlug(type) : 'all';

    const params = new URLSearchParams();
    // If we have an area slug, we use it in the path, otherwise use it as query param if no slug
    // if (areaId && !areaSlug) params.set('areaId', areaId); 
    if (searchQuery) params.set('search', searchQuery);

    const queryString = params.toString();
    const suffix = queryString ? `?${queryString}` : '';

    if (!city) {
      router.push(`/properties${suffix}`);
      return;
    }

    const citySlug = cityToSlug(city);

    // SEO-friendly path: /properties/[purpose]/[city]/[area-or-type]
    // Priority: Area Slug > Type Slug
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

  const clearSearch = () => {
    setSearchQuery('');
    setShowSuggestions(false);
  };

  return (
    <div className="relative min-h-[400px] flex items-center justify-center overflow-hidden bg-white">
      {/* Animated Mesh Gradient Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 opacity-40">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-200 blur-[100px] animate-blob"></div>
          <div className="absolute top-[20%] right-[-5%] w-[35%] h-[35%] rounded-full bg-blue-100 blur-[100px] animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-[-10%] left-[20%] w-[45%] h-[45%] rounded-full bg-pink-100 blur-[100px] animate-blob animation-delay-4000"></div>
          <div className="absolute top-[40%] left-[40%] w-[30%] h-[30%] rounded-full bg-indigo-50 blur-[80px] animate-pulse"></div>
        </div>

        {/* Subtle Grid Pattern Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]"></div>

        {/* Soft Radial Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(255,255,255,0.8)_100%)]"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12 md:py-20 lg:py-24">
        {/* Main Heading with Premium Typography */}
        <div className="text-center mb-10 md:mb-16">
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-gray-900 mb-6 drop-shadow-sm">
            Find Your Perfect{' '}
            <span className="relative inline-block text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-gray-700 to-gray-900">
              Home
              <div className="absolute -bottom-2 left-0 w-full h-1.5 bg-black/80 rounded-full transform scale-x-0 animate-expand-width origin-left"></div>
            </span>
            <br className="hidden md:block" />
            {' '}in Pakistan
          </h2>
          {/* <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto font-medium opacity-80">
            Premium properties, verified listings, and seamless experiences.
          </p> */}
        </div>

        {/* Search Box with Glassmorphism */}
        <div className="max-w-4xl mx-auto">
          <div className="relative backdrop-blur-xl bg-white/60 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-black/15 p-6 md:p-8 hover:shadow-[0_25px_60px_rgba(0,0,0,0.15)] transition-all duration-500 group">

            {/* Search Input Area */}
            <div ref={searchRef} className="relative mb-8">
              <div className="relative group/input">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => searchQuery.length > 0 && setShowSuggestions(true)}
                  placeholder="Search by building, area, or city..."
                  className="w-full h-14 pl-14 pr-12 rounded-2xl border border-gray-300 bg-white/80 focus:bg-white focus:border-black focus:ring-4 focus:ring-black/5 outline-none transition-all duration-300 text-gray-900 font-medium placeholder:text-gray-400"
                />
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400 transition-colors group-focus-within/input:text-black" />
                {searchQuery && (
                  <button
                    onClick={clearSearch}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                )}
              </div>

              {/* Suggestions Dropdown - Glassmorphism */}
              {showSuggestions && filteredSuggestions.length > 0 && (
                <div className="absolute top-[calc(100%+0.75rem)] left-0 right-0 bg-white/95 backdrop-blur-md border border-gray-300 rounded-2xl shadow-2xl max-h-[400px] overflow-y-auto z-50 p-2">
                  {filteredSuggestions.map((property) => (
                    <button
                      key={property.id}
                      onClick={() => handlePropertyClick(property)}
                      className="w-full flex items-center gap-4 p-3 hover:bg-black/5 rounded-xl transition-all duration-200 text-left group/item"
                    >
                      <div className="w-12 h-12 bg-black/5 rounded-lg flex items-center justify-center shrink-0">
                        <Home className="w-6 h-6 text-gray-600 group-hover/item:text-black" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-900 truncate">
                          {property.name}
                        </h4>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <MapPin className="w-3.5 h-3.5" />
                          <span>{property.location}, {toTitleCase(property.city)}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-black">
                          {property.price.toLocaleString()}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">
                          {property.type}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Controls Bar */}
            <div className="flex flex-col md:flex-row items-center gap-4">
              {/* Type Toggle */}
              <div className="flex bg-gray-100/80 p-1.5 rounded-2xl w-full md:w-auto border border-gray-200">
                <button
                  onClick={() => setPurpose('rent')}
                  className={`flex-1 md:w-28 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 border ${purpose === 'rent' ? 'bg-black text-white border-black shadow-xl' : 'text-gray-500 hover:text-black hover:bg-white/50 border-transparent'
                    }`}
                >
                  For Rent
                </button>
                <button
                  onClick={() => setPurpose('buy')}
                  className={`flex-1 md:w-28 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 border ${purpose === 'buy' ? 'bg-black text-white border-black shadow-xl' : 'text-gray-500 hover:text-black hover:bg-white/50 border-transparent'
                    }`}
                >
                  For Sale
                </button>
              </div>

              {/* Separation Line for Desktop */}
              <div className="hidden md:block w-px h-8 bg-gray-200 mx-2"></div>

              {/* Filters Group */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1 w-full">
                {/* City Select */}
                <div className="relative group/select">
                  <select
                    value={city}
                    onChange={(e) => {
                      const selectedCityName = e.target.value;
                      setCity(selectedCityName);
                      const selectedCity = cityList.find(c => c.name === selectedCityName);
                      setCityId(selectedCity?._id || '');
                    }}
                    className="w-full h-12 pl-4 pr-10 rounded-xl border border-gray-300 bg-white/50 hover:bg-white hover:border-black transition-all appearance-none text-sm font-semibold cursor-pointer outline-none focus:border-black"
                  >
                    <option value="">All Cities</option>
                    {cityList.map((c) => (
                      <option key={c._id} value={c.name}>{toTitleCase(c.name)}</option>
                    ))}
                  </select>
                  <MapPin className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none group-hover/select:text-black transition-colors" />
                </div>

                {/* Area Select */}
                <div className="relative group/select">
                  <select
                    value={area}
                    onChange={(e) => {
                      const selectedAreaName = e.target.value;
                      setArea(selectedAreaName);
                      const selectedArea = areaList.find(a => a.name === selectedAreaName);
                      setAreaId(selectedArea?._id || '');
                      setAreaSlug(selectedArea?.areaSlug || '');
                    }}
                    disabled={!city || areaList.length === 0}
                    className="w-full h-12 pl-4 pr-10 rounded-xl border border-gray-300 bg-white/50 hover:bg-white hover:border-black transition-all appearance-none text-sm font-semibold cursor-pointer outline-none focus:border-black disabled:opacity-50"
                  >
                    <option value="">{city ? (areaList.length > 0 ? 'All Areas' : 'No Areas') : 'Select City'}</option>
                    {areaList.map((a) => (
                      <option key={a._id} value={a.name}>{toTitleCase(a.name)}</option>
                    ))}
                  </select>
                  <Map className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none group-hover/select:text-black transition-colors" />
                </div>

                {/* Type Select */}
                <div className="relative group/select">
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full h-12 pl-4 pr-10 rounded-xl border border-gray-300 bg-white/50 hover:bg-white hover:border-black transition-all appearance-none text-sm font-semibold cursor-pointer outline-none focus:border-black"
                  >
                    <option value="">Property Type</option>
                    {propertyTypes.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <Home className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none group-hover/select:text-black transition-colors" />
                </div>
              </div>

              {/* Search Button */}
              <button
                onClick={handleSearch}
                className="w-full md:w-auto h-12 px-8 rounded-xl bg-black text-white font-bold hover:bg-gray-800 border border-black transition-all flex items-center justify-center gap-2 shadow-xl hover:shadow-black/20"
              >
                <Search className="w-5 h-5" />
                <span>Find</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        @keyframes expand {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        .animate-expand-width {
          animation: expand 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          animation-delay: 0.5s;
        }
      `}</style>
    </div>
  );
};

export default HeroSection;
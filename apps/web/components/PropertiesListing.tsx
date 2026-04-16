 'use client'

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SlidersHorizontal, Loader2, X, MapPin, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PropertyCard from '@/components/PropertyCard';
import { propertyApi, cityApi } from '@/lib/api';
import { areaApi } from '@/lib/api/area/area.api';
import { mapBackendToFrontendProperty, BackendProperty } from '@/lib/types/property-utils';
import { Property } from '@/lib/data';
import { toast } from 'sonner';
import SearchSidebar from '@/components/SearchSidebar';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { cn, toTitleCase } from '@/lib/utils';

interface PropertiesListingProps {
  purpose: 'rent' | 'buy' | 'all';
  city?: string;
  type?: string;
  useCleanUrls?: boolean;
  richDescription?: string;
  areaId?: string;
  areaSlug?: string;
  initialMarla?: number;
  initialProperties?: Property[];
}

interface AreaOption {
  id: string;
  name: string;
  slug?: string;
  count: number;
}

const MARLA_OPTIONS = [2, 3, 5, 10];
const SIZE_OPTIONS: { label: string; marlaMin: number; marlaMax: number }[] = [
  { label: '2 Marla',  marlaMin: 2,  marlaMax: 2  },
  { label: '3 Marla',  marlaMin: 3,  marlaMax: 3  },
  { label: '5 Marla',  marlaMin: 5,  marlaMax: 5  },
  { label: '10 Marla', marlaMin: 10, marlaMax: 10 },
  { label: '1 Kanal',  marlaMin: 20, marlaMax: 20 },
];

export default function PropertiesListing({
  purpose,
  city: initialCity = '',
  type: initialType = 'all',
  useCleanUrls = false,
  richDescription,
  areaId: initialAreaId,
  areaSlug: initialAreaSlug,
  initialMarla,
  initialProperties,
}: PropertiesListingProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [properties, setProperties]             = useState<Property[]>(initialProperties ?? []);
  const [allCities, setAllCities]               = useState<any[]>([]);
  const [allPropertyTypes, setAllPropertyTypes] = useState<string[]>([]);
  const [loading, setLoading]                   = useState(!initialProperties);
  const [error, setError]                       = useState<string | null>(null);
  const [city, setCity]                         = useState(initialCity);
  const [type, setType]                         = useState(initialType);
  const [tempCity, setTempCity]                 = useState(initialCity);
  const [tempType, setTempType]                 = useState(initialType);
  const [currentPage, setCurrentPage]           = useState(1);
  const [totalPages, setTotalPages]             = useState(1);
  const [isFetchingMore, setIsFetchingMore]     = useState(false);
  const [selectedMarla, setSelectedMarla]       = useState<number | null>(initialMarla ?? null);

  const [isFilterSheetOpen,   setIsFilterSheetOpen]   = useState(false);
  const [isLocationPanelOpen, setIsLocationPanelOpen] = useState(false);

  const [mainAreas,        setMainAreas]        = useState<AreaOption[]>([]);
  const [loadingMainAreas, setLoadingMainAreas] = useState(false);
  const [allAreas,         setAllAreas]         = useState<AreaOption[]>([]);
  const [loadingAllAreas,  setLoadingAllAreas]  = useState(false);

  const [sheetCity,     setSheetCity]     = useState('');
  const [sheetType,     setSheetType]     = useState('all');
  const [sheetAreaId,   setSheetAreaId]   = useState('');
  const [sheetAreaSlug, setSheetAreaSlug] = useState('');
  const [sheetAreas,    setSheetAreas]    = useState<AreaOption[]>([]);
  const [loadingAreas,  setLoadingAreas]  = useState(false);
  const [showAllAreas,  setShowAllAreas]  = useState(false);

  const [sheetPriceMin, setSheetPriceMin] = useState('');
  const [sheetPriceMax, setSheetPriceMax] = useState('');
  const [sheetMarlaMin, setSheetMarlaMin] = useState('');
  const [sheetMarlaMax, setSheetMarlaMax] = useState('');
  const [sheetBeds,     setSheetBeds]     = useState<number | undefined>();
  const [sheetBaths,    setSheetBaths]    = useState<number | undefined>();

  const [advancedFilters, setAdvancedFilters] = useState<{
    priceMin?: number; priceMax?: number;
    marlaMin?: number; marlaMax?: number;
    beds?: number;     baths?: number;
  }>(initialMarla ? { marlaMin: initialMarla, marlaMax: initialMarla } : {});

  const handleFilterChange = (newFilters: any) => {
    setAdvancedFilters(newFilters);
    setCurrentPage(1);
  };

  const cityToSlug = (name: string) =>
    name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  const slugToCity = (slug: string, list: string[]): string | null => {
    const ns = slug.toLowerCase().trim();
    const exact = list.find(c => cityToSlug(c) === ns);
    if (exact) return exact;
    const fl = ns.split('-').map((w: string) => w[0] || '').join('');
    const abbr = list.find(c => c.toLowerCase().split(/\s+/).map((w: string) => w[0] || '').join('') === fl);
    if (abbr) return abbr;
    return list.find(c => cityToSlug(c).startsWith(ns) || ns.startsWith(cityToSlug(c).substring(0, 3))) || null;
  };

  const cities = useMemo(() => {
    if (allCities?.length) return allCities.map(c => c.name).sort();
    return Array.from(new Set(
      properties.map((p: Property) => p.city).filter((c): c is string => !!c)
    )).sort();
  }, [properties, allCities]);

  const matchedCity = useMemo(() => {
    if (!city) return '';
    if (!cities.length) return city;
    if (cities.includes(city)) return city;
    return cities.find(c => c.toLowerCase() === city.toLowerCase()) || slugToCity(city, cities) || city;
  }, [city, cities]);

  const propertyTypes = useMemo(() => {
    if (allPropertyTypes?.length)
      return allPropertyTypes.map(t => t.charAt(0).toUpperCase() + t.slice(1)).sort();
    const valid: Property['type'][] = ['House','Apartment','Flat','Commercial','Office','Plot','Land','Shop','Factory','Hotel','Restaurant','Other'];
    return Array.from(new Set(
      properties.map((p: Property) => p.type).filter((t): t is Property['type'] => valid.includes(t))
    )).sort();
  }, [properties, allPropertyTypes]);

  const typeLabel = (t: string) => {
    const map: Record<string, string> = {
      House: 'Houses', Apartment: 'Apartments', Flat: 'Flats',
      Plot: 'Plots', Shop: 'Shops', Office: 'Offices',
      Land: 'Land', Commercial: 'Commercial', Factory: 'Factories',
      Hotel: 'Hotels', Restaurant: 'Restaurants', Other: 'Other',
    };
    return map[t] || `${t}s`;
  };

  // ── URL builder ─────────────────────────────────────────────────────────────
  const buildCleanUrl = (opts: {
    purposeOverride?: string;
    cityOverride?: string;
    typeOverride?: string;
    areaSlugOverride?: string | null;
    marlaOverride?: number | null;
  }) => {
    const pp    = opts.purposeOverride ?? (purpose === 'buy' ? 'sale' : purpose);
    const cs    = opts.cityOverride !== undefined
      ? (opts.cityOverride ? cityToSlug(opts.cityOverride) : '')
      : (matchedCity ? cityToSlug(matchedCity) : '');
    const aSlug = opts.areaSlugOverride !== undefined ? opts.areaSlugOverride : (initialAreaSlug || null);
    const t     = opts.typeOverride !== undefined ? opts.typeOverride : type;
    const marla = opts.marlaOverride !== undefined ? opts.marlaOverride : selectedMarla;

    const tSlug     = t && t !== 'all' ? `/${t.toLowerCase()}` : '';
    const marlaSlug = marla ? `/${marla}marla` : '';
    const areaPath  = aSlug ? `/${aSlug}` : '';

    // FIX 1: No-city case now includes tSlug + marlaSlug
    if (!cs) {
      return `/properties/${pp}${tSlug}${marlaSlug}`;
    }
    return `/properties/${pp}/${cs}${areaPath}${tSlug}${marlaSlug}`;
  };
  // ────────────────────────────────────────────────────────────────────────────

  // FIX 2: handleMarlaClick — supports marla + 1 kanal (20 marla)
  const handleMarlaClick = (marla: number) => {
    const isDeselecting = selectedMarla === marla;
    const newMarla = isDeselecting ? null : marla;

    if (useCleanUrls) {
      if (newMarla === 20) {
        // 1 Kanal → custom URL slug
        const pp    = purpose === 'buy' ? 'sale' : purpose;
        const cs    = matchedCity ? `/${cityToSlug(matchedCity)}` : '';
        const tSlug = type && type !== 'all' ? `/${type.toLowerCase()}` : '';
        router.push(`/properties/${pp}${cs}${tSlug}/1kanal`);
      } else {
        router.push(buildCleanUrl({ marlaOverride: newMarla }));
      }
    } else {
      setSelectedMarla(newMarla);
      handleFilterChange({
        ...advancedFilters,
        marlaMin: newMarla ?? undefined,
        marlaMax: newMarla ?? undefined,
      });
    }
  };

  useEffect(() => {
    if (type.toLowerCase() !== 'house' && type.toLowerCase() !== 'plot') {
      setSelectedMarla(null);
    }
  }, [type]);

  useEffect(() => {
    setSelectedMarla(initialMarla ?? null);
    setAdvancedFilters(initialMarla
      ? { marlaMin: initialMarla, marlaMax: initialMarla }
      : {}
    );
  }, [initialMarla]);

  useEffect(() => {
    (async () => {
      setLoadingAllAreas(true);
      try {
        const data = await areaApi.getAll();
        if (Array.isArray(data)) {
          setAllAreas(data.map((a: any) => ({
            id: a._id, name: a.name, slug: a.slug || '', count: a.count || 0,
          })));
        }
      } catch { setAllAreas([]); }
      finally { setLoadingAllAreas(false); }
    })();
  }, []);

  useEffect(() => {
    if (!sheetCity) { setSheetAreas([]); return; }
    (async () => {
      setLoadingAreas(true);
      try {
        const pt = purpose === 'buy' ? 'sale' : purpose === 'rent' ? 'rent' : undefined;
        const data = await propertyApi.getLocationStats(sheetCity, pt);
        if (data?.locations) {
          setSheetAreas(data.locations.map((l: any) => ({
            id: l.id, name: l.name, slug: l.slug, count: l.count,
          })));
        }
      } catch { setSheetAreas([]); }
      finally { setLoadingAreas(false); }
    })();
  }, [sheetCity, purpose]);

  useEffect(() => {
    if (!matchedCity) { setMainAreas([]); return; }
    setLoadingMainAreas(true);
    (async () => {
      try {
        const pt = purpose === 'buy' ? 'sale' : purpose === 'rent' ? 'rent' : undefined;
        const data = await propertyApi.getLocationStats(matchedCity, pt);
        if (data?.locations) {
          setMainAreas(data.locations.map((l: any) => ({
            id: l.id, name: l.name, slug: l.slug, count: l.count,
          })));
        } else { setMainAreas([]); }
      } catch { setMainAreas([]); }
      finally { setLoadingMainAreas(false); }
    })();
  }, [matchedCity, purpose]);

  useEffect(() => {
    if (!isFilterSheetOpen) return;
    setSheetCity(matchedCity);
    setSheetType(type);
    setSheetAreaId(initialAreaId || searchParams.get('areaId') || '');
    setSheetAreaSlug(initialAreaSlug || '');
    setSheetPriceMin(advancedFilters.priceMin?.toString() || '');
    setSheetPriceMax(advancedFilters.priceMax?.toString() || '');
    setSheetMarlaMin(advancedFilters.marlaMin?.toString() || '');
    setSheetMarlaMax(advancedFilters.marlaMax?.toString() || '');
    setSheetBeds(advancedFilters.beds);
    setSheetBaths(advancedFilters.baths);
    setShowAllAreas(false);
  }, [isFilterSheetOpen]);

  const applySheetFilters = () => {
    handleFilterChange({
      priceMin: sheetPriceMin ? Number(sheetPriceMin) : undefined,
      priceMax: sheetPriceMax ? Number(sheetPriceMax) : undefined,
      marlaMin: sheetMarlaMin ? Number(sheetMarlaMin) : undefined,
      marlaMax: sheetMarlaMax ? Number(sheetMarlaMax) : undefined,
      beds: sheetBeds,
      baths: sheetBaths,
    });
    const params = new URLSearchParams(searchParams.toString());
    if (sheetAreaId) params.set('areaId', sheetAreaId); else params.delete('areaId');
    if (useCleanUrls) {
      params.delete('city'); params.delete('type'); params.delete('purpose');
      const purposePath = purpose === 'buy' ? 'sale' : purpose;
      const citySlug    = sheetCity ? cityToSlug(sheetCity) : '';
      const typeSlug    = sheetType && sheetType !== 'all' ? `/${sheetType.toLowerCase()}` : '';
      const qs          = params.toString();
      const suffix      = qs ? `?${qs}` : '';
      if (sheetAreaSlug && citySlug) {
        router.push(`/properties/${purposePath}/${citySlug}/${sheetAreaSlug}${typeSlug}${suffix}`);
      } else if (citySlug) {
        router.push(`/properties/${purposePath}/${citySlug}${typeSlug}${suffix}`);
      } else {
        router.push(`/properties/${purposePath}${suffix}`);
      }
    } else {
      if (sheetCity) params.set('city', sheetCity); else params.delete('city');
      if (sheetType && sheetType !== 'all') params.set('type', sheetType); else params.delete('type');
      const qs = params.toString();
      router.push(qs ? `/properties?${qs}` : '/properties');
    }
    setIsFilterSheetOpen(false);
  };

  const resetSheetFilters = () => {
    setSheetCity(matchedCity);
    setSheetType('all');
    setSheetAreaId(''); setSheetAreaSlug('');
    setSheetPriceMin(''); setSheetPriceMax('');
    setSheetMarlaMin(''); setSheetMarlaMax('');
    setSheetBeds(undefined); setSheetBaths(undefined);
  };

  useEffect(() => {
    (async () => {
      try {
        if (currentPage === 1) setLoading(true); else setIsFetchingMore(true);
        setError(null);
        const [citiesRes, typesRes] = await Promise.all([cityApi.getAll(), propertyApi.getTypes()]);
        setAllCities(citiesRes);
        setAllPropertyTypes(typesRes);
        const cityToMatch  = matchedCity || city;
        const currentCity  = citiesRes.find((c: any) => c.name.toLowerCase() === cityToMatch.toLowerCase());
        const response = await propertyApi.getAll({
          cityId:   currentCity?._id,
          cityName: cityToMatch,
          areaId:   searchParams.get('areaId') || initialAreaId || undefined,
          search:   searchParams.get('search') || undefined,
          priceMin: advancedFilters.priceMin,
          priceMax: advancedFilters.priceMax,
          marlaMin: advancedFilters.marlaMin,
          marlaMax: advancedFilters.marlaMax,
          beds:     advancedFilters.beds,
          baths:    advancedFilters.baths,
          type:     type !== 'all' ? type : undefined,
          purpose:  purpose !== 'all' ? purpose : undefined,
          page:     currentPage,
          limit:    12,
        });
        let props: BackendProperty[] = [];
        let pages = 1;
        if (Array.isArray(response))   { props = response; }
        else if (response?.properties) { props = response.properties; pages = response.totalPages || 1; }
        const transformed = props.map(mapBackendToFrontendProperty);
        if (currentPage === 1) setProperties(transformed);
        else setProperties(prev => [...prev, ...transformed]);
        setTotalPages(pages);
      } catch (err: any) {
        const msg = err.response?.data?.message || err.message || 'Failed to load data';
        setError(msg);
        toast.error('Error', { description: msg });
      } finally {
        setLoading(false);
        setIsFetchingMore(false);
      }
    })();
  }, [matchedCity, purpose, type, advancedFilters, searchParams, currentPage, initialAreaId]);

  const effectiveRichDescription = useMemo(() => {
    if (richDescription) return richDescription;
    if ((type && type !== 'all') || !!(initialAreaId || initialAreaSlug)) return undefined;
    if (!matchedCity || !allCities.length) return undefined;
    const d = allCities.find(c => c.name.toLowerCase() === matchedCity.toLowerCase());
    if (!d) return undefined;
    return purpose === 'rent' ? d.rentContent : purpose === 'buy' ? d.saleContent : d.description;
  }, [richDescription, matchedCity, allCities, purpose, type, initialAreaId, initialAreaSlug]);

  useEffect(() => {
    setProperties([]);
    setCity(initialCity); setType(initialType);
    setTempCity(initialCity); setTempType(initialType);
    setCurrentPage(1);
    setIsLocationPanelOpen(false);
  }, [initialCity, initialType, purpose, searchParams, initialAreaId, initialAreaSlug]);

  const currentAreaId = useMemo(
    () => searchParams.get('areaId') || initialAreaId || '',
    [searchParams, initialAreaId]
  );

  const updateFilters = (
    newCity: string, newType: string,
    newPurpose?: 'rent' | 'buy' | 'all', forceCleanUrl = false
  ) => {
    const cp  = newPurpose || purpose;
    const use = forceCleanUrl || useCleanUrls;
    const params = new URLSearchParams(searchParams.toString());
    if (use) {
      params.delete('city'); params.delete('type'); params.delete('purpose');
      const pp     = cp === 'buy' ? 'sale' : cp;
      const cSlug  = newCity ? cityToSlug(newCity) : '';
      const tSlug  = newType && newType !== 'all' ? `/${newType.toLowerCase()}` : '';
      const suffix = params.toString() ? `?${params.toString()}` : '';
      router.push(cSlug
        ? `/properties/${pp}/${cSlug}${tSlug}${suffix}`
        : `/properties/${pp}${suffix}`);
    } else {
      if (cp !== 'all') params.set('purpose', cp); else params.delete('purpose');
      if (newCity) params.set('city', newCity);    else params.delete('city');
      if (newType && newType !== 'all') params.set('type', newType); else params.delete('type');
      const qs = params.toString();
      router.push(qs ? `/properties?${qs}` : '/properties');
    }
  };

  // FIX 3: navigateType — removed && matchedCity
  const navigateType = (t: string) => {
    setIsLocationPanelOpen(false);
    const supportsMarla = t === 'house' || t === 'plot';
    const marlaToKeep  = supportsMarla ? selectedMarla : null;

    if (useCleanUrls) {
      router.push(buildCleanUrl({ typeOverride: t, marlaOverride: marlaToKeep }));
    } else {
      const params = new URLSearchParams(searchParams.toString());
      if (t === 'all') params.delete('type'); else params.set('type', t.toLowerCase());
      const qs = params.toString();
      router.push(qs ? `/properties?${qs}` : '/properties');
    }
  };

  const navigateArea = (area: AreaOption) => {
    setIsLocationPanelOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    const isUnselecting = params.get('areaId') === area.id || initialAreaId === area.id;
    if (useCleanUrls && matchedCity) {
      const pp        = purpose === 'buy' ? 'sale' : purpose;
      const cSlug     = cityToSlug(matchedCity);
      const tSlug     = type && type !== 'all' ? `/${type.toLowerCase()}` : '';
      const marlaSlug = selectedMarla ? `/${selectedMarla}marla` : '';
      if (isUnselecting) { router.push(`/properties/${pp}/${cSlug}${tSlug}${marlaSlug}`); return; }
      if (area.slug)     { router.push(`/properties/${pp}/${cSlug}/${area.slug}${tSlug}${marlaSlug}`); return; }
    }
    if (isUnselecting) params.delete('areaId'); else params.set('areaId', area.id);
    const qs = params.toString();
    router.push(`${window.location.pathname}${qs ? `?${qs}` : ''}`);
  };

  if (loading) return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 pt-32 pb-16 flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading properties...</p>
        </div>
      </div>
    </div>
  );

  if (error && !properties.length) return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 pt-32 pb-16">
        {/* SEO-FRIENDLY FALLBACK CONTENT FOR GOOGLEBOT */}
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-6">
            Properties for {purpose === 'buy' ? 'Sale' : purpose === 'rent' ? 'Rent' : 'Rent & Sale'}
            {matchedCity ? ` in ${toTitleCase(matchedCity)}` : ' in Pakistan'}
          </h1>
          
          <div className="prose prose-lg max-w-none mb-8">
            <p className="text-lg text-muted-foreground">
              Welcome to Property Dealer, Pakistan's leading property marketplace. 
              Browse thousands of verified property listings including houses, apartments, 
              plots, and commercial properties across major cities.
            </p>
          </div>

          {/* Popular Links for Googlebot */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-8">
            <div className="border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Popular Cities</h2>
              <ul className="space-y-2">
                <li><a href="/properties/rent/lahore" className="text-primary hover:underline">Properties in Lahore</a></li>
                <li><a href="/properties/rent/islamabad" className="text-primary hover:underline">Properties in Islamabad</a></li>
                <li><a href="/properties/rent/karachi" className="text-primary hover:underline">Properties in Karachi</a></li>
                <li><a href="/properties/rent/multan" className="text-primary hover:underline">Properties in Multan</a></li>
                <li><a href="/properties/rent/faisalabad" className="text-primary hover:underline">Properties in Faisalabad</a></li>
              </ul>
            </div>

            <div className="border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Property Types</h2>
              <ul className="space-y-2">
                <li><a href="/properties/rent/house" className="text-primary hover:underline">Houses for Rent</a></li>
                <li><a href="/properties/sale/house" className="text-primary hover:underline">Houses for Sale</a></li>
                <li><a href="/properties/rent/apartment" className="text-primary hover:underline">Apartments for Rent</a></li>
                <li><a href="/properties/sale/plot" className="text-primary hover:underline">Plots for Sale</a></li>
                <li><a href="/properties/rent/commercial" className="text-primary hover:underline">Commercial Properties</a></li>
              </ul>
            </div>

            <div className="border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Quick Links</h2>
              <ul className="space-y-2">
                <li><a href="/properties/rent" className="text-primary hover:underline">All Properties for Rent</a></li>
                <li><a href="/properties/sale" className="text-primary hover:underline">All Properties for Sale</a></li>
                <li><a href="/blog" className="text-primary hover:underline">Real Estate Blog</a></li>
                <li><a href="/about" className="text-primary hover:underline">About Us</a></li>
                <li><a href="/contact" className="text-primary hover:underline">Contact Us</a></li>
              </ul>
            </div>
          </div>

          {/* Additional SEO Content */}
          <div className="prose max-w-none my-8">
            <h2 className="text-2xl font-bold mb-4">Why Choose Property Dealer?</h2>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Verified property listings across Pakistan</li>
              <li>Direct contact with property owners and agents</li>
              <li>Advanced search filters by location, price, and size</li>
              <li>Detailed property information with photos and maps</li>
              <li>Free property listing for owners and agents</li>
            </ul>
          </div>

          {/* User-facing error (still visible but with context) */}
          <div className="mt-12 text-center border-t pt-8">
            <p className="text-sm text-muted-foreground mb-4">
              We're experiencing temporary technical difficulties loading the latest listings.
            </p>
            <Button onClick={() => setCurrentPage(1)} size="lg">
              Refresh Page
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  const typeTabs = [
    { key: 'all', label: 'All Properties', count: properties.length },
    ...propertyTypes.map(t => ({
      key: t.toLowerCase(),
      label: typeLabel(t),
      count: properties.filter(p => p.type?.toLowerCase() === t.toLowerCase()).length,
    })),
  ];

  const locationPanelAreas   = matchedCity ? mainAreas : allAreas;
  const locationPanelLoading = matchedCity ? loadingMainAreas : loadingAllAreas;

  const activeTabLabel = typeTabs.find(t =>
    t.key === 'all' ? (type === 'all' || !type) : type.toLowerCase() === t.key
  )?.label || 'Properties';
  const purposeLabel = purpose === 'buy' ? 'For Sale' : purpose === 'rent' ? 'For Rent' : '';
  const locationPanelTitle = [
    'Locations of', activeTabLabel, purposeLabel,
    matchedCity ? `in ${matchedCity}` : '',
  ].filter(Boolean).join(' ');

  const filterSheetAreaList    = sheetCity ? sheetAreas : allAreas;
  const filterSheetAreaLoading = sheetCity ? loadingAreas : loadingAllAreas;
  const visibleFilterAreas     = showAllAreas ? filterSheetAreaList : filterSheetAreaList.slice(0, 8);

  const showMarlaChips = type.toLowerCase() === 'house' || type.toLowerCase() === 'plot';

  return (
    <div className="min-h-screen bg-background">

      <Sheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen}>
        <SheetContent side="bottom" className="h-screen w-full p-0 rounded-none border-0 lg:hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200 bg-white shrink-0">
            <SheetTitle className="text-base font-bold text-black">Filters</SheetTitle>
            <button onClick={() => setIsFilterSheetOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 hover:bg-gray-100">
              <X className="w-4 h-4 text-black" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto bg-white">
            <div className="p-4 space-y-6">

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-black">City</Label>
                <div className="relative">
                  <select
                    value={sheetCity}
                    onChange={e => { setSheetCity(e.target.value); setSheetAreaId(''); setSheetAreaSlug(''); setShowAllAreas(false); }}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-sm font-medium appearance-none focus:border-black focus:outline-none"
                  >
                    <option value="">All Cities</option>
                    {cities.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-black">Property Type</Label>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setSheetType('all')}
                    className={`px-4 py-2 rounded-full text-xs font-semibold border transition-colors ${sheetType === 'all' ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'}`}>
                    All Types
                  </button>
                  {propertyTypes.map(t => (
                    <button key={t}
                      onClick={() => setSheetType(sheetType.toLowerCase() === t.toLowerCase() ? 'all' : t.toLowerCase())}
                      className={`px-4 py-2 rounded-full text-xs font-semibold border transition-colors ${sheetType.toLowerCase() === t.toLowerCase() ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-black">
                  Area
                  {sheetAreaId && (
                    <button onClick={() => { setSheetAreaId(''); setSheetAreaSlug(''); }} className="ml-2 text-xs text-gray-400 font-normal underline">Clear</button>
                  )}
                </Label>
                {filterSheetAreaLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400 py-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading areas…</div>
                ) : filterSheetAreaList.length === 0 ? (
                  <p className="text-sm text-gray-400 py-2">No areas found</p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      {visibleFilterAreas.map(area => (
                        <button key={area.id}
                          onClick={() => { if (sheetAreaId === area.id) { setSheetAreaId(''); setSheetAreaSlug(''); } else { setSheetAreaId(area.id); setSheetAreaSlug(area.slug || ''); } }}
                          className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs font-medium transition-colors text-left ${sheetAreaId === area.id ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'}`}>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <MapPin className="w-3 h-3 shrink-0 opacity-60" />
                            <span className="truncate">{toTitleCase(area.name)}</span>
                          </div>
                          {area.count > 0 && <span className={`ml-1 shrink-0 text-[10px] ${sheetAreaId === area.id ? 'opacity-70' : 'text-gray-400'}`}>{area.count}</span>}
                        </button>
                      ))}
                    </div>
                    {filterSheetAreaList.length > 8 && (
                      <button onClick={() => setShowAllAreas(v => !v)} className="flex items-center gap-1 text-xs text-gray-500 mt-1 hover:text-black transition-colors">
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAllAreas ? 'rotate-180' : ''}`} />
                        {showAllAreas ? 'Show less' : `Show all ${filterSheetAreaList.length} areas`}
                      </button>
                    )}
                  </>
                )}
              </div>

              <div className="border-t border-gray-100" />

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-black">Price Range (PKR)</Label>
                <div className="grid grid-cols-2 gap-3">
                  <Input type="number" placeholder="Min" value={sheetPriceMin} onChange={e => setSheetPriceMin(e.target.value)} className="h-11 text-sm rounded-xl border-gray-200 focus:border-black" />
                  <Input type="number" placeholder="Max" value={sheetPriceMax} onChange={e => setSheetPriceMax(e.target.value)} className="h-11 text-sm rounded-xl border-gray-200 focus:border-black" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-black">Area Size (Marla)</Label>
                <div className="grid grid-cols-2 gap-3">
                  <Input type="number" placeholder="Min" value={sheetMarlaMin} onChange={e => setSheetMarlaMin(e.target.value)} className="h-11 text-sm rounded-xl border-gray-200 focus:border-black" />
                  <Input type="number" placeholder="Max" value={sheetMarlaMax} onChange={e => setSheetMarlaMax(e.target.value)} className="h-11 text-sm rounded-xl border-gray-200 focus:border-black" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-black">Bedrooms</Label>
                <div className="flex gap-2 flex-wrap">
                  {[1,2,3,4,5].map(n => (
                    <button key={n} onClick={() => setSheetBeds(sheetBeds === n ? undefined : n)}
                      className={`w-11 h-11 rounded-full text-sm font-semibold border transition-colors ${sheetBeds === n ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500'}`}>
                      {n}{n === 5 ? '+' : ''}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-black">Bathrooms</Label>
                <div className="flex gap-2 flex-wrap">
                  {[1,2,3,4].map(n => (
                    <button key={n} onClick={() => setSheetBaths(sheetBaths === n ? undefined : n)}
                      className={`w-11 h-11 rounded-full text-sm font-semibold border transition-colors ${sheetBaths === n ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500'}`}>
                      {n}{n === 4 ? '+' : ''}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-4" />
            </div>
          </div>

          <div className="shrink-0 border-t border-gray-200 bg-white px-4 py-3 flex gap-3">
            <button onClick={resetSheetFilters} className="flex-1 py-3 rounded-xl border-2 border-gray-300 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors">RESET</button>
            <button onClick={applySheetFilters} className="flex-[2] py-3 rounded-xl bg-black text-white text-sm font-bold hover:bg-gray-900 transition-colors">APPLY FILTERS</button>
          </div>
        </SheetContent>
      </Sheet>

      <section className="py-8 md:py-10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col lg:flex-row gap-8">

            <aside className="w-80 shrink-0 hidden lg:block">
              <div className="sticky top-24">
                <SearchSidebar city={matchedCity} purpose={purpose} type={type} useCleanUrls={useCleanUrls} filters={advancedFilters} onFilterChange={handleFilterChange} />
              </div>
            </aside>

            <div className="w-full lg:w-3/4 space-y-5">

              <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
                {type !== 'all'
                  ? (type.toLowerCase() === 'house' ? 'Property' : `${type.charAt(0).toUpperCase() + type.slice(1)}s`)
                  : 'Properties'}
                {purpose === 'rent' ? ' for Rent ' : purpose === 'buy' ? ' for Sale ' : ' '}
                in {matchedCity || 'Pakistan'}
              </h1>

              <div className="lg:hidden flex rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                <button onClick={() => updateFilters(matchedCity, type, 'buy')}
                  className={`flex-1 py-3 text-sm font-bold transition-colors ${purpose === 'buy' ? 'bg-black text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                  Buy
                </button>
                <button onClick={() => updateFilters(matchedCity, type, 'rent')}
                  className={`flex-1 py-3 text-sm font-bold transition-colors border-x border-gray-200 ${purpose === 'rent' ? 'bg-black text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                  Rent
                </button>
                <button onClick={() => setIsFilterSheetOpen(true)}
                  className="px-5 py-3 bg-black hover:bg-gray-900 text-white text-xs font-bold tracking-widest flex items-center gap-1.5 transition-colors">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  FILTERS
                </button>
              </div>

              <div className="lg:hidden relative">
                <div className="relative">
                  <div className="flex flex-wrap gap-x-5 gap-y-0 pr-28">
                    {typeTabs.map(tab => {
                      const isActive = tab.key === 'all'
                        ? (type === 'all' || !type)
                        : type.toLowerCase() === tab.key;
                      return (
                        <button key={tab.key} onClick={() => navigateType(tab.key)}
                          className={`flex flex-col items-start pb-2 pt-0.5 text-left transition-colors border-b-2 ${isActive ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
                          <span className="text-xs font-bold leading-tight whitespace-nowrap">{tab.label}</span>
                          <span className="text-[10px] text-gray-400 leading-tight">({tab.count})</span>
                        </button>
                      );
                    })}
                  </div>
                  <button onClick={() => setIsLocationPanelOpen(v => !v)}
                    className={`absolute right-0 top-0.5 text-[10px] font-bold border px-2 py-1 rounded transition-colors whitespace-nowrap ${isLocationPanelOpen ? 'border-black bg-black text-white' : 'border-gray-300 bg-white text-gray-600 hover:border-gray-600'}`}>
                    {isLocationPanelOpen ? 'CLOSE LIST' : 'LOCATION LIST'}
                  </button>
                </div>

                {isLocationPanelOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsLocationPanelOpen(false)} />
                    <div className="absolute right-0 top-8 z-50 w-[260px] bg-white border border-gray-200 shadow-2xl overflow-hidden">
                      <div className="px-4 pt-4 pb-3">
                        <p className="text-[17px] font-bold text-gray-900 leading-snug">{locationPanelTitle}</p>
                      </div>
                      <div className="overflow-y-auto" style={{ maxHeight: '340px' }}>
                        {locationPanelLoading ? (
                          <div className="flex items-center gap-2 px-4 py-6 text-sm text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> Loading locations…</div>
                        ) : locationPanelAreas.length === 0 ? (
                          <p className="px-4 py-6 text-sm text-gray-400 text-center">No areas found</p>
                        ) : (
                          locationPanelAreas.map((area, idx) => {
                            const isSelected = currentAreaId === area.id;
                            return (
                              <button key={area.id} onClick={() => navigateArea(area)}
                                className={cn('w-full flex items-center justify-between px-4 py-[10px] text-left transition-colors hover:bg-gray-50', idx !== 0 && 'border-t border-gray-100')}>
                                <span className={`text-[13px] leading-tight ${isSelected ? 'font-semibold text-gray-900' : 'font-normal text-gray-800'}`}>
                                  {toTitleCase(area.name)}
                                </span>
                                {area.count > 0 && <span className="text-[11px] text-gray-400 ml-2 shrink-0 tabular-nums">({area.count})</span>}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {showMarlaChips && (
                <div className="lg:hidden flex gap-2 flex-wrap">
                  {SIZE_OPTIONS.map(opt => (
                    <button key={opt.marlaMin} onClick={() => handleMarlaClick(opt.marlaMin)}
                      className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition-colors ${selectedMarla === opt.marlaMin ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="pt-2">
                <h3 className="text-lg font-semibold mb-6">Property Listings</h3>

                {properties.length > 0 ? (
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 gap-2 md:gap-4">
                      {properties.map((property, index) => (
                        <div key={`${property.id}-${index}`}
                          className="animate-in fade-in slide-in-from-bottom-4 duration-500"
                          style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }}>
                          <PropertyCard property={property} />
                        </div>
                      ))}
                    </div>

                    {currentPage < totalPages && (
                      <div className="flex justify-center pt-4">
                        <Button variant="outline" size="lg" onClick={() => setCurrentPage(p => p + 1)} disabled={isFetchingMore}
                          className="min-w-[200px] rounded-full border-primary text-primary hover:bg-primary/5">
                          {isFetchingMore ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Loading...</> : 'Load More Properties'}
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-16 bg-secondary/30 rounded-xl">
                    <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
                      <SlidersHorizontal className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">No properties found</h3>
                    <p className="text-muted-foreground mb-6">Try adjusting your filters</p>
                    <Button variant="outline" onClick={() => {
                      setType('all'); setSelectedMarla(null);
                      updateFilters('', 'all'); setAdvancedFilters({});
                    }}>
                      Clear All Filters
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {effectiveRichDescription && (
            <section className="pt-24 pb-6 md:pt-28 md:pb-8 bg-secondary/50">
              <div className="container mx-auto px-4">
                <div className="mt-6 prose prose-sm max-w-4xl text-muted-foreground prose-headings:text-foreground prose-a:text-primary"
                  dangerouslySetInnerHTML={{ __html: effectiveRichDescription }} />
              </div>
            </section>
          )}
        </div>
      </section>
    </div>
  );
}
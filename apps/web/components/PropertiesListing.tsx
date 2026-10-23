 'use client'

import { useState, useMemo, useEffect, useRef, Suspense, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import SearchParamsBridge from '@/components/SearchParamsBridge';
import { SlidersHorizontal, Loader2, MapPin, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PropertyCard from '@/components/PropertyCard';
import { propertyApi, cityApi } from '@/lib/api';
import { areaApi } from '@/lib/api/area/area.api';
import { mapBackendToFrontendProperty, BackendProperty } from '@/lib/types/property-utils';
import { Property } from '@/lib/data';
import { toast } from 'sonner';
import { cn, toTitleCase } from '@/lib/utils';
import { isReturn, readSnapshot, saveSnapshot } from '@/lib/nav-memory';
import { chipClass } from '@/lib/chip';
import { AdUnitView, AdZone, useAdsAt } from '@/components/ads/AdSlot';
import { useSiteSettings } from '@/components/SiteSettingsProvider';

interface PropertiesListingProps {
  purpose: 'rent' | 'buy' | 'all';
  city?: string;
  type?: string;
  useCleanUrls?: boolean;
  richDescription?: string;
  areaId?: string;
  areaSlug?: string;
  initialMarla?: number;
  /** Page one, fetched on the server with the same filters (fetchInitialListings). */
  initialProperties?: Property[];
  initialTotalPages?: number;
  /** The city's id, when the server already resolved it — saves waiting for the city list. */
  cityId?: string;
  /** The page's H1 as the server worked it out (area and city names included). */
  heading?: string;
  /** Beside the results on a desktop (under them on a phone): the society card, the city's agencies. */
  sidebar?: React.ReactNode;
  /** Under the results, before the page's text: the city's societies, agencies and map. */
  extras?: React.ReactNode;
}

interface AreaOption {
  id: string;
  name: string;
  slug?: string;
  count: number;
  /** "society", "phase" or unset (a locality) — see the Area schema. */
  kind?: string;
  /** A phase's society. */
  parent?: string;
}

const SIZE_OPTIONS: { label: string; marlaMin: number; marlaMax: number }[] = [
  { label: '2 Marla',  marlaMin: 2,  marlaMax: 2  },
  { label: '3 Marla',  marlaMin: 3,  marlaMax: 3  },
  { label: '5 Marla',  marlaMin: 5,  marlaMax: 5  },
  { label: '10 Marla', marlaMin: 10, marlaMax: 10 },
  { label: '1 Kanal',  marlaMin: 20, marlaMax: 20 },
];

/** One location in the chips row: its name and how many listings it has. */
function LocationChip({ area, selected, onClick }: { area: AreaOption; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={chipClass(selected, area.kind === 'society' && !selected ? 'font-semibold text-slate-900' : undefined)}
    >
      {toTitleCase(area.name)}
      {area.count > 0 && <span className={cn('text-[12px] tabular-nums', selected ? 'opacity-70' : 'text-slate-400')}>{area.count}</span>}
    </button>
  );
}

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
  initialTotalPages,
  cityId: initialCityId,
  heading,
  sidebar,
  extras,
}: PropertiesListingProps) {
  const router = useRouter();
  // The query string arrives through <SearchParamsBridge> (rendered below):
  // useSearchParams() here made Next render this whole list in the browser
  // only, so the results pages' HTML was a spinner. Empty until it arrives.
  const [searchParams, setSearchParams] = useState<URLSearchParams>(() => new URLSearchParams());
  const siteSettings = useSiteSettings();
  const { listingsPerPage } = siteSettings;
  // Ads (Settings → Ads): one between every few listings, and one beside them on a desktop.
  const feedUnits = useAdsAt('archive', 'feed');
  const feedAds = feedUnits.length > 0;
  const feedEvery = Math.max(3, siteSettings.adsArchiveEvery || 6);
  const sidebarAd = useAdsAt('archive', 'sidebar').length > 0;

  // Back from a listing: put back everything that was loaded ("show more"
  // pages too), so the page can scroll to where the visitor left it.
  const [restored] = useState<{ properties: Property[]; page: number; totalPages: number } | null>(() =>
    typeof window !== 'undefined' && isReturn() ? readSnapshot('list') : null,
  );
  // While a returned list settles (the query string arrives a moment after
  // mount), keep it: no reset to page one, no fresh request on top of it.
  const restoringUntil = useRef(restored ? Date.now() + 1500 : 0);
  const restoring = () => Date.now() < restoringUntil.current;
  const [properties, setProperties]             = useState<Property[]>(restored?.properties ?? initialProperties ?? []);
  const [allCities, setAllCities]               = useState<any[]>([]);
  const [allPropertyTypes, setAllPropertyTypes] = useState<string[]>([]);
  const [loading, setLoading]                   = useState(!restored && !initialProperties?.length);
  const [error, setError]                       = useState<string | null>(null);
  const [city, setCity]                         = useState(initialCity);
  const [type, setType]                         = useState(initialType);
  const [currentPage, setCurrentPage]           = useState(restored?.page ?? 1);
  const [totalPages, setTotalPages]             = useState(restored?.totalPages ?? initialTotalPages ?? 1);
  const [isFetchingMore, setIsFetchingMore]     = useState(false);
  const [selectedMarla, setSelectedMarla]       = useState<number | null>(initialMarla ?? null);

  const [isLocationPanelOpen, setIsLocationPanelOpen] = useState(false);

  const [mainAreas,        setMainAreas]        = useState<AreaOption[]>([]);
  const [loadingMainAreas, setLoadingMainAreas] = useState(false);
  const [allAreas,         setAllAreas]         = useState<AreaOption[]>([]);
  const [loadingAllAreas,  setLoadingAllAreas]  = useState(false);

  // 🆕 Full area document (with rentContent/saleContent/sizeContents) for SEO content
  const [areaData, setAreaData] = useState<any>(null);

  const [showAllMainAreas, setShowAllMainAreas] = useState(false);

  const [advancedFilters, setAdvancedFilters] = useState<{
    priceMin?: number; priceMax?: number;
    marlaMin?: number; marlaMax?: number;
    beds?: number;     baths?: number;
  }>(initialMarla ? { marlaMin: initialMarla, marlaMax: initialMarla } : {});

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

    if (!cs) {
      return `/properties/${pp}${tSlug}${marlaSlug}`;
    }
    return `/properties/${pp}/${cs}${areaPath}${tSlug}${marlaSlug}`;
  };

  const handleMarlaClick = (marla: number) => {
    const isDeselecting = selectedMarla === marla;
    const newMarla = isDeselecting ? null : marla;

    if (newMarla === 20) {
      const pp    = purpose === 'buy' ? 'sale' : purpose;
      const cs    = matchedCity ? `/${cityToSlug(matchedCity)}` : '';
      const tSlug = type && type !== 'all' ? `/${type.toLowerCase()}` : '';
      router.push(`/properties/${pp}${cs}${tSlug}/1kanal`);
    } else if (useCleanUrls) {
      router.push(buildCleanUrl({ marlaOverride: newMarla }));
    } else {
      const params = new URLSearchParams(searchParams.toString());
      if (newMarla) {
        params.set('marlaMin', newMarla.toString());
        params.set('marlaMax', newMarla.toString());
      } else {
        params.delete('marlaMin');
        params.delete('marlaMax');
      }
      const qs = params.toString();
      router.push(qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
    }
  };

  useEffect(() => {
    if (type.toLowerCase() !== 'house' && type.toLowerCase() !== 'plot') {
      setSelectedMarla(null);
    }
  }, [type]);

  /*
   * Price, a size range, beds and baths come from the address (the search
   * panel above the results puts them there); a size in the path is the
   * default for the size range.
   */
  const filterKey = ['priceMin', 'priceMax', 'marlaMin', 'marlaMax', 'beds', 'baths'].map((k) => searchParams.get(k) ?? '').join('|');
  useEffect(() => {
    const n = (k: string) => {
      const v = Number(searchParams.get(k));
      return v > 0 ? v : undefined;
    };
    setSelectedMarla(initialMarla ?? null);
    setAdvancedFilters({
      priceMin: n('priceMin'),
      priceMax: n('priceMax'),
      marlaMin: n('marlaMin') ?? initialMarla ?? undefined,
      marlaMax: n('marlaMax') ?? initialMarla ?? undefined,
      beds: n('beds'),
      baths: n('baths'),
    });
    if (!restoring()) setCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMarla, filterKey]);

  /*
   * Every area in the country is only needed by the location panel when no
   * city is chosen — so it is fetched when it opens, not on every results page.
   */
  const needAllAreas = !matchedCity && isLocationPanelOpen;
  const allAreasRequested = useRef(false);
  useEffect(() => {
    if (!needAllAreas || allAreasRequested.current) return;
    allAreasRequested.current = true;
    (async () => {
      setLoadingAllAreas(true);
      try {
        const data = await areaApi.getNames();
        if (Array.isArray(data)) {
          setAllAreas(data.map((a: any) => ({
            id: a._id, name: a.name, slug: a.areaSlug || a.slug || '', count: a.count || 0,
          })));
        }
      } catch { setAllAreas([]); allAreasRequested.current = false; }
      finally { setLoadingAllAreas(false); }
    })();
  }, [needAllAreas]);

  // 🆕 Fetch full Area document (so we get rentContent/saleContent/description/sizeContents)
  useEffect(() => {
    // The server already worked out the page's SEO text; only fetch the area
    // document when it did not.
    if (richDescription || (!initialAreaId && !initialAreaSlug)) { setAreaData(null); return; }
    (async () => {
      try {
        let data: any = null;
        if (initialAreaId) {
          data = await areaApi.getById(initialAreaId);
        } else if (initialAreaSlug) {
          // (No fallback to downloading every area — that was ~175 KB and
          // several seconds on every area page whose slug lookup missed.)
          data = await areaApi.getByName(initialAreaSlug).catch(() => null);
        }
        setAreaData(data || null);
      } catch {
        setAreaData(null);
      }
    })();
  }, [initialAreaId, initialAreaSlug]);

  useEffect(() => {
    if (!matchedCity) { setMainAreas([]); return; }
    setLoadingMainAreas(true);
    (async () => {
      try {
        const pt = purpose === 'buy' ? 'sale' : purpose === 'rent' ? 'rent' : undefined;
        const data = await propertyApi.getLocationStats(matchedCity, pt);
        if (data?.locations) {
          const rows: AreaOption[] = data.locations.map((l: any) => ({
            id: String(l.id), name: l.name, slug: l.slug, count: l.count,
            kind: l.kind || undefined, parent: l.parent ? String(l.parent) : undefined,
          }));
          /*
           * A society's listings are mostly in its phases, so the society
           * itself may have none of its own and be missing here. Add it from
           * the city's area names, and count its phases' listings as its own
           * — its page shows them all.
           */
          const parents = [...new Set(rows.filter(r => r.parent).map(r => r.parent!))];
          if (parents.length) {
            const missing = parents.filter(id => !rows.some(r => r.id === id));
            const names = missing.length && initialCityId ? await areaApi.getNames(initialCityId).catch(() => []) : [];
            for (const id of missing) {
              const a: any = (names as any[]).find(n => String(n._id) === id);
              if (a) rows.push({ id, name: a.name, slug: a.areaSlug, count: 0, kind: 'society' });
            }
            for (const r of rows) {
              if (r.kind === 'society') r.count += rows.filter(x => x.parent === r.id).reduce((n, x) => n + x.count, 0);
            }
          }
          setMainAreas(rows);
        } else { setMainAreas([]); }
      } catch { setMainAreas([]); }
      finally { setLoadingMainAreas(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchedCity, purpose]);

  /*
   * Cities and types fill the dropdowns and the SEO text. They used to be
   * fetched in front of every properties request — and the city list arriving
   * changed `matchedCity`, which fired the properties request a second time.
   * Now they load once, alongside, and never hold the list up.
   */
  useEffect(() => {
    let cancelled = false;
    Promise.all([cityApi.getNames(), propertyApi.getTypes()])
      .then(([citiesRes, typesRes]) => {
        if (cancelled) return;
        setAllCities(citiesRes);
        setAllPropertyTypes(typesRes);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  /*
   * Everything the list request depends on, as one string. Effects keyed on
   * objects re-ran whenever a parent re-created them; a string only changes
   * when a filter really does.
   */
  const searchTerm = searchParams.get('search') || '';
  const queryAreaId = searchParams.get('areaId') || initialAreaId || '';
  const fetchKey = JSON.stringify({
    cityId: initialCityId || '', city, queryAreaId, searchTerm, purpose, type,
    f: advancedFilters, page: currentPage,
  });

  /*
   * The server already rendered page one for the URL's own filters. Skip that
   * one request; anything the visitor changes afterwards fetches as normal.
   */
  const serverKey = useRef<string | null>(
    restored ? fetchKey : initialProperties?.length && !searchTerm && !searchParams.get('areaId') && !filterKey.replace(/\|/g, '') ? fetchKey : null,
  );

  useEffect(() => {
    if (serverKey.current === fetchKey) return;
    if (restoring()) {
      serverKey.current = fetchKey;
      return;
    }
    serverKey.current = null;

    let cancelled = false;
    (async () => {
      try {
        if (currentPage === 1) setLoading(true); else setIsFetchingMore(true);
        setError(null);
        const response = await propertyApi.getAll({
          cityId:   initialCityId || undefined,
          cityName: city || undefined,
          areaId:   queryAreaId || undefined,
          search:   searchTerm || undefined,
          priceMin: advancedFilters.priceMin,
          priceMax: advancedFilters.priceMax,
          marlaMin: advancedFilters.marlaMin,
          marlaMax: advancedFilters.marlaMax,
          beds:     advancedFilters.beds,
          baths:    advancedFilters.baths,
          type:     type !== 'all' ? type : undefined,
          purpose:  purpose !== 'all' ? purpose : undefined,
          page:     currentPage,
          limit:    listingsPerPage || 12,
        });
        if (cancelled) return;
        let props: BackendProperty[] = [];
        let pages = 1;
        if (Array.isArray(response))   { props = response; }
        else if (response?.properties) { props = response.properties; pages = response.totalPages || 1; }
        const transformed = props.map(mapBackendToFrontendProperty);
        if (currentPage === 1) setProperties(transformed);
        else setProperties(prev => [...prev, ...transformed]);
        setTotalPages(pages);
      } catch (err: any) {
        if (cancelled) return;
        const msg = err.response?.data?.message || err.message || 'Failed to load data';
        setError(msg);
        toast.error('Error', { description: msg });
      } finally {
        if (!cancelled) {
          setLoading(false);
          setIsFetchingMore(false);
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchKey]);

  // A return the first render did not see in time: put the list back now.
  const checkedReturn = useRef(!!restored);
  useEffect(() => {
    if (checkedReturn.current) return;
    checkedReturn.current = true;
    if (!isReturn()) return;
    const snap = readSnapshot<{ properties: Property[]; page: number; totalPages: number }>('list');
    if (!snap || snap.properties.length <= properties.length) return;
    // After this render, so the list request for page one is not repeated on top.
    requestAnimationFrame(() => {
      restoringUntil.current = Date.now() + 1500;
      serverKey.current = JSON.stringify({
        cityId: initialCityId || '', city, queryAreaId, searchTerm, purpose, type,
        f: advancedFilters, page: snap.page,
      });
      setProperties(snap.properties);
      setTotalPages(snap.totalPages);
      setCurrentPage(snap.page);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Remember what is loaded for this URL, for a return by "back".
  useEffect(() => {
    if (!checkedReturn.current || loading || isFetchingMore || !properties.length) return;
    saveSnapshot('list', { properties: properties.slice(0, 240), page: currentPage, totalPages });
  }, [properties, currentPage, totalPages, loading, isFetchingMore]);

  // 🆕 SEO content now checks Area first (sizeContents → rent/saleContent → description),
  // then falls back to City-level content if no area match is found.
  const effectiveRichDescription = useMemo(() => {
    if (richDescription) return richDescription;

    const purposeKey = purpose === 'buy' ? 'sale' : purpose;

    // 1) Area-level content (when an area is selected)
    if (areaData) {
      if (initialMarla && areaData.sizeContents?.length) {
        const marlaKey = initialMarla === 20 ? '1kanal' : `${initialMarla}marla`;
        const match = areaData.sizeContents.find(
          (s: any) => s.size === marlaKey && (s.purpose === purposeKey || s.purpose === 'all')
        );
        if (match?.content) return match.content;
      }

      if (purpose === 'rent' && areaData.rentContent) return areaData.rentContent;
      if (purpose === 'buy'  && areaData.saleContent) return areaData.saleContent;
      if (areaData.description) return areaData.description;
    }

    // 2) City-level content (fallback)
    if (!matchedCity || !allCities.length) return undefined;

    const cityData = allCities.find(c => c.name.toLowerCase() === matchedCity.toLowerCase());
    if (!cityData) return undefined;

    if (initialMarla && cityData.sizeContents?.length) {
      const marlaKey = initialMarla === 20 ? '1kanal' : `${initialMarla}marla`;
      const match = cityData.sizeContents.find(
        (s: any) =>
          s.size === marlaKey &&
          (s.purpose === purposeKey || s.purpose === 'all')
      );
      if (match?.content) return match.content;
    }

    if (type && type !== 'all' && cityData.typeContents?.length) {
      const match = cityData.typeContents.find(
        (t: any) =>
          t.propertyType?.toLowerCase() === type.toLowerCase() &&
          (t.purpose === purposeKey || t.purpose === 'all')
      );
      if (match?.content) return match.content;
    }

    // Only skip City's general rent/sale/description when an area is selected
    // but areaData itself produced nothing above — we still want a fallback,
    // so we no longer hard-return undefined here.
    if (purpose === 'rent') return cityData.rentContent || undefined;
    if (purpose === 'buy')  return cityData.saleContent || undefined;

    return cityData.description || undefined;
  }, [richDescription, matchedCity, allCities, purpose, type, initialAreaId, initialAreaSlug, initialMarla, areaData]);

  // A new URL means new filters: start again from page one. Skipped on the
  // first render, where it used to throw away the list the server sent.
  const routeKey = `${initialCity}|${initialType}|${purpose}|${searchParams.toString()}|${initialAreaId}|${initialAreaSlug}`;
  const lastRouteKey = useRef(routeKey);
  useEffect(() => {
    if (lastRouteKey.current === routeKey) return;
    lastRouteKey.current = routeKey;
    setCity(initialCity); setType(initialType);
    if (!restoring()) setCurrentPage(1);
    setIsLocationPanelOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);

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

  if (error && !properties.length) return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 pt-10 pb-16">
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
    ...propertyTypes
      .filter(t => t.toLowerCase() !== 'other')
      .map(t => ({
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

  /*
   * The city's locations as a row of chips, shown like the size chips. On a
   * society's page its phases come first; on a phase, its society and the
   * other phases; elsewhere the busiest areas first.
   */
  const currentArea = mainAreas.find(a => a.id === currentAreaId || (!!initialAreaSlug && a.slug === initialAreaSlug));
  const locationGroups = (() => {
    if (!mainAreas.length) return { related: [] as AreaOption[], relatedTitle: '', others: [] as AreaOption[] };
    const byCount = (a: AreaOption, b: AreaOption) => b.count - a.count || a.name.localeCompare(b.name);
    const societyId = currentArea?.kind === 'society' ? currentArea.id : currentArea?.kind === 'phase' ? currentArea.parent : undefined;
    const related = societyId
      ? mainAreas
          .filter(a => a.id === societyId || a.parent === societyId)
          .sort((a, b) => (a.id === societyId ? -1 : b.id === societyId ? 1 : a.name.localeCompare(b.name, undefined, { numeric: true })))
      : [];
    const society = societyId ? mainAreas.find(a => a.id === societyId) : undefined;
    const taken = new Set(related.map(a => a.id));
    return {
      related,
      relatedTitle: society ? `${toTitleCase(society.name)} & its phases` : 'Phases',
      others: mainAreas.filter(a => !taken.has(a.id)).sort(byCount),
    };
  })();
  const LOCATION_CHIPS = 10;

  const showMarlaChips = type.toLowerCase() === 'house' || type.toLowerCase() === 'plot' || !!(matchedCity);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Suspense fallback={null}>
        <SearchParamsBridge onChange={setSearchParams} />
      </Suspense>

      {/* ── Main listings section ─────────────────────────────────────────── */}
      <section className="flex-1 bg-slate-50 py-3 md:py-6">
        <div className="container mx-auto px-4">
          <div className="flex flex-col lg:flex-row gap-6">

            <div className="min-w-0 flex-1 space-y-3 sm:space-y-4">

              <h1 className="text-[21px] font-bold tracking-tight text-slate-900 sm:text-[28px]">
                {heading && !searchParams.toString() ? heading : <>{type !== 'all'
                  ? (type.toLowerCase() === 'house' ? 'Property' : `${type.charAt(0).toUpperCase() + type.slice(1)}s`)
                  : 'Properties'}
                {purpose === 'rent' ? ' for Rent ' : purpose === 'buy' ? ' for Sale ' : ' '}
                in {matchedCity || 'Pakistan'}</>}
              </h1>

              {matchedCity && (loadingMainAreas || mainAreas.length > 0) && (
                <div className="space-y-2.5 sm:rounded-lg sm:border sm:border-slate-200 sm:bg-white sm:p-3.5">
                  {loadingMainAreas ? (
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading locations…
                    </div>
                  ) : (
                    <>
                      {locationGroups.related.length > 1 && (
                        <div>
                          <p className="mb-1.5 text-[12.5px] font-semibold text-slate-700">{locationGroups.relatedTitle}</p>
                          <div className="hide-scrollbar -mx-[var(--gutter)] flex gap-2 overflow-x-auto px-[var(--gutter)] sm:mx-0 sm:flex-wrap sm:px-0">
                            {locationGroups.related.map(area => (
                              <LocationChip key={area.id} area={area} selected={currentArea?.id === area.id} onClick={() => navigateArea(area)} />
                            ))}
                          </div>
                        </div>
                      )}
                      {locationGroups.others.length > 0 && (
                        <div>
                          <p className="mb-1.5 flex items-center gap-1 text-[12.5px] font-semibold text-slate-700">
                            <MapPin className="h-3.5 w-3.5 text-primary" />
                            {locationGroups.related.length > 1 ? `Other locations in ${toTitleCase(matchedCity)}` : `Locations in ${toTitleCase(matchedCity)}`}
                          </p>
                          <div className="hide-scrollbar -mx-[var(--gutter)] flex gap-2 overflow-x-auto px-[var(--gutter)] sm:mx-0 sm:flex-wrap sm:px-0">
                            {currentArea && locationGroups.related.length <= 1 && (
                              <button onClick={() => navigateArea(currentArea)}
                                className={chipClass(false, 'font-semibold text-primary')}>
                                All of {toTitleCase(matchedCity)}
                              </button>
                            )}
                            {(showAllMainAreas ? locationGroups.others : locationGroups.others.slice(0, LOCATION_CHIPS)).map(area => (
                              <LocationChip key={area.id} area={area} selected={currentArea?.id === area.id} onClick={() => navigateArea(area)} />
                            ))}
                            {locationGroups.others.length > LOCATION_CHIPS && (
                              <button onClick={() => setShowAllMainAreas(v => !v)}
                                className="inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap px-1.5 text-[13px] font-semibold text-primary">
                                {showAllMainAreas ? 'Show less' : `+${locationGroups.others.length - LOCATION_CHIPS} more`}
                                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAllMainAreas ? 'rotate-180' : ''}`} />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              <div className="lg:hidden relative">
                {/*
                  One scrolling row of chips: the property types, then
                  "Locations". It was a wrapped grid of tab labels each with a
                  count in brackets under it — counts of the page loaded so
                  far, not of the search, so "(0)" sat next to types that do
                  have listings.
                */}
                <div className="hide-scrollbar -mx-[var(--gutter)] flex items-center gap-1.5 overflow-x-auto px-[var(--gutter)]">
                  {typeTabs.map(tab => {
                    const isActive = tab.key === 'all'
                      ? (type === 'all' || !type)
                      : type.toLowerCase() === tab.key;
                    return (
                      <button key={tab.key} onClick={() => navigateType(tab.key)}
                        className={chipClass(isActive)}>
                        {tab.key === 'all' ? 'All' : tab.label}
                      </button>
                    );
                  })}
                  {!matchedCity && <button onClick={() => setIsLocationPanelOpen(v => !v)}
                    className={chipClass(isLocationPanelOpen)}>
                    <MapPin className="h-3.5 w-3.5" />
                    {isLocationPanelOpen ? 'Close' : 'Locations'}
                  </button>}
                </div>

                {isLocationPanelOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsLocationPanelOpen(false)} />
                    <div className="absolute right-0 top-10 z-50 w-[260px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                      <div className="px-4 pt-4 pb-3">
                        <p className="text-[15px] font-semibold text-slate-900 leading-snug">{locationPanelTitle}</p>
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
                <div className="hide-scrollbar -mx-[var(--gutter)] flex gap-2 overflow-x-auto px-[var(--gutter)] sm:mx-0 sm:flex-wrap sm:px-0">
                  {SIZE_OPTIONS.map(opt => (
                    <button key={opt.marlaMin} onClick={() => handleMarlaClick(opt.marlaMin)}
                      className={chipClass(selectedMarla === opt.marlaMin)}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}

              <AdZone page="archive" at="top" />

              <div>
                {loading && properties.length === 0 ? (
                  <div className="grid grid-cols-1 gap-2.5 sm:gap-3" aria-busy="true" aria-label="Loading properties">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="flex gap-3 rounded-lg border border-slate-200 bg-white p-2 sm:gap-4 sm:p-2.5">
                        <div className="h-[100px] w-[112px] shrink-0 animate-pulse rounded-md bg-slate-100 sm:h-[150px] sm:w-[210px]" />
                        <div className="flex-1 space-y-2 py-1">
                          <div className="h-5 w-24 animate-pulse rounded bg-slate-100" />
                          <div className="h-4 w-4/5 animate-pulse rounded bg-slate-100" />
                          <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : properties.length > 0 ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-2.5 sm:gap-3">
                      {properties.map((property, index) => (
                        <Fragment key={`${property.id}-${index}`}>
                          <PropertyCard property={property} />
                          {feedAds && (index + 1) % feedEvery === 0 && index < properties.length - 1 && (
                            <AdUnitView unit={feedUnits[Math.floor(index / feedEvery) % feedUnits.length]!} className="rounded-lg border border-slate-200 bg-white p-2" />
                          )}
                        </Fragment>
                      ))}
                    </div>

                    {currentPage < totalPages && (
                      <div className="flex justify-center pt-4">
                        <Button variant="outline" onClick={() => setCurrentPage(p => p + 1)} disabled={isFetchingMore}
                          className="btn-shape h-10 min-w-[200px] border-slate-300 font-semibold text-slate-900">
                          {isFetchingMore ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Loading…</> : 'Show more properties'}
                        </Button>
                      </div>
                    )}
                    <AdZone page="archive" at="bottom" />
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-200 px-4 py-12 text-center">
                    <SlidersHorizontal className="mx-auto mb-3 h-6 w-6 text-slate-400" />
                    <h2 className="text-[17px] font-semibold text-slate-900">No properties match these filters</h2>
                    <p className="mt-1 mb-5 text-sm text-slate-500">Try another area, or widen the price or size.</p>
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

            {(sidebar || sidebarAd) && (
              <aside className={cn('w-full shrink-0 space-y-4 lg:w-80 xl:w-[340px]', !sidebar && 'hidden lg:block')}>
                <div className="space-y-4 lg:sticky lg:top-[140px]">
                  {sidebar}
                  <AdZone page="archive" at="sidebar" className="hidden lg:block" />
                </div>
              </aside>
            )}
          </div>
        </div>
      </section>

      {extras}
      <AdZone page="archive" at="after:extras" className="my-6" wrap="container mx-auto px-[var(--gutter)] sm:px-4" />

      {effectiveRichDescription && (
        <section className="border-t border-slate-200 bg-slate-50 py-8">
          <div className="container mx-auto px-4">
            <div
              className="prose prose-sm max-w-4xl text-muted-foreground prose-headings:text-foreground prose-a:text-primary"
              dangerouslySetInnerHTML={{ __html: effectiveRichDescription }}
            />
          </div>
        </section>
      )}
      <AdZone page="archive" at="end" className="my-6" wrap="container mx-auto px-[var(--gutter)] sm:px-4" />
    </div>
  );
}
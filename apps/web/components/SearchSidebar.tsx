'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { MapPin, Loader2 } from 'lucide-react';
import { propertyApi } from '@/lib/api';
import Link from 'next/link';

interface SearchSidebarProps {
  city?: string;
  purpose: 'rent' | 'buy' | 'all';
  type?: string;
  useCleanUrls?: boolean;
  filters: {
    priceMin?: number;
    priceMax?: number;
    areaMin?: number;
    areaMax?: number;
    marlaMin?: number;
    marlaMax?: number;
    beds?: number;
    baths?: number;
  };
  onFilterChange: (newFilters: any) => void;
  className?: string;
}


interface LocationStat {
  name: string;
  id: string; // areaId
  count: number;
  slug?: string;
}

interface StatsData {
  locations: LocationStat[];
  summary: Record<string, number>;
  listingTypes: Record<string, number>;
  total: number;
}

export default function SearchSidebar({
  city,
  purpose,
  type = 'all',
  useCleanUrls = false,
  filters,
  onFilterChange,
  className = ""
}: SearchSidebarProps) {

  // Local state for filters to avoid excessive API calls while typing
  const [localFilters, setLocalFilters] = useState(filters);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Sync local state when props change
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  // Fetch location stats when city or purpose changes
  useEffect(() => {
    if (city) {
      fetchLocationStats();
    }
  }, [city, purpose]);

  const fetchLocationStats = async () => {
    try {
      setLoadingStats(true);
      // listingType 'sale' corresponds to purpose 'buy'
      const listingType = purpose === 'buy' ? 'sale' : (purpose === 'rent' ? 'rent' : undefined);
      const data = await propertyApi.getLocationStats(city || '', listingType);
      setStats(data);
    } catch (error) {
      console.error('Error fetching location stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleApplyFilters = () => {
    onFilterChange(localFilters);
  };

  const handleClearFilters = () => {
    const cleared = {
      priceMin: undefined,
      priceMax: undefined,
      areaMin: undefined,
      areaMax: undefined,
      marlaMin: undefined,
      marlaMax: undefined,
      beds: undefined,
      baths: undefined,
    };
    setLocalFilters(cleared);
    onFilterChange(cleared);
  };

  const updateFilter = (key: string, value: any) => {
    setLocalFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const toSlug = (value: string): string => {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };


  return (
    <div className={`space-y-6 ${className}`}>
      {/* Filters Section */}
      <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-muted/30 flex justify-between items-center">
          <h3 className="font-semibold">Filters</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="text-muted-foreground h-8 text-xs hover:text-foreground"
          >
            Clear All
          </Button>
        </div>

        <div className="p-4 space-y-6">
          {/* Price Range */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Price Range (PKR)</Label>
            <div className="grid grid-cols-1 xs:grid-cols-[1fr,auto,1fr] gap-2 items-center">
              <Input
                type="number"
                placeholder="Min"
                value={localFilters.priceMin || ''}
                onChange={(e) => updateFilter('priceMin', e.target.value ? Number(e.target.value) : undefined)}
                className="h-10 text-sm"
              />
              <span className="text-muted-foreground hidden xs:inline">-</span>
              <Input
                type="number"
                placeholder="Max"
                value={localFilters.priceMax || ''}
                onChange={(e) => updateFilter('priceMax', e.target.value ? Number(e.target.value) : undefined)}
                className="h-10 text-sm"
              />
            </div>
          </div>

          {/* Area Range */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Area (Marla)</Label>
            <div className="grid grid-cols-1 xs:grid-cols-[1fr,auto,1fr] gap-2 items-center">
              <Input
                type="number"
                placeholder="Min"
                value={localFilters.marlaMin || ''}
                onChange={(e) => updateFilter('marlaMin', e.target.value ? Number(e.target.value) : undefined)}
                className="h-10 text-sm"
              />
              <span className="text-muted-foreground hidden xs:inline">-</span>
              <Input
                type="number"
                placeholder="Max"
                value={localFilters.marlaMax || ''}
                onChange={(e) => updateFilter('marlaMax', e.target.value ? Number(e.target.value) : undefined)}
                className="h-10 text-sm"
              />
            </div>
          </div>

          {/* Bedrooms */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Bedrooms</Label>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map((bed) => (
                <button
                  key={bed}
                  onClick={() => updateFilter('beds', localFilters.beds === bed ? undefined : bed)}
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm transition-colors border ${localFilters.beds === bed
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background hover:bg-muted border-input'
                    }`}
                >
                  {bed}{bed === 5 ? '+' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Bathrooms */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Bathrooms</Label>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4].map((bath) => (
                <button
                  key={bath}
                  onClick={() => updateFilter('baths', localFilters.baths === bath ? undefined : bath)}
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm transition-colors border ${localFilters.baths === bath
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background hover:bg-muted border-input'
                    }`}
                >
                  {bath}{bath === 4 ? '+' : ''}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={handleApplyFilters} className="w-full">
            Apply Filters
          </Button>
        </div>
      </div>

      {/* Location Stats Section */}
      {city && (
        <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-muted/30">
            <h3 className="font-semibold">Popular Locations</h3>
            <p className="text-xs text-muted-foreground">in {city}</p>
          </div>

          <div className="p-0">
            {loadingStats ? (
              <div className="p-8 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : stats && stats.locations.length > 0 ? (
              <div className="max-h-[300px] overflow-y-auto scrollbar-thin">
                <ul className="divide-y">
                  {stats.locations.map((loc) => (
                    <li key={loc.id}>
                      <Link
                        href={(() => {
                          if (useCleanUrls && city && loc.slug) {
                            const purposePath = purpose === 'buy' ? 'sale' : (purpose === 'all' ? 'all' : purpose);
                            const citySlug = toSlug(city);
                            // Clean URL: /properties/sale/lahore/dha
                            return `/properties/${purposePath}/${citySlug}/${loc.slug}`;
                          }
                          // Fallback URL: /properties?city=lahore&areaId=...&purpose=sale
                          const query = `areaId=${loc.id}${purpose !== 'all' ? `&purpose=${purpose}` : ''}&city=${city}`;
                          return `/properties?${query}`;
                        })()}
                        className="flex justify-between items-center py-3 px-4 hover:bg-muted/50 transition-colors text-sm group"
                      >

                        <div className="flex items-center gap-2">
                          <MapPin className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
                          <span className="text-foreground group-hover:text-primary transition-colors">{loc.name}</span>
                        </div>
                        <Badge variant="secondary" className="px-1.5 h-5 text-[10px] font-normal">
                          {loc.count}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="p-6 text-center text-muted-foreground text-sm">
                No locations found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

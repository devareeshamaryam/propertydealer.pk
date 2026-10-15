 'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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

export default function SearchSidebar({
  city,
  purpose,
  type = 'all',
  useCleanUrls = false,
  filters,
  onFilterChange,
  className = ""
}: SearchSidebarProps) {

  const [localFilters, setLocalFilters] = useState(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

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

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Filters Section */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
          <h2 className="text-[15px] font-semibold text-slate-900">Filters</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="text-muted-foreground h-8 text-xs hover:text-foreground"
          >
            Clear all
          </Button>
        </div>

        <div className="space-y-5 p-4">
          {/* Price Range */}
          <div className="space-y-2">
            <Label className="text-[13px] font-semibold text-slate-700">Price Range (PKR)</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                placeholder="Min"
                value={localFilters.priceMin || ''}
                onChange={(e) => updateFilter('priceMin', e.target.value ? Number(e.target.value) : undefined)}
                className="h-9 text-sm"
              />
              <Input
                type="number"
                placeholder="Max"
                value={localFilters.priceMax || ''}
                onChange={(e) => updateFilter('priceMax', e.target.value ? Number(e.target.value) : undefined)}
                className="h-9 text-sm"
              />
            </div>
          </div>

          {/* Area Range */}
          <div className="space-y-2">
            <Label className="text-[13px] font-semibold text-slate-700">Area (Marla)</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                placeholder="Min"
                value={localFilters.marlaMin || ''}
                onChange={(e) => updateFilter('marlaMin', e.target.value ? Number(e.target.value) : undefined)}
                className="h-9 text-sm"
              />
              <Input
                type="number"
                placeholder="Max"
                value={localFilters.marlaMax || ''}
                onChange={(e) => updateFilter('marlaMax', e.target.value ? Number(e.target.value) : undefined)}
                className="h-9 text-sm"
              />
            </div>
          </div>

          {/* Bedrooms */}
          <div className="space-y-2">
            <Label className="text-[13px] font-semibold text-slate-700">Bedrooms</Label>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map((bed) => (
                <button
                  key={bed}
                  onClick={() => updateFilter('beds', localFilters.beds === bed ? undefined : bed)}
                  className={`h-9 w-10 rounded-md flex items-center justify-center text-sm transition-colors border ${localFilters.beds === bed
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-white text-slate-700 hover:border-slate-400 border-slate-300'
                    }`}
                >
                  {bed}{bed === 5 ? '+' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Bathrooms */}
          <div className="space-y-2">
            <Label className="text-[13px] font-semibold text-slate-700">Bathrooms</Label>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4].map((bath) => (
                <button
                  key={bath}
                  onClick={() => updateFilter('baths', localFilters.baths === bath ? undefined : bath)}
                  className={`h-9 w-10 rounded-md flex items-center justify-center text-sm transition-colors border ${localFilters.baths === bath
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-white text-slate-700 hover:border-slate-400 border-slate-300'
                    }`}
                >
                  {bath}{bath === 4 ? '+' : ''}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={handleApplyFilters} className="h-10 w-full font-semibold">
            Apply filters
          </Button>
        </div>
      </div>
      {/* NOTE: Popular Locations section yahan se hata di — ab PropertiesListing.tsx mein
          property listings ke upar chips ki shakal mein show hoti hai */}
    </div>
  );
}
 'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { propertyApi } from '@/lib/api';

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
      {/* NOTE: Popular Locations section yahan se hata di — ab PropertiesListing.tsx mein
          property listings ke upar chips ki shakal mein show hoti hai */}
    </div>
  );
}
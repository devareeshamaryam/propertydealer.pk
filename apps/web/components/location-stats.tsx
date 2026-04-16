'use client';

import { useState, useEffect, useRef } from 'react';
import { propertyApi } from '@/lib/api'; // Ensure propertyApi has getStats or similar
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface LocationStat {
  name: string;
  id: string; // areaId
  count: number;
}

interface StatsData {
  locations: LocationStat[];
  summary: Record<string, number>; // { 'house': 10, 'flat': 5 }
  listingTypes: Record<string, number>; // { 'rent': 10, 'sale': 20 }
  total: number;
}

interface LocationStatsProps {
  city?: string;
  purpose?: string;
}

export function LocationStats({ city = 'Multan', purpose }: LocationStatsProps) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'house' | 'flat' | 'plot' | 'commercial'>('all');
  const [listingType, setListingType] = useState<'sale' | 'rent'>(
    purpose === 'rent' ? 'rent' : 'sale'
  );

  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (purpose) {
      setListingType(purpose === 'rent' ? 'rent' : 'sale');
    }
  }, [purpose]);

  useEffect(() => {
    if (tabsRef.current) {
      const activeTabElement = tabsRef.current.querySelector(`[data-tab="${activeTab}"]`) as HTMLElement;
      if (activeTabElement) {
        activeTabElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center'
        });
      }
    }
  }, [activeTab]);

  useEffect(() => {
    fetchStats();
  }, [city, listingType, activeTab]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      // Pass activeTab as propertyType if it's not 'all'
      const type = activeTab === 'all' ? undefined : activeTab;
      const data = await propertyApi.getLocationStats(city, listingType, type);
      setStats(data);
    } catch (error) {
      console.error('Error fetching location stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="py-8 bg-gray-50 rounded-xl p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">
          {stats.total.toLocaleString()} Properties for {listingType === 'sale' ? 'Sale' : 'Rent'} in {city}
        </h2>
        <div className="flex gap-2">
          <Button
            variant={listingType === 'sale' ? 'default' : 'outline'}
            onClick={() => setListingType('sale')}
            size="sm"
          >
            For Sale
          </Button>
          <Button
            variant={listingType === 'rent' ? 'default' : 'outline'}
            onClick={() => setListingType('rent')}
            size="sm"
          >
            For Rent
          </Button>
        </div>
      </div>

      <div ref={tabsRef} className="flex gap-4 mb-6 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => setActiveTab('all')}
          data-tab="all"
          className={`px-4 py-2 rounded-full whitespace-nowrap ${activeTab === 'all'
            ? 'bg-primary text-white'
            : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
        >
          Total ({stats.total})
        </button>
        {Object.entries(stats.summary).map(([type, count]) => (
          <button
            key={type}
            data-tab={type}
            onClick={() => setActiveTab(type as any)}
            className={`px-4 py-2 rounded-full whitespace-nowrap capitalize ${activeTab === type
              ? 'bg-primary text-white'
              : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
          >
            {type}s ({count})
          </button>
        ))}
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-4">Locations</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.locations.map((loc) => (
            <Link
              href={`/properties?city=${city}&areaId=${loc.id}&listingType=${listingType}`}
              key={loc.id}
              className="text-gray-600 hover:text-primary hover:underline flex justify-between"
            >
              <span>{loc.name}</span>
              <span className="text-gray-400">({loc.count})</span>
            </Link>
          ))}
        </div>
        {stats.locations.length === 0 && (
          <p className="text-gray-500">No properties found in this location.</p>
        )}
      </div>
    </div>
  );
}

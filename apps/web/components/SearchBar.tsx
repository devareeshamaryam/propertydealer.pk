'use client'

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2, MapPin, Home } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { propertyApi } from '@/lib/api';
import { mapBackendToFrontendProperty, BackendProperty } from '@/lib/types/property-utils';
import { Property } from '@/lib/data';

interface SearchSuggestion {
  city: string;
  type: string;
  purpose: 'rent' | 'buy';
  matchType: 'city' | 'type' | 'location' | 'title';
  matchText: string;
  propertyCount?: number;
}

export default function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Helper function to convert city name to slug
  const cityToSlug = (cityName: string): string => {
    return cityName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  // Helper function to convert property type to slug
  const typeToSlug = (type: string): string => {
    return type.toLowerCase().trim();
  };

  // Fetch suggestions from backend
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!query.trim() || query.length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      try {
        setLoading(true);
        const response = await propertyApi.getAll();
        const backendProperties: BackendProperty[] = Array.isArray(response)
          ? response
          : (response as any).properties || [];

        const allProperties = backendProperties.map(mapBackendToFrontendProperty);

        const searchTerm = query.toLowerCase().trim();
        const matchedSuggestions: SearchSuggestion[] = [];
        const suggestionMap = new Map<string, SearchSuggestion>();

        // Search through properties and group by city/type/purpose combinations
        for (const property of allProperties) {
          if (!property.city || !property.type) continue;

          const cityMatch = property.city?.toLowerCase().includes(searchTerm);
          const typeMatch = property.type?.toLowerCase().includes(searchTerm);
          const locationMatch = property.location?.toLowerCase().includes(searchTerm);
          const titleMatch = property.name?.toLowerCase().includes(searchTerm);

          if (cityMatch || typeMatch || locationMatch || titleMatch) {
            const key = `${property.city}-${property.type}-${property.purpose}`;

            if (!suggestionMap.has(key)) {
              let matchType: 'city' | 'type' | 'location' | 'title' = 'city';
              let matchText = property.city;

              if (cityMatch) {
                matchType = 'city';
                matchText = property.city;
              } else if (typeMatch) {
                matchType = 'type';
                matchText = property.type;
              } else if (locationMatch) {
                matchType = 'location';
                matchText = property.location;
              } else if (titleMatch) {
                matchType = 'title';
                matchText = property.name;
              }

              suggestionMap.set(key, {
                city: property.city,
                type: property.type,
                purpose: property.purpose,
                matchType,
                matchText,
                propertyCount: 1,
              });
            } else {
              const existing = suggestionMap.get(key)!;
              existing.propertyCount = (existing.propertyCount || 0) + 1;
            }
          }
        }

        // Convert map to array and limit to 8 suggestions
        const uniqueSuggestions = Array.from(suggestionMap.values())
          .sort((a, b) => {
            // Prioritize city matches, then type matches
            if (a.matchType === 'city' && b.matchType !== 'city') return -1;
            if (a.matchType !== 'city' && b.matchType === 'city') return 1;
            return (b.propertyCount || 0) - (a.propertyCount || 0);
          })
          .slice(0, 8);

        setSuggestions(uniqueSuggestions);
        setShowSuggestions(uniqueSuggestions.length > 0);
      } catch (error) {
        console.error('Error fetching search suggestions:', error);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounceTimer);
  }, [query]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    const purpose = suggestion.purpose === 'buy' ? 'sale' : 'rent';
    const citySlug = cityToSlug(suggestion.city);
    const typeSlug = typeToSlug(suggestion.type);

    // Navigate to clean URL: /properties/rent/[city]/[type]
    router.push(`/properties/${purpose}/${citySlug}/${typeSlug}`);

    setQuery('');
    setShowSuggestions(false);
  };

  // Handle Enter key press
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && query.trim()) {
      if (suggestions.length > 0) {
        handleSuggestionClick(suggestions[0]!);
      } else {
        // Navigate to properties page with search query
        router.push(`/properties?search=${encodeURIComponent(query)}`);
        setQuery('');
        setShowSuggestions(false);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const getSuggestionIcon = (matchType: string) => {
    switch (matchType) {
      case 'city':
        return <MapPin className="w-4 h-4 text-primary" />;
      case 'type':
        return <Home className="w-4 h-4 text-primary" />;
      default:
        return <Search className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getSuggestionLabel = (suggestion: SearchSuggestion) => {
    const { matchType, matchText, city, type, purpose } = suggestion;
    switch (matchType) {
      case 'city':
        return `${matchText} Properties`;
      case 'type':
        return `${matchText} in ${city}`;
      case 'location':
        return `Properties in ${matchText}`;
      case 'title':
        return `${city} ${type} Properties`;
      default:
        return `${city} ${type} Properties`;
    }
  };

  return (
    <div ref={searchRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search properties, cities, types..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          onKeyDown={handleKeyDown}
          className="pl-10 pr-4 w-full"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-lg shadow-lg z-50 max-h-[400px] overflow-y-auto">
          {suggestions.map((suggestion, index) => {
            return (
              <button
                key={`${suggestion.city}-${suggestion.type}-${suggestion.purpose}-${index}`}
                onClick={() => handleSuggestionClick(suggestion)}
                className="w-full px-4 py-3 text-left hover:bg-secondary transition-colors flex items-start gap-3 border-b border-border last:border-b-0"
              >
                <div className="mt-0.5 shrink-0">
                  {getSuggestionIcon(suggestion.matchType)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground truncate">
                    {getSuggestionLabel(suggestion)}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>{suggestion.city}</span>
                    <span>•</span>
                    <span>{suggestion.type}</span>
                    <span>•</span>
                    <span className="capitalize">{suggestion.purpose === 'buy' ? 'For Sale' : 'For Rent'}</span>
                    {suggestion.propertyCount && suggestion.propertyCount > 1 && (
                      <>
                        <span>•</span>
                        <span>{suggestion.propertyCount} properties</span>
                      </>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}


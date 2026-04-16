// lib/server-api.ts
import { Blog } from './types/blog';
import { BackendProperty } from './types/property-utils';

// For server-side (SSR/SSG) fetches, use the internal URL to avoid routing
// through the public internet/nginx when both Next.js and the API share the same host.
// INTERNAL_API_URL should be set to http://localhost:<API_PORT> in production.
// Falls back to NEXT_PUBLIC_API_URL (browser-facing URL) then localhost:3005.
const RAW_API_URL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3005';
const BASE_URL = RAW_API_URL.trim().endsWith('/')
  ? `${RAW_API_URL.trim()}api`
  : `${RAW_API_URL.trim()}/api`;

console.log('🚀 Server API Base URL:', BASE_URL);

/**
 * Server-side API utility that uses standard fetch with Next.js caching.
 * This is meant to be used in Server Components.
 */
export const serverApi = {
  /**
   * Fetch data with revalidation tags/time for optimal performance.
   */
  async get<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = path.startsWith('/') ? `${BASE_URL}${path}` : `${BASE_URL}/${path}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        next: {
          revalidate: 3600, // Default cache for 1 hour
          ...options.next,
        },
      });

      if (!response.ok) {
        if (response.status !== 404) {
           console.error(`❌ API Error [${response.status}] for ${url}. BaseURL: ${BASE_URL}`);
        }
        throw new Error(`API Error: ${response.status} ${response.statusText} at ${path}`);
      }

      return response.json();
    } catch (error: any) {
      if (!error.message?.includes('404')) {
        console.error(`💥 Fetch Failed for ${url}. (BaseURL: ${BASE_URL}) Error:`, error.message);
        if (error.cause) console.error('  Cause:', error.cause);
      }
      throw error;
    }
  },

  // City API
  async getCities(): Promise<any[]> {
    return this.get('/cities', { next: { revalidate: 60, tags: ['cities'] } }); // Cache cities for 1 minute
  },

  async getCityByName(name: string): Promise<any> {
    return this.get(`/cities/name/${name}`, { next: { revalidate: 60, tags: ['cities'] } });
  },

  // Property API
  async getProperties(params: string = ''): Promise<any> {
    const path = params ? `/properties?${params}` : '/properties';
    return this.get(path, { next: { revalidate: 60 } }); // Cache properties for 1 minute
  },

  async getTypes(): Promise<string[]> {
    return this.get('/properties/types', { next: { revalidate: 60 } }); // Cache types for 1 minute
  },

  async getAreaBySlug(slug: string, cityId?: string): Promise<any> {
    const query = cityId ? `?cityId=${cityId}` : '';
    return this.get(`/areas/slug/${slug}${query}`, { next: { revalidate: 3600 } });
  },

  async getAreasByCity(cityId: string): Promise<any[]> {
    return this.get(`/areas?cityId=${cityId}`, { next: { revalidate: 3600 } });
  },

  async getPropertyBySlug(slug: string): Promise<any> {
    return this.get(`/properties/slug/${slug}`, { next: { revalidate: 1800 } });
  },

  async getLocationStats(city: string): Promise<any> {
    return this.get(`/properties/stats/locations?city=${encodeURIComponent(city)}`, { 
      next: { revalidate: 900 } 
    });
  },

  // Blog API
  async getPublishedBlogs(): Promise<Blog[]> {
    return this.get('/blog/published', { next: { revalidate: 1800 } }); // Cache blogs for 30 minutes
  },

  // Page API
  async getPageBySlug(slug: string): Promise<any> {
    return this.get(`/page/slug/${slug}`, { next: { revalidate: 1800 } });
  },
};

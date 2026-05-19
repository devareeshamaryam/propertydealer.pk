 // lib/server-api.ts
import { Blog } from './types/blog';
import { BackendProperty } from './types/property-utils';

const RAW_API_URL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3005';
const BASE_URL = RAW_API_URL.trim().endsWith('/')
  ? `${RAW_API_URL.trim()}api`
  : `${RAW_API_URL.trim()}/api`;

console.log('🚀 Server API Base URL:', BASE_URL);

export const serverApi = {
  async get<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = path.startsWith('/') ? `${BASE_URL}${path}` : `${BASE_URL}/${path}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        next: {
          revalidate: 3600,
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
    return this.get('/cities', { next: { revalidate: 60, tags: ['cities'] } });
  },

  async getCityByName(name: string): Promise<any> {
    return this.get(`/cities/name/${name}`, { next: { revalidate: 60, tags: ['cities'] } });
  },

  // Property API
  // Note: tag values must match the tags emitted by the API on writes
  // (see RevalidateService callers in NestJS). Mismatches mean the page
  // won't refresh until natural TTL elapses.
  async getProperties(params: string = ''): Promise<any> {
    const path = params ? `/properties?${params}` : '/properties';
    return this.get(path, { next: { revalidate: 60, tags: ['properties'] } });
  },

  async getTypes(): Promise<string[]> {
    return this.get('/properties/types', { next: { revalidate: 60, tags: ['property-types'] } });
  },

  async getAreaBySlug(slug: string, cityId?: string): Promise<any> {
    const query = cityId ? `?cityId=${cityId}` : '';
    return this.get(`/areas/slug/${slug}${query}`, { next: { revalidate: 60, tags: ['areas'] } });
  },

  async getAreasByCity(cityId: string): Promise<any[]> {
    return this.get(`/areas?cityId=${cityId}`, { next: { revalidate: 60, tags: ['areas'] } });
  },

  async getPropertyBySlug(slug: string): Promise<any> {
    return this.get(`/properties/slug/${slug}`, {
      next: { revalidate: 60, tags: ['properties', `property:slug:${slug}`] },
    });
  },

  async getLocationStats(city: string): Promise<any> {
    return this.get(`/properties/stats/locations?city=${encodeURIComponent(city)}`, {
      next: { revalidate: 60, tags: ['properties'] },
    });
  },

  // Blog API
  async getPublishedBlogs(): Promise<Blog[]> {
    return this.get('/blog/published', { next: { revalidate: 60, tags: ['blogs'] } });
  },

  // Page API
  async getPageBySlug(slug: string): Promise<any> {
    return this.get(`/page/slug/${slug}`, { next: { revalidate: 60, tags: ['pages', `page:slug:${slug}`] } });
  },

  // Cement Rate API
  async getCementRates(): Promise<any[]> {
    try {
      return this.get('/cement-rate', { next: { revalidate: 60, tags: ['material-rates'] } });
    } catch {
      return [];
    }
  },

  async getCementRateBySlug(slug: string): Promise<any> {
    return this.get(`/cement-rate/slug/${slug}`, { next: { revalidate: 60, tags: ['material-rates'] } });
  },

  // Material Rate API (generic)
  async getMaterialRates(materialType: string): Promise<any[]> {
    try {
      return this.get(`/material-rate?materialType=${encodeURIComponent(materialType)}`, { next: { revalidate: 60, tags: ['material-rates'] } });
    } catch {
      return [];
    }
  },

  async getMaterialRateBySlug(slug: string): Promise<any> {
    return this.get(`/material-rate/slug/${slug}`, { next: { revalidate: 60, tags: ['material-rates'] } });
  },

  // Sand Rate API
  async getSandRates(): Promise<any[]> {
    try {
      return this.get('/sand-rate', { next: { revalidate: 60, tags: ['sand-rates'] } });
    } catch {
      return [];
    }
  },

  async getSandRateBySlug(slug: string): Promise<any> {
    return this.get(`/sand-rate/slug/${slug}`, { next: { revalidate: 60, tags: ['material-rates'] } });
  },

  // Steel Rate API
  async getSteelRates(): Promise<any[]> {
    try {
      return this.get('/steel-rate', { next: { revalidate: 60, tags: ['steel-rates'] } });
    } catch {
      return [];
    }
  },

  async getSteelRateBySlug(slug: string): Promise<any> {
    return this.get(`/steel-rate/slug/${slug}`, { next: { revalidate: 60, tags: ['material-rates'] } });
  },

  // Wood Rate API
  async getWoodRates(): Promise<any[]> {
    try {
      return this.get('/wood-rate', { next: { revalidate: 60, tags: ['wood-rates'] } });
    } catch {
      return [];
    }
  },

  async getWoodRateBySlug(slug: string): Promise<any> {
    return this.get(`/wood-rate/slug/${slug}`, { next: { revalidate: 60, tags: ['material-rates'] } });
  },

  // Door Rate API
  async getDoorRates(): Promise<any[]> {
    try {
      return this.get('/door-rate', { next: { revalidate: 60, tags: ['door-rates'] } });
    } catch {
      return [];
    }
  },

  async getDoorRateBySlug(slug: string): Promise<any> {
    return this.get(`/door-rate/slug/${slug}`, { next: { revalidate: 60, tags: ['material-rates'] } });
  },

  // Bajri Rate API
  async getBajriRates(): Promise<any[]> {
    try {
      return this.get('/bajri-rate', { next: { revalidate: 60, tags: ['bajri-rates'] } });
    } catch {
      return [];
    }
  },

  async getBajriRateBySlug(slug: string): Promise<any> {
    return this.get(`/bajri-rate/slug/${slug}`, { next: { revalidate: 60, tags: ['material-rates'] } });
  },

  // Tile Rate API
  async getTileRates(): Promise<any[]> {
    try {
      return this.get('/tile-rate', { next: { revalidate: 60, tags: ['tile-rates'] } });
    } catch {
      return [];
    }
  },

  async getTileRateBySlug(slug: string): Promise<any> {
    return this.get(`/tile-rate/slug/${slug}`, { next: { revalidate: 60, tags: ['material-rates'] } });
  },

  // Tile Category API
  async getTileCategories(): Promise<any[]> {
    try {
      return this.get('/tile-category', { next: { revalidate: 300, tags: ['tile-categories'] } });
    } catch {
      return [];
    }
  },

  // Bricks Rate API
  async getBricksRates(): Promise<any[]> {
    try {
      return this.get('/bricks-rate', { next: { revalidate: 60, tags: ['bricks-rates'] } });
    } catch {
      return [];
    }
  },

  async getBricksRateBySlug(slug: string): Promise<any> {
    return this.get(`/bricks-rate/slug/${slug}`, { next: { revalidate: 60, tags: ['material-rates'] } });
  },
};
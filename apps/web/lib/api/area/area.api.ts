 import api from '../../api'

export interface SizeContentItem {
  size: '2marla' | '3marla' | '5marla' | '10marla' | '1kanal';
  purpose: 'rent' | 'sale' | 'all';
  metaTitle?: string;
  metaDescription?: string;
  content?: string;
}

export interface CreateAreaData {
  name: string;
  city: string; // City ID
  areaSlug: string;
  // General SEO
  metaTitle?: string;
  metaDescription?: string;
  canonicalUrl?: string;
  description?: string;
  // Rent-specific
  rentMetaTitle?: string;
  rentMetaDescription?: string;
  rentContent?: string;
  // Sale-specific
  saleMetaTitle?: string;
  saleMetaDescription?: string;
  saleContent?: string;
  // 🆕 Size-specific content
  sizeContents?: SizeContentItem[];
}

export interface AreaOverview {
  _id: string;
  name: string;
  areaSlug?: string;
  city?: string;
  createdAt?: string;
  mergedInto?: string;
  mergedIntoSlug?: string;
  hidden?: boolean;
  source?: string;
  listings: number;
}

export const areaApi = {
  create: async (data: CreateAreaData) => {
    const response = await api.post('/areas', data);
    return response.data;
  },

  /**
   * id, name, slug — for dropdowns and the location panel, optionally for one
   * city. The full documents carry each area's SEO content. Falls back to the
   * full list on an API without /names.
   */
  getNames: async (cityId?: string): Promise<{ _id: string; name: string; areaSlug?: string; city?: string }[]> => {
    try {
      const response = await api.get("/areas/names", { params: cityId ? { cityId } : {} });
      if (Array.isArray(response.data)) return response.data;
    } catch {
      // older API
    }
    const response = await api.get(cityId ? `/areas?cityId=${cityId}` : "/areas");
    return (response.data ?? []).map((a: any) => ({ _id: a._id, name: a.name, areaSlug: a.areaSlug, city: a.city?._id ?? a.city }));
  },

  getAll: async (cityId?: string) => {
    const url = cityId ? `/areas?cityId=${cityId}` : '/areas';
    const response = await api.get(url);
    return response.data;
  },

  /** Dashboard: every area with its status and listing count. */
  adminOverview: async (): Promise<AreaOverview[]> => {
    const response = await api.get("/areas/admin/overview");
    return Array.isArray(response.data) ? response.data : [];
  },

  /** Folds `id` into `into`: listings move, the old URL keeps working and points to the kept area. */
  merge: async (id: string, into: string): Promise<{ kept: string; keptSlug: string; moved: number }> => {
    const response = await api.post(`/areas/${id}/merge`, { into });
    return response.data;
  },

  unmerge: async (id: string) => {
    const response = await api.post(`/areas/${id}/unmerge`);
    return response.data;
  },

  setHidden: async (id: string, hidden: boolean) => {
    const response = await api.post(`/areas/${id}/hidden`, { hidden });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/areas/${id}`);
    return response.data;
  },

  update: async (id: string, data: Partial<CreateAreaData>) => {
    const response = await api.put(`/areas/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/areas/${id}`);
    return response.data;
  },

  getByName: async (name: string, cityId?: string) => {
    const url = cityId ? `/areas/name/${name}?cityId=${cityId}` : `/areas/name/${name}`;
    const response = await api.get(url);
    return response.data;
  },
};

export default areaApi;
import api from '../../api'

export interface TypeContent {
  propertyType: string;
  purpose: 'rent' | 'sale' | 'all';
  metaTitle?: string;
  metaDescription?: string;
  content?: string;
}

export interface CreateCityData {
  name: string;
  state?: string;
  country?: string;
  metaTitle?: string;
  metaDescription?: string;
  rentMetaTitle?: string;
  rentMetaDescription?: string;
  saleMetaTitle?: string;
  saleMetaDescription?: string;
  canonicalUrl?: string;
  description?: string;
  rentContent?: string;
  saleContent?: string;
  buyContent?: string;
  thumbnail?: string;
  typeContents?: TypeContent[];
}

export interface UpdateCityData {
  name?: string;
  state?: string;
  country?: string;
  metaTitle?: string;
  metaDescription?: string;
  rentMetaTitle?: string;
  rentMetaDescription?: string;
  saleMetaTitle?: string;
  saleMetaDescription?: string;
  canonicalUrl?: string;
  description?: string;
  rentContent?: string;
  saleContent?: string;
  buyContent?: string;
  thumbnail?: string;
  typeContents?: TypeContent[];
}

export const cityApi = {
  create: async (data: CreateCityData) => {
    const response = await api.post('/cities', data);
    return response.data;
  },
  
  getAll: async () => {
    const response = await api.get('/cities');
    return response.data;
  },

  /**
   * Names only, for dropdowns. The full list carries every city's SEO text
   * (~1 MB) and took 10+ seconds whenever the API's cache was cold.
   */
  getNames: async (): Promise<any[]> => {
    try {
      const response = await api.get('/cities/names');
      if (Array.isArray(response.data)) return response.data;
    } catch {
      // older API
    }
    const response = await api.get('/cities');
    return response.data;
  },
  
  getById: async (id: string) => {
    const response = await api.get(`/cities/${id}`);
    return response.data;
  },
  
  update: async (id: string, data: UpdateCityData) => {
    const response = await api.put(`/cities/${id}`, data);
    return response.data;
  },
  
  delete: async (id: string) => {
    const response = await api.delete(`/cities/${id}`);
    return response.data;
  },
  
  getByName: async (name: string) => {
    const response = await api.get(`/cities/name/${name}`);
    return response.data;
  },
};

export default cityApi;
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

export const areaApi = {
  create: async (data: CreateAreaData) => {
    const response = await api.post('/areas', data);
    return response.data;
  },

  getAll: async (cityId?: string) => {
    const url = cityId ? `/areas?cityId=${cityId}` : '/areas';
    const response = await api.get(url);
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
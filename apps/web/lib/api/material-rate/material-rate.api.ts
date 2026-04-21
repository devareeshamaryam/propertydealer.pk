import api from "@/lib/api";

export interface MaterialRateData {
  _id?: string;
  brand: string;
  slug?: string;
  title?: string;
  price: number;
  change?: number;
  city?: string;
  unit?: string;
  materialType?: string;
  category?: string;
  image?: string;
  images?: string[];
  description?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateMaterialRateData {
  brand: string;
  price: number;
  city: string;
  materialType: string;
  change?: number;
  unit?: string;
  category?: string;
  title?: string;
  image?: string;
  images?: string[];
  description?: string;
  isActive?: boolean;
}

const materialRateApi = {
  getAllRates: async (materialType?: string) => {
    const params = new URLSearchParams();
    if (materialType) params.append('materialType', materialType);
    const url = params.toString() ? `/material-rate/admin/all?${params.toString()}` : '/material-rate/admin/all';
    const response = await api.get(url);
    return response.data as MaterialRateData[];
  },

  getPublicRates: async (materialType: string, city?: string, category?: string) => {
    const params = new URLSearchParams();
    params.append('materialType', materialType);
    if (city) params.append('city', city);
    if (category) params.append('category', category);
    const url = `/material-rate?${params.toString()}`;
    const response = await api.get(url);
    return response.data as MaterialRateData[];
  },

  getRateById: async (id: string) => {
    const response = await api.get(`/material-rate/${id}`);
    return response.data as MaterialRateData;
  },

  getRateBySlug: async (slug: string) => {
    const response = await api.get(`/material-rate/slug/${slug}`);
    return response.data as MaterialRateData;
  },

  createRate: async (formData: FormData) => {
    const response = await api.post("/material-rate", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data as MaterialRateData;
  },

  updateRate: async (id: string, formData: FormData) => {
    const response = await api.put(`/material-rate/${id}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data as MaterialRateData;
  },

  deleteRate: async (id: string) => {
    const response = await api.delete(`/material-rate/${id}`);
    return response;
  },
};

export default materialRateApi;

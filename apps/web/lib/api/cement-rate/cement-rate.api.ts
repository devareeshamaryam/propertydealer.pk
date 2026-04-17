 import api from "@/lib/api";

export interface CementRateData {
  _id?: string;
  brand: string;
  slug?: string;
  title?: string;
  price: number;
  change?: number;
  weightKg?: number;
  category?: string;
  image?: string;
  images?: string[];   // ✅ added
  description?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateCementRateData {
  brand: string;
  price: number;
  change?: number;
  weightKg?: number;
  category?: string;
  title?: string;
  image?: string;
  images?: string[];   // ✅ added
  description?: string;
  isActive?: boolean;
}

const cementRateApi = {
  getAllRates: async () => {
    const response = await api.get("/cement-rate/admin/all");
    return response.data as CementRateData[];
  },

  getPublicRates: async (category?: string) => {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    const url = params.toString() ? `/cement-rate?${params.toString()}` : '/cement-rate';
    const response = await api.get(url);
    return response.data as CementRateData[];
  },

  getRateById: async (id: string) => {
    const response = await api.get(`/cement-rate/${id}`);
    return response.data as CementRateData;
  },

  getRateBySlug: async (slug: string) => {
    const response = await api.get(`/cement-rate/slug/${slug}`);
    return response.data as CementRateData;
  },

  createRate: async (formData: FormData) => {
    const response = await api.post("/cement-rate", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data as CementRateData;
  },

  updateRate: async (id: string, formData: FormData) => {
    const response = await api.put(`/cement-rate/${id}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data as CementRateData;
  },

  deleteRate: async (id: string) => {
    const response = await api.delete(`/cement-rate/${id}`);
    return response;
  },
};

export default cementRateApi;
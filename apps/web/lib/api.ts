// lib/api.ts
import axios from "axios";
import { BackendProperty } from "./types/property-utils";

const getBaseURL = () => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return "/api";
  const baseURL = apiUrl.endsWith("/") ? `${apiUrl}api` : `${apiUrl}/api`;
  return baseURL;
};

// In-memory access token storage — works even when cross-origin cookies are blocked
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (typeof window !== "undefined") {
    if (token) {
      localStorage.setItem("accessToken", token);
    } else {
      localStorage.removeItem("accessToken");
    }
  }
}

// Initialize from localStorage on module load
if (typeof window !== "undefined") {
  accessToken = localStorage.getItem("accessToken");
}

export function getAccessToken(): string | null {
  // Always try localStorage as a fallback in case the in-memory value was lost
  if (!accessToken && typeof window !== "undefined") {
    accessToken = localStorage.getItem("accessToken");
  }
  return accessToken;
}

const api = axios.create({
  baseURL: getBaseURL(),
  withCredentials: true, // still send cookies when possible
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor — attach Bearer token from memory (or localStorage) for every request
api.interceptors.request.use((config) => {
  // Refresh from localStorage each time in case in-memory was lost (e.g. after SSR/page reload)
  const token = getAccessToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for auto refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Determine request type
    const isRefreshRequest = originalRequest.url?.includes("/auth/refresh");
    const isProfileRequest = originalRequest.url?.includes("/auth/profile");
    const isOnAuthPage =
      typeof window !== "undefined" &&
      (window.location.pathname.includes("/login") ||
       window.location.pathname.includes("/register"));

    // For 401 errors, attempt refresh only for non-special requests
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isRefreshRequest &&
      !isProfileRequest &&
      !isOnAuthPage
    ) {
      originalRequest._retry = true;

      try {
        const refreshResponse = await api.post("/auth/refresh");
        // Store new access token from refresh response
        if (refreshResponse.data?.token) {
          setAccessToken(refreshResponse.data.token);
        }
        // Retry the original request with the new token
        const token = getAccessToken();
        if (token && originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${token}`;
        }
        return api(originalRequest);
      } catch (refreshError) {
        console.warn("Refresh token expired or missing → session ended");
        // Clear stored token
        setAccessToken(null);

        if (typeof window !== "undefined") {
          const isOnDashboard = window.location.pathname.includes("/dashboard");
          if (isOnDashboard) {
            // Small delay so any pending toasts can show before redirect
            setTimeout(() => {
              window.location.href = "/login?sessionExpired=true";
            }, 300);
          }
        }

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

// Property API types
export interface PropertyResponse {
  properties: BackendProperty[];
  total: number;
  totalPages: number;
  currentPage: number;
}

// Property API functions
export const propertyApi = {
  // Get all approved properties
  // Get all approved properties with pagination and filters
  getAll: async (filters?: {
    cityId?: string;
    cityName?: string;
    areaId?: string;
    areaSlug?: string;
    page?: number;
    limit?: number;
    priceMin?: number;
    priceMax?: number;
    areaMin?: number;
    areaMax?: number;
    marlaMin?: number;
    marlaMax?: number;
    beds?: number;
    baths?: number;
    type?: string;
    purpose?: string;
    search?: string;
  }): Promise<PropertyResponse | BackendProperty[]> => {
    const params = new URLSearchParams();
    if (filters?.cityId) params.append("cityId", filters.cityId);
    if (filters?.cityName) params.append("city", filters.cityName);

    if (filters?.areaId) params.append("areaId", filters.areaId);
    if (filters?.search) params.append("search", filters.search);
    if (filters?.page) params.append("page", filters.page.toString());
    if (filters?.limit) params.append("limit", filters.limit.toString());
    if (filters?.priceMin) params.append("priceMin", filters.priceMin.toString());
    if (filters?.priceMax) params.append("priceMax", filters.priceMax.toString());
    if (filters?.areaMin) params.append("areaMin", filters.areaMin.toString());
    if (filters?.areaMax) params.append("areaMax", filters.areaMax.toString());
    if (filters?.marlaMin) params.append("marlaMin", filters.marlaMin.toString());
    if (filters?.marlaMax) params.append("marlaMax", filters.marlaMax.toString());
    if (filters?.beds) params.append("beds", filters.beds.toString());
    if (filters?.baths) params.append("baths", filters.baths.toString());
    if (filters?.type && filters.type !== 'all') params.append("type", filters.type);
    if (filters?.purpose && filters.purpose !== 'all') params.append("purpose", filters.purpose);

    const queryString = params.toString();
    const url = queryString ? `/properties?${queryString}` : "/properties";
    const response = await api.get(url);
    return response.data;
  },

  // Get dynamic property types
  getTypes: async () => {
    const response = await api.get("/properties/types");
    return response.data;
  },

  // get property by id
  getPropertyById: async (params: { id: string }) => {
    const response = await api.get(`/properties/${params.id}`);
    return response.data;
  },
  // Get all properties (for dashboard - includes pending, approved, rejected)
  getAllProperties: async () => {
    const response = await api.get("/properties/all");
    return response.data;
  },

  // Get property by slug
  getPropertyBySlug: async (params: { slug: string }) => {
    const response = await api.get(`/properties/slug/${params.slug}`);
    return response.data;
  },

  updateStatus: async (propertyId: string) => {
    const response = await api.patch(`/properties/${propertyId}/update-status`);
    return response.data;
  },
  // Create a new property
  create: async (data: FormData) => {
    const response = await api.post("/properties", data, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  // Update a property
  update: async (propertyId: string, data: FormData) => {
    const response = await api.put(`/properties/${propertyId}`, data, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  // Delete a property
  delete: async (propertyId: string) => {
    const response = await api.delete(`/properties/${propertyId}`);
    return response.data;
  },

  // Get location statistics
  getLocationStats: async (
    city: string,
    listingType?: string,
    propertyType?: string,
  ) => {
    const params = new URLSearchParams();
    params.append("city", city);
    if (listingType) params.append("listingType", listingType);
    if (propertyType) params.append("propertyType", propertyType);

    const response = await api.get(
      `/properties/stats/locations?${params.toString()}`,
    );
    return response.data;
  },

  // Upload image
  uploadImage: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post("/properties/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },
};

// Blog API functions
export const blogApi = {
  // Get all published blogs (for public frontend)
  getPublishedBlogs: async () => {
    const response = await api.get("/blog/published");
    return response.data;
  },

  // Get all blogs (for admin dashboard - can filter by status)
  getAllBlogs: async (status?: string) => {
    const url = status ? `/blog?status=${status}` : "/blog";
    const response = await api.get(url);
    return response.data;
  },

  // Get blog by ID
  getBlogById: async (id: string) => {
    const response = await api.get(`/blog/${id}`);
    return response.data;
  },

  // Get blog by slug (SEO-friendly URL)
  getBlogBySlug: async (slug: string) => {
    const response = await api.get(`/blog/slug/${slug}`);
    return response.data;
  },

  // Increment blog views (for analytics)
  incrementViews: async (id: string) => {
    await api.post(`/blog/${id}/views`);
  },
};

// Package API functions
export const packageApi = {
  getAll: async () => {
    const response = await api.get("/packages");
    return response.data;
  },

  getAllIncludingInactive: async () => {
    const response = await api.get("/packages/all");
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/packages/${id}`);
    return response.data;
  },

  create: async (dto: any) => {
    const response = await api.post("/packages", dto);
    return response.data;
  },

  update: async (id: string, dto: any) => {
    const response = await api.put(`/packages/${id}`, dto);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/packages/${id}`);
    return response.data;
  },
};

// Subscription API functions
export const subscriptionApi = {
  purchase: async (packageId: string) => {
    const response = await api.post("/subscriptions/purchase", { packageId });
    return response.data;
  },

  getMySubscriptions: async () => {
    const response = await api.get("/subscriptions/my-subscriptions");
    return response.data;
  },

  getActiveSubscription: async () => {
    const response = await api.get("/subscriptions/active");
    return response.data;
  },

  canCreateProperty: async () => {
    const response = await api.get("/subscriptions/can-create-property");
    return response.data;
  },

  getAll: async () => {
    const response = await api.get("/subscriptions");
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/subscriptions/${id}`);
    return response.data;
  },

  activate: async (id: string) => {
    const response = await api.put(`/subscriptions/${id}/activate`);
    return response.data;
  },

  cancel: async (id: string) => {
    const response = await api.put(`/subscriptions/${id}/cancel`);
    return response.data;
  },
};

export const importApi = {
  importWordPress: async (formData: FormData) => {
    const response = await api.post("/import/wordpress", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data; // { totalFound, imported, skipped, ... }
  },
};

// City API functions
export const cityApi = {
  getAll: async () => {
    const response = await api.get("/cities");
    return response.data;
  },
  getById: async (id: string) => {
    const response = await api.get(`/cities/${id}`);
    return response.data;
  },
  getByName: async (name: string) => {
    const response = await api.get(`/cities/name/${name}`);
    return response.data;
  },
};

// Area API functions
export const areaApi = {
  getAll: async () => {
    const response = await api.get("/areas");
    return response.data;
  },
  getAreasByCity: async (cityId: string) => {
    const response = await api.get(`/areas?cityId=${cityId}`);
    return response.data;
  },
  getById: async (id: string) => {
    const response = await api.get(`/areas/${id}`);
    return response.data;
  },
  getBySlug: async (slug: string, cityId?: string) => {
    const url = cityId ? `/areas/slug/${slug}?cityId=${cityId}` : `/areas/slug/${slug}`;
    const response = await api.get(url);
    return response.data;
  },
};

// User API functions
export const userApi = {
  getAll: async () => {
    const response = await api.get("/users");
    return response.data;
  },
  getById: async (id: string) => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },
  update: async (id: string, data: any) => {
    const response = await api.patch(`/users/${id}`, data);
    return response.data;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  },
};

// Page API functions
export const pageApi = {
  getAll: async () => {
    const response = await api.get("/page");
    return response.data;
  },
  getPublished: async () => {
    const response = await api.get("/page/published");
    return response.data;
  },
  getById: async (id: string) => {
    const response = await api.get(`/page/${id}`);
    return response.data;
  },
  getBySlug: async (slug: string) => {
    const response = await api.get(`/page/slug/${slug}`);
    return response.data;
  },
};

export default api;

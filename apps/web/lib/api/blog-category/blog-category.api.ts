import api from "@/lib/api";

export interface CreateCategoryData {
    name: string;
    description?: string;
    slug?: string;
    parentId?: string;
}

export interface UpdateCategoryData {
    name?: string;
    description?: string;
    slug?: string;
    parentId?: string | null;
}

const blogCategoryApi = {
    // Create a new category
    createCategory: async (data: CreateCategoryData) => {
        const response = await api.post("/category", data);
        return response;
    },

    // Get all categories
    getAllCategories: async () => {
        const response = await api.get("/category");
        return response.data;
    },

    // Get category by ID
    getCategoryById: async (id: string) => {
        const response = await api.get(`/category/${id}`);
        return response.data;
    },

    // Get category by slug
    getCategoryBySlug: async (slug: string) => {
        const response = await api.get(`/category/slug/${slug}`);
        return response.data;
    },

    // Update category
    updateCategory: async (id: string, data: UpdateCategoryData) => {
        const response = await api.put(`/category/${id}`, data);
        return response.data;
    },

    // Delete category
    deleteCategory: async (id: string) => {
        const response = await api.delete(`/category/${id}`);
        return response;
    }
}

export default blogCategoryApi;
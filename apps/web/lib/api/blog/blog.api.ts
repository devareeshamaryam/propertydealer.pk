import api from "@/lib/api";

export interface CreateBlogData {
    title: string;
    content: string;
    excerpt?: string;
    slug?: string;
    tags?: string[];
    featuredImage?: string;
    status?: 'draft' | 'published';
    metaTitle?: string;
    metaDescription?: string;
    canonicalUrl?: string;
    categoryId?: string;
    categories?: string[];
    author?: string;
}

export interface UpdateBlogData {
    title?: string;
    content?: string;
    excerpt?: string;
    slug?: string;
    tags?: string[];
    featuredImage?: string;
    status?: 'draft' | 'published';
    metaTitle?: string;
    metaDescription?: string;
    canonicalUrl?: string;
    categories?: string[];
}

const blogApi = {
    // Create a new blog
    createBlog: async (data: CreateBlogData) => {
        const response = await api.post("/blog", data);
        return response;
    },

    // get active blogs 
    getPublishedBlogs: async () => {
        const response = await api.get("/blog/published");
        return response.data;
    },


    // Get all blogs (optionally filtered by status)
    getAllBlogs: async (status?: string) => {
        const url = status ? `/blog?status=${status}` : '/blog';
        const response = await api.get(url);
        return response.data;
    },

    // Get blog by ID
    getBlogById: async (id: string) => {
        const response = await api.get(`/blog/${id}`);
        return response.data;
    },

    // Get blog by slug
    // Note: Axios automatically URL-encodes path parameters
    // NestJS automatically decodes them on the backend
    getBlogBySlug: async (slug: string) => {
        // Clean the slug: remove leading/trailing slashes and whitespace
        const cleanSlug = slug.trim().replace(/^\/+|\/+$/g, '');
        
        if (!cleanSlug) {
            throw new Error('Slug is required');
        }
        
        console.log('API: Fetching blog with slug:', cleanSlug);
        
        // Axios will automatically URL-encode the slug, but we need to ensure
        // special characters are handled correctly. encodeURIComponent handles
        // all special characters except: A-Z a-z 0-9 - _ . ! ~ * ' ( )
        // For slugs, we typically want to encode everything except alphanumeric and hyphens
        // But since Axios does this automatically, we just pass the clean slug
        const response = await api.get(`/blog/slug/${cleanSlug}`);
        console.log('API: Blog response received:', response.data);
        return response.data;
    },

    // Update blog
    updateBlog: async (id: string, data: UpdateBlogData) => {
        const response = await api.put(`/blog/${id}`, data);
        return response.data;
    },

    // Delete blog
    deleteBlog: async (id: string) => {
        const response = await api.delete(`/blog/${id}`);
        return response;
    },

    // Increment views
    incrementViews: async (id: string) => {
        const response = await api.post(`/blog/${id}/views`);
        return response;
    },


  // Get all blogs (for admin dashboard - can filter by status)
  // Get blog by ID
}

export default blogApi;


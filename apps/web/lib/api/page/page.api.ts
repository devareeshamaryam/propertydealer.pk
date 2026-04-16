import api from '../../api'

export interface CreatePageData {
    title: string;
    content: string;
    excerpt?: string;
    status?: 'DRAFT' | 'PUBLISHED';
    metaTitle?: string;
    metaDescription?: string;
    canonicalUrl?: string;
    featuredImage?: string;
    keywords?: string[];
}

export interface UpdatePageData {
    title?: string;
    content?: string;
    excerpt?: string;
    status?: 'DRAFT' | 'PUBLISHED';
    metaTitle?: string;
    metaDescription?: string;
    canonicalUrl?: string;
    featuredImage?: string;
    keywords?: string[];
}

export const pageApi = {
    getPublishedPages: async () => {
        const response = await api.get('/page/published');
        return response.data;
    },

    getAllPages: async () => {
        const response = await api.get('/page');
        return response.data;
    },

    getPageById: async (id: string) => {
        const response = await api.get(`/page/${id}`);
        return response.data;
    },

    getPageBySlug: async (slug: string) => {
        const response = await api.get(`/page/slug/${slug}`);
        return response.data;
    },

    deletePage: async (id: string) => {
        const response = await api.delete(`/page/${id}`);
        return response.data;
    },

    createPage: async (page: CreatePageData) => {
        const response = await api.post('/page', page);
        return response;
    },

    updatePage: async (id: string, page: UpdatePageData) => {
        const response = await api.put(`/page/${id}`, page);
        return response.data;
    },
}

export default pageApi;
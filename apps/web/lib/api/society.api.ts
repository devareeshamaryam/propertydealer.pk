import api from '@/lib/api';
import type { SocietyGuide, SocietyPage } from '@/lib/societies';

export interface SocietyAdminRow {
  _id: string;
  name: string;
  slug: string;
  cityId: string;
  cityName: string;
  citySlug: string;
  image: string;
  published: boolean;
  phases: number;
  listings: number;
  updatedAt?: string;
}

export interface SocietyAreaRow {
  _id: string;
  name: string;
  slug: string;
  kind: 'area' | 'society' | 'phase';
  parent: string | null;
  order: number;
  listings: number;
  image: string;
  tagline: string;
  overview: string;
}

export interface SocietyAdmin {
  _id: string;
  name: string;
  slug: string;
  kind: 'area' | 'society' | 'phase';
  cityId: string;
  cityName: string;
  citySlug: string;
  lat: number | null;
  lng: number | null;
  guide: SocietyGuide;
  listings: number;
  phases: SocietyAreaRow[];
  candidates: SocietyAreaRow[];
}

/** Dashboard → Societies. */
export const societyApi = {
  list: async (): Promise<SocietyAdminRow[]> => (await api.get('/societies/admin/all')).data,
  get: async (id: string): Promise<SocietyAdmin> => (await api.get(`/societies/admin/${id}`)).data,
  save: async (
    id: string,
    body: { kind?: 'society' | 'area'; guide?: SocietyGuide; phases?: { id: string; image?: string; tagline?: string; overview?: string }[] },
  ): Promise<SocietyAdmin> => (await api.put(`/societies/admin/${id}`, body)).data,
  addPhase: async (id: string, name: string): Promise<SocietyAdmin> => (await api.post(`/societies/admin/${id}/phases`, { name })).data,
  preview: async (citySlug: string, slug: string): Promise<SocietyPage> => (await api.get(`/societies/admin/preview/${citySlug}/${slug}`)).data,
};

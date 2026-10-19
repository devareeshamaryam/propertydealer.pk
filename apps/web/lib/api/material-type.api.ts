import api from '@/lib/api';
import type { MaterialTypeAdmin, MaterialTypeInfo } from '@/lib/materials';

/** Dashboard. */
export const materialTypeApi = {
  list: async (): Promise<MaterialTypeAdmin[]> => (await api.get('/material-types/admin/all')).data.data,
  create: async (data: Partial<MaterialTypeAdmin>) => (await api.post('/material-types', data)).data.data,
  update: async (id: string, data: Partial<MaterialTypeAdmin>) => (await api.put(`/material-types/${id}`, data)).data.data,
  remove: async (id: string) => (await api.delete(`/material-types/${id}`)).data.data,
  /** Public list, for client components outside the provider (the dashboard). */
  active: async (): Promise<MaterialTypeInfo[]> => (await api.get('/material-types')).data.data,
};

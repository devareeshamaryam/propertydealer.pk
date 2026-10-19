'use client';

import { createContext, useContext } from 'react';
import type { MaterialTypeInfo } from '@/lib/materials';

/**
 * The materials the admin added (Dashboard → Materials), loaded once by the
 * root layout, for the client components that list materials: the header's
 * Rates menu, the shop's material switcher, the product pages.
 */
const MaterialTypesContext = createContext<MaterialTypeInfo[]>([]);

export function MaterialTypesProvider({ value, children }: { value: MaterialTypeInfo[]; children: React.ReactNode }) {
  return <MaterialTypesContext.Provider value={value}>{children}</MaterialTypesContext.Provider>;
}

export function useMaterialTypes(): MaterialTypeInfo[] {
  return useContext(MaterialTypesContext);
}

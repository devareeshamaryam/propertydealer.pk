'use client';

import ProductDetailClient from '@/components/shop/ProductDetailClient';
import { toShopProduct, typeFromMaterial } from '@/lib/shop';

/*
 * Kept as the material pages' client entry so each [slug]/page.tsx (data,
 * metadata, URL) is untouched; the page itself is the shared
 * ProductDetailClient, with add-to-cart for every material.
 */
export default function MaterialDetailClient({ rate, materialType }: { rate: any; materialType: string }) {
  const product = toShopProduct(typeFromMaterial(materialType), rate);
  return <ProductDetailClient product={product} images={rate?.images ?? []} description={rate?.description} />;
}

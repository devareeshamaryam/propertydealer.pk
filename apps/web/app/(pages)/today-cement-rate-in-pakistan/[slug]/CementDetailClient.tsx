'use client';

import ProductDetailClient from '@/components/shop/ProductDetailClient';
import { toShopProduct } from '@/lib/shop';

/** The cement product page; the layout is the shared ProductDetailClient. */
export default function CementDetailClient({ rate }: { rate: any }) {
  const product = toShopProduct('cement', rate);
  return <ProductDetailClient product={product} images={rate?.images ?? []} description={rate?.description} />;
}

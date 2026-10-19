'use client';

import ShopCategoryClient from '@/components/shop/ShopCategoryClient';
import { toShopProduct } from '@/lib/shop';

/** The rates page of a material added from the dashboard — the same layout as the built-in ones. */
export default function CustomMaterialClient({
  slug,
  rates,
  heading,
  content,
}: {
  slug: string;
  rates: any[];
  heading: string;
  content?: string | null;
}) {
  const products = (rates ?? []).filter((r) => r && r.isActive !== false).map((r) => toShopProduct(slug, r));
  return <ShopCategoryClient type={slug} products={products} heading={heading} pageContent={content || null} cmsPageTitle={null} />;
}

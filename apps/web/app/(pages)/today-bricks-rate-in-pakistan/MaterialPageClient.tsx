"use client";

import ShopCategoryClient from "@/components/shop/ShopCategoryClient";
import { toShopProduct, typeFromMaterial } from "@/lib/shop";

/*
 * Kept as the page's client entry so page.tsx (data fetching, metadata,
 * URL) is untouched; the layout itself is the shared ShopCategoryClient.
 */

interface MaterialPageClientProps {
  initialRates: any[];
  materialType: string;
  pageTitle: string;
  pageContent: string | null;
  cmsPageTitle: string | null;
  tileCategories?: { name: string; slug: string; subcategories?: { name: string; slug: string }[] }[];
}

export default function MaterialPageClient({
  initialRates,
  materialType,
  pageTitle,
  pageContent,
  cmsPageTitle,
  tileCategories,
}: MaterialPageClientProps) {
  const type = typeFromMaterial(materialType);
  const products = (initialRates ?? [])
    .filter((r: any) => r && r.isActive !== false)
    .map((r: any) => toShopProduct(type, r));
  return (
    <ShopCategoryClient
      type={type}
      products={products}
      heading={pageTitle}
      pageContent={pageContent}
      cmsPageTitle={cmsPageTitle}
      tileCategories={tileCategories}
    />
  );
}

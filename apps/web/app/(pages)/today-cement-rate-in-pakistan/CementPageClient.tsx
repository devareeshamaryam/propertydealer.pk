"use client";

import ShopCategoryClient from "@/components/shop/ShopCategoryClient";
import { toShopProduct } from "@/lib/shop";

/*
 * The cement page's client entry; the layout is the shared
 * ShopCategoryClient. The ten hard-coded "fallback" brands with made-up
 * prices that showed when the database was empty are gone — an empty list
 * now says the rates are being updated instead of quoting invented prices.
 */

interface CementPageClientProps {
  initialBrands: any[];
  pageContent: string | null;
  pageTitle: string | null;
}

export default function CementPageClient({ initialBrands, pageContent, pageTitle }: CementPageClientProps) {
  const products = (initialBrands ?? [])
    .filter((r: any) => r && r.isActive !== false)
    .map((r: any) => toShopProduct("cement", r));
  return (
    <ShopCategoryClient
      type="cement"
      products={products}
      heading="Today Cement Rate in Pakistan"
      pageContent={pageContent}
      cmsPageTitle={pageTitle}
      fallbackContent={
        <>
          <h2 className="mb-3 text-lg font-bold text-slate-900">Today Cement Rate in Pakistan</h2>
          <p className="mb-4 text-sm leading-relaxed text-slate-600">
            PropertyDealer.pk publishes daily cement prices across the major brands — Lucky,
            Bestway, Maple Leaf, DG Khan, Fauji and more — for Lahore, Karachi, Islamabad,
            Rawalpindi, Peshawar and other cities across Pakistan.
          </p>
          <h3 className="mb-2 text-sm font-bold text-slate-800">Why do cement prices change?</h3>
          <p className="text-sm leading-relaxed text-slate-600">
            Cement prices in Pakistan move with coal and fuel costs, government taxes (FED) and
            seasonal demand. The construction season from February to June usually pushes
            prices up.
          </p>
        </>
      }
    />
  );
}

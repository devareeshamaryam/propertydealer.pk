 import { Metadata } from "next";
import { serverApi } from "@/lib/server-api";
import MaterialPageClient from "./MaterialPageClient";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  try {
    const page = await serverApi.getPageBySlug("today-tile-rate-in-pakistan");
    return {
      title: page?.metaTitle || "Today Tile Rate in Pakistan 2026 | PropertyDealer.pk",
      description: page?.metaDescription || "Check today's latest tile rates in Pakistan. Updated daily prices from top brands and suppliers.",
      keywords: page?.keywords || ["tile rate in Pakistan", "today tile price", "floor tiles price", "wall tiles rate"],
      alternates: { canonical: "/today-tile-rate-in-pakistan" },
      openGraph: {
        title: page?.metaTitle || "Today Tile Rate in Pakistan 2026 | PropertyDealer.pk",
        description: page?.metaDescription || "Check today's latest tile rates in Pakistan.",
        type: "article",
      },
    };
  } catch {
    return {
      title: "Today Tile Rate in Pakistan 2026 | PropertyDealer.pk",
      description: "Check today's latest tile rates in Pakistan. Updated daily prices from top brands and suppliers.",
      keywords: ["tile rate in Pakistan", "today tile price", "floor tiles price", "wall tiles rate"],
      alternates: { canonical: "/today-tile-rate-in-pakistan" },
      openGraph: {
        title: "Today Tile Rate in Pakistan 2026 | PropertyDealer.pk",
        description: "Check today's latest tile rates in Pakistan.",
        type: "article",
      },
    };
  }
}

export default async function TileRatePage() {
  let rates: any[] = [];
  let pageContent: string | null = null;
  let pageTitle: string | null = null;
  let tileCategories: any[] = [];

  const [ratesResult, pageResult, categoriesResult] = await Promise.allSettled([
    serverApi.getTileRates(),
    serverApi.getPageBySlug("today-tile-rate-in-pakistan"),
    serverApi.getTileCategories(),
  ]);

  if (ratesResult.status === "fulfilled") {
    rates = ratesResult.value ?? [];
  }

  if (pageResult.status === "fulfilled" && pageResult.value) {
    pageContent = pageResult.value.content ?? null;
    pageTitle = pageResult.value.title ?? null;
  }

  if (categoriesResult.status === "fulfilled") {
    tileCategories = categoriesResult.value ?? [];
  }

  return (
    <MaterialPageClient
      initialRates={rates}
      materialType="Tile"
      pageTitle="Today Tile Rate in Pakistan"
      pageContent={pageContent}
      cmsPageTitle={pageTitle}
      tileCategories={tileCategories}
    />
  );
}
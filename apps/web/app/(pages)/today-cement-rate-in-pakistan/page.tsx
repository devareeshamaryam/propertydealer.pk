 import { Metadata } from "next";
import { slimRates } from "@/lib/shop";
import { serverApi } from "@/lib/server-api";
import CementPageClient from "./CementPageClient";

const SITE = (process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealer.pk').replace(/\/$/, '');

export const revalidate = 60; // Revalidate every 60 seconds

export async function generateMetadata(): Promise<Metadata> {
  try {
    const page = await serverApi.getPageBySlug("today-cement-rate-in-pakistan");
    return {
      title: page?.metaTitle || "Today Cement Rate in Pakistan 2026 | PropertyDealer.pk",
      description: page?.metaDescription || "Check today's latest cement rate in Pakistan. Updated daily prices of Lucky, Bestway, Maple Leaf, DG Khan and all major cement brands per 50 Kg bag.",
      keywords: page?.keywords || ["cement rate in Pakistan", "today cement price", "lucky cement rate", "bestway cement price", "maple leaf cement rate"],
      alternates: {
        canonical: "/today-cement-rate-in-pakistan",
      },
      openGraph: {
        title: page?.metaTitle || "Today Cement Rate in Pakistan 2026 | PropertyDealer.pk",
        description: page?.metaDescription || "Check today's latest cement rate in Pakistan. Updated daily prices.",
        type: "article",
      },
    };
  } catch {
    // Fallback agar API fail ho
    return {
      title: "Today Cement Rate in Pakistan 2026 | PropertyDealer.pk",
      description: "Check today's latest cement rate in Pakistan. Updated daily prices of Lucky, Bestway, Maple Leaf, DG Khan and all major cement brands per 50 Kg bag.",
      keywords: ["cement rate in Pakistan", "today cement price", "lucky cement rate", "bestway cement price", "maple leaf cement rate"],
      alternates: {
        canonical: "/today-cement-rate-in-pakistan",
      },
      openGraph: {
        title: "Today Cement Rate in Pakistan 2026 | PropertyDealer.pk",
        description: "Check today's latest cement rate in Pakistan. Updated daily prices.",
        type: "article",
      },
    };
  }
}

export default async function TodayCementRatePage() {
  let liveBrands: any[] = [];
  let pageContent: string | null = null;
  let pageTitle: string | null = null;

  // Fetch live rates + CMS description in parallel
  const [ratesResult, pageResult] = await Promise.allSettled([
    serverApi.getCementRates(),
    serverApi.getPageBySlug("today-cement-rate-in-pakistan"),
  ]);

  if (ratesResult.status === "fulfilled") {
    liveBrands = ratesResult.value ?? [];
  }

  if (pageResult.status === "fulfilled" && pageResult.value) {
    pageContent = pageResult.value.content ?? null;
    pageTitle = pageResult.value.title ?? null;
  }

  return (
    <CementPageClient
        initialBrands={slimRates(liveBrands)}
        pageContent={pageContent}
        pageTitle={pageTitle}
      />
  );
}
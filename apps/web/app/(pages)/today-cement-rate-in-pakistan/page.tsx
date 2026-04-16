import { Metadata } from "next";
import { serverApi } from "@/lib/server-api";
import CementPageClient from "./CementPageClient";

export const metadata: Metadata = {
  title: "Today Cement Rate in Pakistan 2026 | PropertyDealer.pk",
  description:
    "Check today's latest cement rate in Pakistan. Updated daily prices of Lucky, Bestway, Maple Leaf, DG Khan and all major cement brands per 50 Kg bag.",
  keywords: [
    "cement rate in Pakistan",
    "today cement price",
    "lucky cement rate",
    "bestway cement price",
    "maple leaf cement rate",
  ],
  alternates: {
    canonical: "/today-cement-rate-in-pakistan",
  },
  openGraph: {
    title: "Today Cement Rate in Pakistan 2026 | PropertyDealer.pk",
    description: "Check today's latest cement rate in Pakistan. Updated daily prices.",
    type: "article",
  },
};

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
      initialBrands={liveBrands}
      pageContent={pageContent}
      pageTitle={pageTitle}
    />
  );
}

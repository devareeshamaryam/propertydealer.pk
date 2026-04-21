import { Metadata } from "next";
import { serverApi } from "@/lib/server-api";
import MaterialPageClient from "./MaterialPageClient";

export const revalidate = 60; // Revalidate every 60 seconds

export const metadata: Metadata = {
  title: "Today Bajri Rate in Pakistan 2026 | PropertyDealer.pk",
  description:
    "Check today's latest bajri rates in Pakistan. Updated daily prices of all major bajri suppliers across Lahore, Karachi, Islamabad and more.",
  keywords: [
    "bajri rate in Pakistan",
    "today bajri price",
    "bajri rate today",
    "bajri price Pakistan",
    "crush rate in Pakistan",
  ],
  alternates: {
    canonical: "/today-bajri-rate-in-pakistan",
  },
  openGraph: {
    title: "Today Bajri Rate in Pakistan 2026 | PropertyDealer.pk",
    description: "Check today's latest bajri rates in Pakistan. Updated daily prices.",
    type: "article",
  },
};

export default async function BajriRatePage() {
  let rates: any[] = [];
  let pageContent: string | null = null;
  let pageTitle: string | null = null;

  const [ratesResult, pageResult] = await Promise.allSettled([
    serverApi.getMaterialRates("Bajri"),
    serverApi.getPageBySlug("today-bajri-rate-in-pakistan"),
  ]);

  if (ratesResult.status === "fulfilled") {
    rates = ratesResult.value ?? [];
  }

  if (pageResult.status === "fulfilled" && pageResult.value) {
    pageContent = pageResult.value.content ?? null;
    pageTitle = pageResult.value.title ?? null;
  }

  return (
    <MaterialPageClient
      initialRates={rates}
      materialType="Bajri"
      pageTitle="Today Bajri Rate in Pakistan"
      pageContent={pageContent}
      cmsPageTitle={pageTitle}
    />
  );
}

import { Metadata } from "next";
import { serverApi } from "@/lib/server-api";
import MaterialPageClient from "./MaterialPageClient";

export const revalidate = 60; // Revalidate every 60 seconds

export const metadata: Metadata = {
  title: "Today Wood Rate in Pakistan 2026 | PropertyDealer.pk",
  description:
    "Check today's latest wood rates in Pakistan. Updated daily prices of all major wood brands and suppliers across Lahore, Karachi, Islamabad and more.",
  keywords: [
    "wood rate in Pakistan",
    "today wood price",
    "timber rate today",
    "wood price Pakistan",
  ],
  alternates: {
    canonical: "/today-wood-rate-in-pakistan",
  },
  openGraph: {
    title: "Today Wood Rate in Pakistan 2026 | PropertyDealer.pk",
    description: "Check today's latest wood rates in Pakistan. Updated daily prices.",
    type: "article",
  },
};

export default async function WoodRatePage() {
  let rates: any[] = [];
  let pageContent: string | null = null;
  let pageTitle: string | null = null;

  const [ratesResult, pageResult] = await Promise.allSettled([
    serverApi.getMaterialRates("Wood"),
    serverApi.getPageBySlug("today-wood-rate-in-pakistan"),
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
      materialType="Wood"
      pageTitle="Today Wood Rate in Pakistan"
      pageContent={pageContent}
      cmsPageTitle={pageTitle}
    />
  );
}

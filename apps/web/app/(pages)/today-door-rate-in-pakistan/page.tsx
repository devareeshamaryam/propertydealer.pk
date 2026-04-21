import { Metadata } from "next";
import { serverApi } from "@/lib/server-api";
import MaterialPageClient from "./MaterialPageClient";

export const revalidate = 60; // Revalidate every 60 seconds

export const metadata: Metadata = {
  title: "Today Door Rate in Pakistan 2026 | PropertyDealer.pk",
  description:
    "Check today's latest door rates in Pakistan. Updated daily prices of all major door brands and suppliers across Lahore, Karachi, Islamabad and more.",
  keywords: [
    "door rate in Pakistan",
    "today door price",
    "door rate today",
    "door price Pakistan",
  ],
  alternates: {
    canonical: "/today-door-rate-in-pakistan",
  },
  openGraph: {
    title: "Today Door Rate in Pakistan 2026 | PropertyDealer.pk",
    description: "Check today's latest door rates in Pakistan. Updated daily prices.",
    type: "article",
  },
};

export default async function DoorRatePage() {
  let rates: any[] = [];
  let pageContent: string | null = null;
  let pageTitle: string | null = null;

  // Fetch live rates + CMS description in parallel
  const [ratesResult, pageResult] = await Promise.allSettled([
    serverApi.getMaterialRates("Door"),
    serverApi.getPageBySlug("today-door-rate-in-pakistan"),
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
      materialType="Door"
      pageTitle="Today Door Rate in Pakistan"
      pageContent={pageContent}
      cmsPageTitle={pageTitle}
    />
  );
}

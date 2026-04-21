import { Metadata } from "next";
import { serverApi } from "@/lib/server-api";
import MaterialPageClient from "./MaterialPageClient";

export const revalidate = 60; // Revalidate every 60 seconds

export const metadata: Metadata = {
  title: "Today Bricks Rate in Pakistan 2026 | PropertyDealer.pk",
  description:
    "Check today's latest bricks rates in Pakistan. Updated daily prices of all major brick brands and suppliers across Lahore, Karachi, Islamabad and more.",
  keywords: [
    "bricks rate in Pakistan",
    "today bricks price",
    "brick rate today",
    "bricks price Pakistan",
    "eent rate in Pakistan",
  ],
  alternates: {
    canonical: "/today-bricks-rate-in-pakistan",
  },
  openGraph: {
    title: "Today Bricks Rate in Pakistan 2026 | PropertyDealer.pk",
    description: "Check today's latest bricks rates in Pakistan. Updated daily prices.",
    type: "article",
  },
};

export default async function BricksRatePage() {
  let rates: any[] = [];
  let pageContent: string | null = null;
  let pageTitle: string | null = null;

  const [ratesResult, pageResult] = await Promise.allSettled([
    serverApi.getMaterialRates("Bricks"),
    serverApi.getPageBySlug("today-bricks-rate-in-pakistan"),
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
      materialType="Bricks"
      pageTitle="Today Bricks Rate in Pakistan"
      pageContent={pageContent}
      cmsPageTitle={pageTitle}
    />
  );
}

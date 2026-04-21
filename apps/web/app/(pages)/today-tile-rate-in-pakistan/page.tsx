import { Metadata } from "next";
import { serverApi } from "@/lib/server-api";
import MaterialPageClient from "./MaterialPageClient";

export const revalidate = 60; // Revalidate every 60 seconds

export const metadata: Metadata = {
  title: "Today Tile Rate in Pakistan 2026 | PropertyDealer.pk",
  description:
    "Check today's latest tile rates in Pakistan. Updated daily prices of all major tile brands and suppliers across Lahore, Karachi, Islamabad and more.",
  keywords: [
    "tile rate in Pakistan",
    "today tile price",
    "tile rate today",
    "tile price Pakistan",
  ],
  alternates: {
    canonical: "/today-tile-rate-in-pakistan",
  },
  openGraph: {
    title: "Today Tile Rate in Pakistan 2026 | PropertyDealer.pk",
    description: "Check today's latest tile rates in Pakistan. Updated daily prices.",
    type: "article",
  },
};

export default async function TileRatePage() {
  let rates: any[] = [];
  let pageContent: string | null = null;
  let pageTitle: string | null = null;

  const [ratesResult, pageResult] = await Promise.allSettled([
    serverApi.getMaterialRates("Tile"),
    serverApi.getPageBySlug("today-tile-rate-in-pakistan"),
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
      materialType="Tile"
      pageTitle="Today Tile Rate in Pakistan"
      pageContent={pageContent}
      cmsPageTitle={pageTitle}
    />
  );
}

 import { Metadata } from "next";
import { serverApi } from "@/lib/server-api";
import MaterialPageClient from "./MaterialPageClient";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  try {
    const page = await serverApi.getPageBySlug("today-steel-rate-in-pakistan");
    return {
      title: page?.metaTitle || "Today Steel Rate in Pakistan 2026 | PropertyDealer.pk",
      description: page?.metaDescription || "Check today's latest steel rates in Pakistan. Updated daily prices from top brands and suppliers.",
    };
  } catch {
    return {
      title: "Today Steel Rate in Pakistan 2026 | PropertyDealer.pk",
      description: "Check today's latest steel rates in Pakistan. Updated daily prices from top brands and suppliers.",
    };
  }
}

async function getSteelRates() {
  try {
    const apiUrl = process.env.INTERNAL_API_URL || "http://localhost:3010";
    const res = await fetch(`${apiUrl}/api/steel-rate`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    return res.json();
  } catch (error) {
    console.error("Error fetching steel rates:", error);
    return [];
  }
}

export default async function SteelRatePage() {
  let rates: any[] = [];
  let pageContent: string | null = null;
  let pageTitle: string | null = null;

  const [ratesResult, pageResult] = await Promise.allSettled([
    getSteelRates(),
    serverApi.getPageBySlug("today-steel-rate-in-pakistan"),
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
      materialType="Steel"
      pageTitle="Today Steel Rate in Pakistan"
      pageContent={pageContent}
      cmsPageTitle={pageTitle}
    />
  );
}
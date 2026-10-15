 import { Metadata } from "next";
import { slimRates } from "@/lib/shop";
import { serverApi } from "@/lib/server-api";
import MaterialPageClient from "./MaterialPageClient";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  try {
    const page = await serverApi.getPageBySlug("today-sand-rate-in-pakistan");
    return {
      title: page?.metaTitle || "Today Sand Rate in Pakistan 2026 | PropertyDealer.pk",
      description: page?.metaDescription || "Check today's latest sand rates in Pakistan. Updated daily prices from top brands and suppliers.",
    };
  } catch {
    return {
      title: "Today Sand Rate in Pakistan 2026 | PropertyDealer.pk",
      description: "Check today's latest sand rates in Pakistan. Updated daily prices from top brands and suppliers.",
    };
  }
}

async function getSandRates() {
  try {
    const apiUrl = process.env.INTERNAL_API_URL || "http://localhost:3010";
    const res = await fetch(`${apiUrl}/api/sand-rate`, {
      // Matches `export const revalidate` at the top of this file. It used to

      // be `cache: "no-store"`, which contradicted it: the page asked to be

      // static-with-ISR and the fetch forbade caching, so every build threw

      // DYNAMIC_SERVER_USAGE here and the page fell back to server-rendering on

      // every request. Rate edits call RevalidateService, so this stays fresh.

      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch (error) {
    console.error("Error fetching sand rates:", error);
    return [];
  }
}

export default async function SandRatePage() {
  let rates: any[] = [];
  let pageContent: string | null = null;
  let pageTitle: string | null = null;

  const [ratesResult, pageResult] = await Promise.allSettled([
    getSandRates(),
    serverApi.getPageBySlug("today-sand-rate-in-pakistan"),
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
      initialRates={slimRates(rates)}
      materialType="Sand"
      pageTitle="Today Sand Rate in Pakistan"
      pageContent={pageContent}
      cmsPageTitle={pageTitle}
    />
  );
}
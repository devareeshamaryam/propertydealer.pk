 import { Metadata } from "next";
import { slimRates } from "@/lib/shop";
import { serverApi } from "@/lib/server-api";
import MaterialPageClient from "./MaterialPageClient";

const SITE = (process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealer.pk').replace(/\/$/, '');

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  try {
    const page = await serverApi.getPageBySlug("today-bricks-rate-in-pakistan");
    return {
      alternates: { canonical: `${SITE}/today-bricks-rate-in-pakistan` },
      title: page?.metaTitle || "Today Bricks Rate in Pakistan 2026 | PropertyDealer.pk",
      description: page?.metaDescription || "Check today's latest bricks rates in Pakistan. Updated daily prices from top brands and suppliers.",
    };
  } catch {
    return {
      alternates: { canonical: `${SITE}/today-bricks-rate-in-pakistan` },
      title: "Today Bricks Rate in Pakistan 2026 | PropertyDealer.pk",
      description: "Check today's latest bricks rates in Pakistan. Updated daily prices from top brands and suppliers.",
    };
  }
}

async function getBricksRates() {
  try {
    const apiUrl = process.env.INTERNAL_API_URL || "http://localhost:3010";
    const res = await fetch(`${apiUrl}/api/bricks-rate`, {
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
    console.error("Error fetching bricks rates:", error);
    return [];
  }
}

export default async function BricksRatePage() {
  let rates: any[] = [];
  let pageContent: string | null = null;
  let pageTitle: string | null = null;

  const [ratesResult, pageResult] = await Promise.allSettled([
    getBricksRates(),
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
      initialRates={slimRates(rates)}
      materialType="Bricks"
      pageTitle="Today Bricks Rate in Pakistan"
      pageContent={pageContent}
      cmsPageTitle={pageTitle}
    />
  );
}
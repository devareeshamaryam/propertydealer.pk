import { Metadata } from "next";
import { serverApi } from "@/lib/server-api";
import MaterialPageClient from "./MaterialPageClient";

export const revalidate = 60; // Revalidate every 60 seconds

export const metadata: Metadata = {
  title: "Today Steel Rate in Pakistan 2026 | PropertyDealer.pk",
  description:
    "Check today's latest steel rates in Pakistan. Updated daily prices of all major steel brands including Amreli, Mughal, Ittefaq and more across Lahore, Karachi, Islamabad.",
  keywords: [
    "steel rate in Pakistan",
    "today steel price",
    "saria rate today",
    "steel price Pakistan",
    "iron rate in Pakistan",
  ],
  alternates: {
    canonical: "/today-steel-rate-in-pakistan",
  },
  openGraph: {
    title: "Today Steel Rate in Pakistan 2026 | PropertyDealer.pk",
    description: "Check today's latest steel rates in Pakistan. Updated daily prices.",
    type: "article",
  },
};

export default async function SteelRatePage() {
  let rates: any[] = [];
  let pageContent: string | null = null;
  let pageTitle: string | null = null;

  const [ratesResult, pageResult] = await Promise.allSettled([
    serverApi.getMaterialRates("Steel"),
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

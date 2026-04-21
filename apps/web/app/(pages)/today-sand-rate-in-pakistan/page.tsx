import { Metadata } from "next";
import { serverApi } from "@/lib/server-api";
import MaterialPageClient from "./MaterialPageClient";

export const revalidate = 60; // Revalidate every 60 seconds

export const metadata: Metadata = {
  title: "Today Sand Rate in Pakistan 2026 | PropertyDealer.pk",
  description:
    "Check today's latest sand rates in Pakistan. Updated daily prices of all major sand suppliers across Lahore, Karachi, Islamabad and more.",
  keywords: [
    "sand rate in Pakistan",
    "today sand price",
    "sand rate today",
    "sand price Pakistan",
  ],
  alternates: {
    canonical: "/today-sand-rate-in-pakistan",
  },
  openGraph: {
    title: "Today Sand Rate in Pakistan 2026 | PropertyDealer.pk",
    description: "Check today's latest sand rates in Pakistan. Updated daily prices.",
    type: "article",
  },
};

export default async function SandRatePage() {
  let rates: any[] = [];
  let pageContent: string | null = null;
  let pageTitle: string | null = null;

  const [ratesResult, pageResult] = await Promise.allSettled([
    serverApi.getMaterialRates("Sand"),
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
      initialRates={rates}
      materialType="Sand"
      pageTitle="Today Sand Rate in Pakistan"
      pageContent={pageContent}
      cmsPageTitle={pageTitle}
    />
  );
}

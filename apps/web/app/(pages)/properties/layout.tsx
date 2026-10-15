import type { Metadata } from "next";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import PropertiesFilterBar from "@/components/PropertiesFilterBar";
import { Suspense } from "react";
import { pageMetadata } from "@/lib/seo/page-seo";
import { CityStoriesBar } from "@/components/CityStories";
import { getCityStories } from "@/lib/server-api";

/*
 * The search page's own metadata — and the fallback for everything under it.
 *
 * /properties is a client component, so this layout is the only place it can
 * declare any, and without it the busiest landing page on the site was going
 * out with the home page's title and description. Two near-identical pages
 * competing for the same queries is the worst case: the one that wins is
 * whichever Google picks, and the other is written off as a duplicate.
 *
 * Children (/properties/[slug], /properties/sale/..., /properties/rent/...)
 * all generate their own, which takes precedence over this.
 *
 * Editable from Static Pages under the slug "properties".
 */
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("properties", {
    title: "Property for Sale & Rent in Pakistan — Houses, Plots, Flats",
    description:
      "Browse houses, plots, flats, shops and commercial property for sale and rent across Pakistan. Filter by city, area, marla and price, and contact the dealer directly.",
    path: "/properties",
    keywords: [
      "property for sale in pakistan",
      "houses for rent pakistan",
      "plots for sale",
      "flats for rent",
      "commercial property pakistan",
    ],
  });
}

export default async function PropertiesLayout({ children }: { children: React.ReactNode }) {
    // Every city, most listings first, as round shortcuts above the results.
    const cities = await getCityStories();
    return (
        <>
            <CityStoriesBar cities={cities} />
            <Suspense fallback={<div className="hidden h-14 border-b border-slate-200 bg-white md:block" />}>
                <PropertiesFilterBar />
            </Suspense>
            {children}
        </>
    )
}

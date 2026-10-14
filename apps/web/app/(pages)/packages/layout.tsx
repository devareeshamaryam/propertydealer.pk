import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/page-seo";

/* Editable from Static Pages under the slug "packages". */
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("packages", {
    title: "Agent Packages & Pricing — List Your Properties in Pakistan",
    description:
      "Plans for property dealers in Pakistan, from Rs 1,000 a month. More live listings, featured placement, photos and video on every listing, and your own agent profile page.",
    path: "/packages",
    keywords: [
      "property agent packages pakistan",
      "real estate listing plans",
      "property portal pricing pakistan",
    ],
  });
}

export default function PackagesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

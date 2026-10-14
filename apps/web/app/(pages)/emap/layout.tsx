import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/page-seo";

/* Editable from Static Pages under the slug "emap". */
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("emap", {
    title: "Property Map of Pakistan — Browse Listings by Location",
    description:
      "Find property on the map: houses, plots, flats and commercial units across Pakistani cities and societies, with each listing pinned where it actually is.",
    path: "/emap",
    keywords: ["property map pakistan", "plots on map", "society map pakistan"],
  });
}

export default function EmapLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/page-seo";
import { EMAP_INDEX_META } from "@/lib/seo/emap-meta";

/* Editable from Static Pages under the slug "emap". */
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("emap", {
    title: EMAP_INDEX_META.title,
    description: EMAP_INDEX_META.description,
    path: "/emap",
    keywords: ["e map", "emap pakistan", "society maps", "housing society map", "master plan", "plot map", "lahore society map", "islamabad society map", "karachi society map"],
  });
}

export default function EmapLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

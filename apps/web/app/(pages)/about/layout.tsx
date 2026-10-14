import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/page-seo";

/*
 * The page itself is a client component, so its metadata lives here — that is
 * the only place Next lets a "use client" route declare any. Without it the
 * route inherited the root layout's, which is the home page's title and
 * description word for word.
 *
 * Editable from Static Pages: create a page with the slug "about" and its
 * Meta Title / Meta Description win over the fallback below.
 */
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("about", {
    title: "About PropertyDealer — Pakistan's Property & Construction Portal",
    description:
      "Who we are: a Pakistani property portal where buyers, sellers and dealers meet, and where today's cement, steel, brick and sand rates are published every day.",
    path: "/about",
    keywords: ["about propertydealer", "pakistan property portal", "real estate pakistan"],
  });
}

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

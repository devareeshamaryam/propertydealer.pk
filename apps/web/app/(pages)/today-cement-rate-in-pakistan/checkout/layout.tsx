import type { Metadata } from "next";
import { getSiteName } from "@/lib/site-settings.server";

// An order form. Nothing to index, and it was carrying the home page's
// description into search results.
export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteName();
  return {
  title: `Checkout — ${site}`,
  description: "Complete your construction materials order and arrange delivery.",
  robots: { index: false, follow: true },
};
}

export default function CementCheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

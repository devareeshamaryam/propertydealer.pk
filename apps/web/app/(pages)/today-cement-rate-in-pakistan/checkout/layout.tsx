import type { Metadata } from "next";

// An order form. Nothing to index, and it was carrying the home page's
// description into search results.
export const metadata: Metadata = {
  title: "Checkout — PropertyDealer",
  description: "Complete your construction materials order and arrange delivery.",
  robots: { index: false, follow: true },
};

export default function CementCheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

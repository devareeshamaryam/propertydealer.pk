import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create an account — PropertyDealer",
  description:
    "Create a free PropertyDealer account and list your property for buyers across Pakistan.",
  robots: { index: false, follow: true },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

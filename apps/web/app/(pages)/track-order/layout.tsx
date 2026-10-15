import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Track your order — PropertyDealer",
  description: "Check the status of your construction materials order with your order number and phone.",
  robots: { index: false, follow: true },
};

export default function TrackOrderLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

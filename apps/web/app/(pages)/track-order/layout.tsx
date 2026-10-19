import type { Metadata } from "next";
import { getSiteName } from "@/lib/site-settings.server";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteName();
  return {
  title: `Track your order — ${site}`,
  description: "Check the status of your construction materials order with your order number and phone.",
  robots: { index: false, follow: true },
};
}

export default function TrackOrderLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

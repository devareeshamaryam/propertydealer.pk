import type { Metadata } from "next";
import { getSiteName } from "@/lib/site-settings.server";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteName();
  return {
  title: `Account pending activation — ${site}`,
  robots: { index: false, follow: false },
};
}

export default function PendingActivationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

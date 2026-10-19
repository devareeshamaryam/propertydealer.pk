import type { Metadata } from "next";
import { getSiteName } from "@/lib/site-settings.server";

// A redirect landing strip. It exists for a second and must never be indexed.
export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteName();
  return {
  title: `Signing you in — ${site}`,
  robots: { index: false, follow: false },
};
}

export default function SigningInLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

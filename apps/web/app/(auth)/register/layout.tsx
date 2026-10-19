import type { Metadata } from "next";
import { getSiteName } from "@/lib/site-settings.server";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteName();
  return {
  title: `Create an account — ${site}`,
  description:
    `Create a free ${site} account and list your property for buyers across Pakistan.`,
  robots: { index: false, follow: true },
};
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

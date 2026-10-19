import type { Metadata } from "next";
import { getSiteName } from "@/lib/site-settings.server";

/*
 * noindex, and a title of its own.
 *
 * Sign-in pages have no business in search results — there is nothing to find
 * on them — and this one was inheriting the home page's title and description,
 * so Google saw a second copy of the home page. `follow` stays on, so the
 * links in the header and footer still carry weight.
 */
export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteName();
  return {
  title: `Sign in — ${site}`,
  description: `Sign in to manage your property listings on ${site}.`,
  robots: { index: false, follow: true },
};
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

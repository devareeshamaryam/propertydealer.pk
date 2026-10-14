import type { Metadata } from "next";

// A redirect landing strip. It exists for a second and must never be indexed.
export const metadata: Metadata = {
  title: "Signing you in — PropertyDealer",
  robots: { index: false, follow: false },
};

export default function SigningInLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

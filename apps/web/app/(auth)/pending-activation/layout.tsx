import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Account pending activation — PropertyDealer",
  robots: { index: false, follow: false },
};

export default function PendingActivationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

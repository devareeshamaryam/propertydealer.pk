 import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Providers } from "./providers";
import { AuthProvider } from "@/context/auth-context";
import StructuredData from "@/components/StructuredData";

// ✅ Sirf Geist Sans — Mono hata diya (FCP improve)
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  // ✅ Sirf zaruri weights load karo
  weight: ["400", "500", "600", "700"],
  display: "swap", // ✅ Font load hone tak system font dikhao
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://propertydealer.pk'),
  title: {
    default: "Property Dealer | Buy, Sell & Rent Property",
    template: "%s "
  },
  description: "Property Dealer is a property buying and selling marketplace across Pakistan, connecting buyers and sellers for residential and commercial real estate.",
  keywords: ["property portal pakistan", "Property Dealer", "houses for rent multan", "apartments for sale lahore", "plots karachi", "commercial property islamabad"],
  authors: [{ name: "PropertyDealer Team" }],
  creator: "PropertyDealer",
  publisher: "PropertyDealer",
  formatDetection: {
    email: false,
    address: true,
    telephone: true,
  },
  openGraph: {
    type: 'website',
    locale: 'en_PK',
    url: process.env.NEXT_PUBLIC_SITE_URL || 'https://propertydealer.pk',
    siteName: 'Property Dealer',
    title: 'Property Dealer | Buy, Sell & Rent Property',
    description: "Property Dealer is a property buying and selling marketplace across Pakistan, connecting buyers and sellers for residential and commercial real estate.",
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'PropertyDealer Property Portal',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PropertyDealer - Property Portal Pakistan',
    description: 'Find properties for rent and sale in Pakistan.',
    images: ['/og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} antialiased`}>
        <Providers>
          <AuthProvider>
            <TooltipProvider>
              <StructuredData />
              {children}
              <Sonner />
            </TooltipProvider>
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}
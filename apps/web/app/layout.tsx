 import type { Metadata } from "next";
import { Geist, Inter, Open_Sans, Poppins, Roboto } from "next/font/google";
import "./globals.css";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Providers } from "./providers";
import { AuthProvider } from "@/context/auth-context";
import StructuredData from "@/components/StructuredData";
import ChunkReloadGuard from "@/components/ChunkReloadGuard";
import { SiteSettingsProvider } from "@/components/SiteSettingsProvider";
import { getSiteSettings } from "@/lib/site-settings.server";
import { themeStyle } from "@/lib/site-settings";

// ✅ Sirf Geist Sans — Mono hata diya (FCP improve)
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  // ✅ Sirf zaruri weights load karo
  weight: ["400", "500", "600", "700"],
  display: "swap", // ✅ Font load hone tak system font dikhao
});

/*
 * The other fonts the admin can pick in Settings → Appearance. Declaring them
 * costs nothing until one is chosen: preload is off, and a browser only
 * downloads a font file when some text is actually set in it.
 */
// next/font needs literal options here, so each one is spelled out.
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap", preload: false, variable: "--font-inter" });
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap", preload: false, variable: "--font-poppins" });
const roboto = Roboto({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap", preload: false, variable: "--font-roboto" });
const openSans = Open_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap", preload: false, variable: "--font-open-sans" });

const metadataBase: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://propertydealer.pk'),
  title: {
    default: "Property Dealer | Buy, Sell & Rent Property",
    // "%s " put a trailing space inside every page's <title>. Left as a bare
    // "%s" rather than appending a brand suffix: these pages are ranked, and
    // rewriting every title tag on the site is not a tidy-up.
    template: "%s"
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

// The admin's favicon, when one is set.
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  return settings.faviconUrl
    ? { ...metadataBase, icons: { icon: settings.faviconUrl, apple: settings.faviconUrl } }
    : metadataBase;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getSiteSettings();
  const fontVariables = [geistSans, inter, poppins, roboto, openSans].map((f) => f.variable).join(" ");

  return (
    // Colours, radius and font from Settings → Appearance, as CSS variables:
    // every component reads them through the Tailwind tokens.
    <html lang="en" className={fontVariables} style={themeStyle(settings)}>
      <body className="antialiased">
        {/* First, and outside the providers: a stale document that cannot load
            its chunks must still be able to rescue itself. */}
        <ChunkReloadGuard />
        <Providers>
          <AuthProvider>
            <TooltipProvider>
              <StructuredData />
              <SiteSettingsProvider value={settings}>{children}</SiteSettingsProvider>
              <Sonner />
            </TooltipProvider>
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}
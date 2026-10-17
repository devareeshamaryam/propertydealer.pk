 import type { Metadata, Viewport } from "next";
import { Geist, Inter, Open_Sans, Poppins, Roboto } from "next/font/google";
import "./globals.css";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Providers } from "./providers";
import { AuthProvider } from "@/context/auth-context";
import StructuredData from "@/components/StructuredData";
import ChunkReloadGuard from "@/components/ChunkReloadGuard";
import ScrollRestorer from "@/components/ScrollRestorer";
import { SiteSettingsProvider } from "@/components/SiteSettingsProvider";
import { getSiteSettings } from "@/lib/site-settings.server";
import { isHex, themeStyle } from "@/lib/site-settings";

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

/*
 * The defaults above, with whatever the admin has set in Settings → General
 * (default title and description, share image, Search Console verification)
 * and Settings → Appearance (favicon). Empty settings leave the built-in
 * values alone — these pages are ranked, so nothing changes unless someone
 * changes it on purpose.
 */
export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();
  const meta: Metadata = { ...metadataBase };
  if (s.seoTitle) {
    meta.title = { default: s.seoTitle, template: "%s" };
    meta.openGraph = { ...meta.openGraph, title: s.seoTitle };
  }
  if (s.seoDescription) {
    meta.description = s.seoDescription;
    meta.openGraph = { ...meta.openGraph, description: s.seoDescription };
  }
  if (s.ogImageUrl) {
    meta.openGraph = { ...meta.openGraph, images: [{ url: s.ogImageUrl, width: 1200, height: 630 }] };
    meta.twitter = { ...meta.twitter, images: [s.ogImageUrl] };
  }
  if (s.siteName) meta.openGraph = { ...meta.openGraph, siteName: s.siteName };
  if (s.googleVerification) meta.verification = { google: s.googleVerification };
  if (s.faviconUrl) meta.icons = { icon: s.faviconUrl, apple: s.faviconUrl };
  return meta;
}

/*
 * The address-bar colour phone browsers (Chrome on Android, Safari on iPhone)
 * paint around the page — Settings → Appearance. White matches the header.
 */
export async function generateViewport(): Promise<Viewport> {
  const s = await getSiteSettings();
  return { themeColor: isHex(s.browserBarColor) ? s.browserBarColor : "#ffffff" };
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
        <ScrollRestorer />
        <Providers>
          <AuthProvider>
            <TooltipProvider>
              <SiteSettingsProvider value={settings}>
                <StructuredData />
                {children}
              </SiteSettingsProvider>
              <Sonner />
            </TooltipProvider>
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}
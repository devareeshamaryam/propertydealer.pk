 // app/sitemap.ts
// ─── MASTER SITEMAP INDEX ───────────────────────────────────────────────────
// Ye Google ko batata hai k tamam sitemaps kahan hain.
// Jab naya city add ho, sitemap-cities.xml automatically update ho jata hai.

import { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealers.pk';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    // Static + city level pages
    { url: `${BASE_URL}/sitemap-pages.xml`,      lastModified: new Date() },
    // Individual property listings
    { url: `${BASE_URL}/sitemap-properties.xml`, lastModified: new Date() },
    // Blog posts + categories
    { url: `${BASE_URL}/sitemap-blogs.xml`,      lastModified: new Date() },
    // Cities + areas (combined)
    { url: `${BASE_URL}/sitemap-areas.xml`,      lastModified: new Date() },
    // Cement, steel, bajri etc rates
    { url: `${BASE_URL}/sitemap-rates.xml`,      lastModified: new Date() },
    // ✅ City sitemaps index — har city ka alag sitemap
    { url: `${BASE_URL}/sitemap-cities.xml`,     lastModified: new Date() },
  ];
}
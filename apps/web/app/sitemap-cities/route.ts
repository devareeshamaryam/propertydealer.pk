// app/sitemap-cities.xml/route.ts
// ─── CITIES SITEMAP INDEX ──────────────────────────────────────────────────
// Ye file Google ko batati hai k har city ka alag sitemap kahan hai.
// Jab naya city DB mein add ho, automatically yahan aa jata hai.
//
// Output example:
// <sitemapindex>
//   <sitemap><loc>.../sitemap-city-lahore.xml</loc></sitemap>
//   <sitemap><loc>.../sitemap-city-karachi.xml</loc></sitemap>
//   ...
// </sitemapindex>

import { NextResponse } from 'next/server';
import { serverApi } from '@/lib/server-api';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealers.pk';

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0]!;

    // DB se tamam cities fetch karo
    let cities: any[] = [];
    try {
      cities = await serverApi.getCities();
    } catch (err) {
      console.error('[sitemap-cities] Cities fetch failed:', err);
    }

    // Har city ke liye ek sitemap entry
    const sitemapEntries = cities
      .map((city) => {
        const slug = city.slug
          || city.areaSlug
          || city.name?.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
        if (!slug) return null;

        const lastmod = city.updatedAt
          ? new Date(city.updatedAt).toISOString().split('T')[0]!
          : today;

        return `
  <sitemap>
    <loc>${BASE_URL}/sitemap-city-${slug}.xml</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>`;
      })
      .filter(Boolean)
      .join('');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries}
</sitemapindex>`;

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=7200',
      },
    });
  } catch (err) {
    console.error('[sitemap-cities] Fatal error:', err);
    return new NextResponse('Error generating sitemap', { status: 500 });
  }
}
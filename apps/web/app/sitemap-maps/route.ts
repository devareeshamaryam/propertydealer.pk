// app/sitemap-maps.xml/route.ts
// ─── SOCIETY MAPS SITEMAP ─────────────────────────────────────────────────
// Every published society map (/emap/<city>/<society>) and the city map
// pages that list them. Revalidated with the "society-maps" tag on publish.

import { NextResponse } from 'next/server';
import { getSocietyMaps } from '@/lib/society-map';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealer.pk';

export async function GET() {
  const maps = await getSocietyMaps();
  const today = new Date().toISOString().split('T')[0]!;
  const urls = new Map<string, { lastmod: string; priority: string }>();
  urls.set(`${BASE_URL}/emap`, { lastmod: today, priority: '0.8' });
  for (const m of maps) {
    const lastmod = m.updatedAt ? new Date(m.updatedAt).toISOString().split('T')[0]! : today;
    urls.set(`${BASE_URL}/emap/${m.citySlug}`, { lastmod: today, priority: '0.7' });
    urls.set(`${BASE_URL}/emap/${m.citySlug}/${m.slug}`, { lastmod, priority: '0.8' });
  }
  const body = [...urls.entries()]
    .map(([loc, { lastmod, priority }]) => `
  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`)
    .join('');
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}\n</urlset>`,
    { headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=3600, s-maxage=3600' } },
  );
}

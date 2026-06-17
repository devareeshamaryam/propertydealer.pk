// app/sitemap-rates.xml/route.ts
// ─── RATES SITEMAP ─────────────────────────────────────────────────────────
// Ye sitemap cover karta hai:
// - Tamam "today rate" pages (cement, steel, bajri, bricks, etc.)
// - Individual product detail pages:
//   /today-cement-rate-in-pakistan/lucky-cement
//   /today-steel-rate-in-pakistan/amreli-steel
//   etc.
//
// Ye pages daily update hote hain isliye changefreq: 'daily'

import { NextResponse } from 'next/server';
import { serverApi } from '@/lib/server-api';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealers.pk';

// Rate category pages + unka API method mapping
const RATE_CATEGORIES = [
  { pageSlug: 'today-cement-rate-in-pakistan', fetchFn: 'getCementRates', priority: '0.8' },
  { pageSlug: 'today-steel-rate-in-pakistan',  fetchFn: 'getSteelRates',  priority: '0.8' },
  { pageSlug: 'today-bajri-rate-in-pakistan',  fetchFn: 'getBajriRates',  priority: '0.7' },
  { pageSlug: 'today-bricks-rate-in-pakistan', fetchFn: 'getBricksRates', priority: '0.7' },
  { pageSlug: 'today-sand-rate-in-pakistan',   fetchFn: 'getSandRates',   priority: '0.7' },
  { pageSlug: 'today-door-rate-in-pakistan',   fetchFn: 'getDoorRates',   priority: '0.7' },
  { pageSlug: 'today-tile-rate-in-pakistan',   fetchFn: 'getTileRates',   priority: '0.7' },
  { pageSlug: 'today-wood-rate-in-pakistan',   fetchFn: 'getWoodRates',   priority: '0.7' },
];

function generateXml(urls: Array<{ loc: string; lastmod: string; changefreq: string; priority: string }>) {
  const urlSet = urls.map(({ loc, lastmod, changefreq, priority }) => `
  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlSet}
</urlset>`;
}

export async function GET() {
  try {
    const urls: Array<{ loc: string; lastmod: string; changefreq: string; priority: string }> = [];
    const today = new Date().toISOString().split('T')[0]!;

    for (const category of RATE_CATEGORIES) {
      // Category index page
      urls.push({
        loc:        `${BASE_URL}/${category.pageSlug}`,
        lastmod:    today,
        changefreq: 'daily',
        priority:   category.priority,
      });

      // Individual product pages — DB se fetch
      try {
        const fetchMethod = (serverApi as any)[category.fetchFn];
        if (typeof fetchMethod !== 'function') {
          console.warn(`[sitemap-rates] serverApi.${category.fetchFn} not found, skipping`);
          continue;
        }

        const rates: any[] = await fetchMethod.call(serverApi);
        const ratesList: any[] = Array.isArray(rates)
          ? rates
          : (rates as any).data || [];

        for (const rate of ratesList) {
          const slug = rate.slug
            || rate.brand?.toLowerCase().replace(/\s+/g, '-')
            || rate._id;

          if (!slug) continue;
          if (rate.isActive === false) continue;

          const lastmod = rate.updatedAt
            ? new Date(rate.updatedAt).toISOString().split('T')[0]!
            : today;

          urls.push({
            loc:        `${BASE_URL}/${category.pageSlug}/${slug}`,
            lastmod,
            changefreq: 'daily',
            priority:   '0.7',
          });
        }
      } catch (fetchErr) {
        console.error(`[sitemap-rates] ${category.fetchFn} failed:`, fetchErr);
      }
    }

    const xml = generateXml(urls);

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=7200',
      },
    });
  } catch (err) {
    console.error('[sitemap-rates] Fatal error:', err);
    return new NextResponse('Error generating sitemap', { status: 500 });
  }
}
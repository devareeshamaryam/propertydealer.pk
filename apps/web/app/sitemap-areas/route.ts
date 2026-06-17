// app/sitemap-areas.xml/route.ts
// ─── AREAS / CITIES SITEMAP ────────────────────────────────────────────────
// Ye sitemap cover karta hai:
// - Tamam cities (/properties/sale/lahore, /properties/rent/lahore, etc.)
// - Tamam areas har city mein (/properties/sale/lahore/dha)
// - Combination pages (city + area + type)
//
// Ye aapki website ka sabse valuable SEO content hai —
// "property for sale in DHA Lahore" jaise long-tail keywords

import { NextResponse } from 'next/server';
import { serverApi } from '@/lib/server-api';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealers.pk';

const PROPERTY_TYPES = [
  'house', 'apartment', 'flat', 'plot',
  'shop', 'office', 'land', 'commercial'
];

const PURPOSES = ['sale', 'rent', 'all'] as const;

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
    const seen = new Set<string>(); // Duplicate URLs avoid karne ke liye
    const today = new Date().toISOString().split('T')[0]!;

    const addUrl = (loc: string, changefreq: string, priority: string, lastmod = today) => {
      if (seen.has(loc)) return;
      seen.add(loc);
      urls.push({ loc, lastmod, changefreq, priority });
    };

    // ── 1. Fetch all cities ─────────────────────────────────────────────────
    let cities: any[] = [];
    try {
      cities = await serverApi.getCities();
    } catch (err) {
      console.error('[sitemap-areas] Cities fetch failed:', err);
    }

    for (const city of cities) {
      const citySlug = city.slug || city.name?.toLowerCase().replace(/\s+/g, '-');
      if (!citySlug) continue;

      const cityLastmod = city.updatedAt
        ? new Date(city.updatedAt).toISOString().split('T')[0]!
        : today;

      // City-level pages — sale, rent, all
      for (const purpose of PURPOSES) {
        addUrl(
          `${BASE_URL}/properties/${purpose}/${citySlug}`,
          'daily',
          '0.85',
          cityLastmod
        );

        // City + property type combinations
        for (const type of PROPERTY_TYPES) {
          addUrl(
            `${BASE_URL}/properties/${purpose}/${citySlug}/${type}`,
            'weekly',
            '0.7'
          );
        }
      }

      // ── 2. Fetch areas for this city ──────────────────────────────────────
      try {
        const areasRes = await serverApi.getAreasByCity(city._id || citySlug);
        const areas: any[] = Array.isArray(areasRes)
          ? areasRes
          : (areasRes as any).areas || [];

        for (const area of areas) {
          const areaSlug = area.areaSlug || area.slug || area.name?.toLowerCase().replace(/\s+/g, '-');
          if (!areaSlug) continue;

          const areaLastmod = area.updatedAt
            ? new Date(area.updatedAt).toISOString().split('T')[0]!
            : today;

          // Area-level pages
          for (const purpose of PURPOSES) {
            addUrl(
              `${BASE_URL}/properties/${purpose}/${citySlug}/${areaSlug}`,
              'daily',
              '0.8',
              areaLastmod
            );

            // Area + property type combinations
            for (const type of PROPERTY_TYPES) {
              addUrl(
                `${BASE_URL}/properties/${purpose}/${citySlug}/${areaSlug}/${type}`,
                'weekly',
                '0.65'
              );
            }
          }

          // Safety limit
          if (urls.length >= 49000) break;
        }
      } catch (areaErr) {
        // Area fetch fail ho jaye tou skip karo, city URLs to hain
        console.error(`[sitemap-areas] Areas for city "${citySlug}" failed:`, areaErr);
      }

      if (urls.length >= 49000) break;
    }

    const xml = generateXml(urls);

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        // 6 ghante ka cache — cities/areas rarely change
        'Cache-Control': 'public, max-age=21600, stale-while-revalidate=43200',
      },
    });
  } catch (err) {
    console.error('[sitemap-areas] Fatal error:', err);
    return new NextResponse('Error generating sitemap', { status: 500 });
  }
}
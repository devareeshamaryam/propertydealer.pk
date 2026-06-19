 // app/sitemap-properties.xml/route.ts
// ─── PROPERTIES SITEMAP ────────────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { serverApi } from '@/lib/server-api';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealers.pk';

const PAGE_SIZE = 100;

function generateXml(urls: Array<{ loc: string; lastmod: string; changefreq: string; priority: string }>) {
  const urlSet = urls.map(({ loc, lastmod, changefreq, priority }) => `
  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urlSet}
</urlset>`;
}

export async function GET() {
  try {
    const urls: Array<{ loc: string; lastmod: string; changefreq: string; priority: string }> = [];
    const today = new Date().toISOString().split('T')[0]!;

    let page = 1;
    let hasMore = true;

    while (hasMore) {
      try {
        // FIX: revalidate: 0 — fresh data har baar, cache se purani properties na aayein
        const res = await serverApi.getProperties(
          `limit=${PAGE_SIZE}&page=${page}&status=active`
        );

        // FIX: Direct array handle + fallback
        const rawProps: any[] = Array.isArray(res) ? res : (res as any).properties || [];

        console.log(`[sitemap-properties] Page ${page}: ${rawProps.length} properties fetched`);

        if (rawProps.length === 0) {
          hasMore = false;
          break;
        }

        for (const property of rawProps) {
          const slug = property.slug || property._id;
          if (!slug) continue;

          const createdAt = property.createdAt ? new Date(property.createdAt) : new Date();
          const ageInDays = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
          const priority  = ageInDays < 7 ? '0.9' : ageInDays < 30 ? '0.8' : '0.7';
          const changefreq = ageInDays < 30 ? 'daily' : 'weekly';

          const lastmod = property.updatedAt
            ? new Date(property.updatedAt).toISOString().split('T')[0]!
            : today;

          urls.push({
            loc: `${BASE_URL}/p/${slug}`,
            lastmod,
            changefreq,
            priority,
          });

          // Clean URL — city + area + purpose
          const areaObj  = typeof property.area === 'object' ? property.area : null;
          const citySlug = areaObj?.city?.areaSlug || areaObj?.city?.slug;
          const areaSlug = areaObj?.areaSlug || areaObj?.slug;
          const purpose  = property.listingType === 'sale' ? 'sale' : 'rent';

          if (citySlug && areaSlug) {
            const cleanUrl = `${BASE_URL}/properties/${purpose}/${citySlug}/${areaSlug}`;
            if (!urls.find(u => u.loc === cleanUrl)) {
              urls.push({
                loc:        cleanUrl,
                lastmod:    today,
                changefreq: 'daily',
                priority:   '0.7',
              });
            }
          }
        }

        if (rawProps.length < PAGE_SIZE) {
          hasMore = false;
        } else {
          page++;
        }

        if (urls.length >= 49000) hasMore = false;

      } catch (pageErr) {
        console.error(`[sitemap-properties] Page ${page} fetch failed:`, pageErr);
        hasMore = false;
      }
    }

    console.log(`[sitemap-properties] Total URLs: ${urls.length}`);

    const xml = generateXml(urls);

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        // FIX: 15 min cache — nai properties jaldi nazar aayein
        'Cache-Control': 'public, max-age=900, stale-while-revalidate=1800',
      },
    });

  } catch (err) {
    console.error('[sitemap-properties] Fatal error:', err);
    return new NextResponse('Error generating sitemap', { status: 500 });
  }
}
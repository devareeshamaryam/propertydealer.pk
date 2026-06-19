 // app/sitemap-pages.xml/route.ts
// ─── STATIC PAGES SITEMAP ──────────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { serverApi } from '@/lib/server-api';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealers.pk';

const STATIC_PAGES = [
  { url: '/',                                      priority: '1.0', changefreq: 'daily'   },
  { url: '/about',                                 priority: '0.6', changefreq: 'monthly' },
  { url: '/blog',                                  priority: '0.8', changefreq: 'daily'   },
  { url: '/properties',                            priority: '0.9', changefreq: 'daily'   },
  { url: '/properties/sale',                       priority: '0.9', changefreq: 'daily'   },
  { url: '/properties/rent',                       priority: '0.9', changefreq: 'daily'   },
  { url: '/properties/all',                        priority: '0.9', changefreq: 'daily'   },
  { url: '/packages',                              priority: '0.7', changefreq: 'weekly'  },
  { url: '/map',                                   priority: '0.6', changefreq: 'weekly'  },
  { url: '/emap',                                  priority: '0.5', changefreq: 'weekly'  },
  { url: '/hotels',                                priority: '0.6', changefreq: 'weekly'  },
  { url: '/random',                                priority: '0.4', changefreq: 'weekly'  },
  { url: '/today-cement-rate-in-pakistan',         priority: '0.8', changefreq: 'daily'   },
  { url: '/today-steel-rate-in-pakistan',          priority: '0.8', changefreq: 'daily'   },
  { url: '/today-bajri-rate-in-pakistan',          priority: '0.8', changefreq: 'daily'   },
  { url: '/today-bricks-rate-in-pakistan',         priority: '0.8', changefreq: 'daily'   },
  { url: '/today-sand-rate-in-pakistan',           priority: '0.8', changefreq: 'daily'   },
  { url: '/today-door-rate-in-pakistan',           priority: '0.8', changefreq: 'daily'   },
  { url: '/today-tile-rate-in-pakistan',           priority: '0.8', changefreq: 'daily'   },
  { url: '/today-wood-rate-in-pakistan',           priority: '0.8', changefreq: 'daily'   },
  { url: '/listing-detail',                        priority: '0.5', changefreq: 'weekly'  },
  { url: '/p',                                     priority: '0.5', changefreq: 'daily'   },
];

const PROPERTY_TYPES = [
  'house', 'apartment', 'flat', 'plot', 'shop', 'office',
  'land', 'commercial', 'factory', 'hotel', 'restaurant'
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
    const today = new Date().toISOString().split('T')[0]!;
    const urls: Array<{ loc: string; lastmod: string; changefreq: string; priority: string }> = [];

    // 1. Static pages
    for (const page of STATIC_PAGES) {
      urls.push({
        loc:        `${BASE_URL}${page.url}`,
        lastmod:    today,
        changefreq: page.changefreq,
        priority:   page.priority,
      });
    }

    // 2. City-based property pages — DB se fresh fetch
    try {
      // FIX: Direct array handle — getCities() array return karta hai
      const citiesRes = await serverApi.getCities();
      const cities: any[] = Array.isArray(citiesRes) ? citiesRes : [];

      console.log(`[sitemap-pages] Cities fetched: ${cities.length}`);

      for (const city of cities) {
        const slug = city.slug || city.name?.toLowerCase().replace(/\s+/g, '-');
        if (!slug) continue;

        for (const purpose of ['sale', 'rent', 'all']) {
          urls.push({
            loc:        `${BASE_URL}/properties/${purpose}/${slug}`,
            lastmod:    city.updatedAt
              ? new Date(city.updatedAt).toISOString().split('T')[0]!
              : today,
            changefreq: 'daily',
            priority:   '0.8',
          });

          for (const type of PROPERTY_TYPES) {
            urls.push({
              loc:        `${BASE_URL}/properties/${purpose}/${slug}/${type}`,
              lastmod:    today,
              changefreq: 'weekly',
              priority:   '0.6',
            });
          }
        }
      }
    } catch (err) {
      console.error('[sitemap-pages] Cities fetch failed:', err);
    }

    console.log(`[sitemap-pages] Total URLs: ${urls.length}`);

    const xml = generateXml(urls);

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        // FIX: 1 ghante ka cache
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=7200',
      },
    });

  } catch (err) {
    console.error('[sitemap-pages] Error:', err);
    return new NextResponse('Error generating sitemap', { status: 500 });
  }
}
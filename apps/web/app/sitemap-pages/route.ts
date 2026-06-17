// app/sitemap-pages.xml/route.ts
// ─── STATIC PAGES SITEMAP ──────────────────────────────────────────────────
// Ye sitemap tamam static pages cover karta hai:
// - Home, About, Blog index, Properties index
// - Today rates pages (cement, steel, bajri, bricks, etc.)
// - Special pages

import { NextResponse } from 'next/server';
import { serverApi } from '@/lib/server-api';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealers.pk';

// Static pages jo hamesha same rehte hain
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
  // Today rates pages (sab auto-update hote hain)
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

// Property types for sale/rent/all combinations
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

    // 2. City-based property pages (sale + rent + all) — DB se fetch
    try {
      const cities = await serverApi.getCities(); // tamam cities fetch karo
      for (const city of cities) {
        const slug = city.slug || city.name?.toLowerCase().replace(/\s+/g, '-');
        if (!slug) continue;

        // City level pages
        for (const purpose of ['sale', 'rent', 'all']) {
          urls.push({
            loc:        `${BASE_URL}/properties/${purpose}/${slug}`,
            lastmod:    city.updatedAt ? new Date(city.updatedAt).toISOString().split('T')[0]! : today,
            changefreq: 'daily',
            priority:   '0.8',
          });

          // City + type combinations
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

    const xml = generateXml(urls);

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        // 1 ghante ka cache — pages frequently change nahi hote
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    });
  } catch (err) {
    console.error('[sitemap-pages] Error:', err);
    return new NextResponse('Error generating sitemap', { status: 500 });
  }
}
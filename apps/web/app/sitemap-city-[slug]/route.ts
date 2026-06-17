 // app/sitemap-city-[slug].xml/route.ts
import { NextResponse } from 'next/server';
import { serverApi } from '@/lib/server-api';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealers.pk';

const PROPERTY_TYPES = [
  'house', 'apartment', 'flat', 'plot',
  'shop', 'office', 'land', 'commercial'
];

const PURPOSES = ['sale', 'rent', 'all'] as const;
const COMMON_MARLAS = [3, 5, 7, 10, 20];

function marlaToSlug(marla: number): string {
  return marla === 20 ? '1kanal' : `${marla}marla`;
}

function generateXml(
  citySlug: string,
  urls: Array<{ loc: string; lastmod: string; changefreq: string; priority: string }>
) {
  const urlSet = urls
    .map(({ loc, lastmod, changefreq, priority }) => `
  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`)
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlSet}
</urlset>`;
}

// ✅ Fix: URL se slug nikalo, params se nahi
export async function GET(request: Request) {
  // URL: /sitemap-city-lahore.xml → slug = "lahore"
  const url = new URL(request.url);
  const pathname = url.pathname; // /sitemap-city-lahore.xml
  const match = pathname.match(/sitemap-city-([^.]+)\.xml/);
  const citySlug = match?.[1] ?? '';

  if (!citySlug) {
    return new NextResponse('Invalid city slug', { status: 400 });
  }

  try {
    const today = new Date().toISOString().split('T')[0]!;
    const urls: Array<{ loc: string; lastmod: string; changefreq: string; priority: string }> = [];
    const seen = new Set<string>();

    const addUrl = (loc: string, changefreq: string, priority: string, lastmod = today) => {
      if (seen.has(loc)) return;
      seen.add(loc);
      urls.push({ loc, lastmod, changefreq, priority });
    };

    for (const purpose of PURPOSES) {
      addUrl(`${BASE_URL}/properties/${purpose}/${citySlug}`, 'daily', '0.9');
      for (const type of PROPERTY_TYPES) {
        addUrl(`${BASE_URL}/properties/${purpose}/${citySlug}/${type}`, 'weekly', '0.7');
        for (const marla of COMMON_MARLAS) {
          addUrl(`${BASE_URL}/properties/${purpose}/${citySlug}/${type}/${marlaToSlug(marla)}`, 'weekly', '0.6');
        }
      }
    }

    let cityData: any = null;
    try {
      cityData = await serverApi.getCityByName(citySlug);
    } catch {}

    if (cityData) {
      const cityLastmod = cityData.updatedAt
        ? new Date(cityData.updatedAt).toISOString().split('T')[0]!
        : today;

      for (const purpose of PURPOSES) {
        seen.delete(`${BASE_URL}/properties/${purpose}/${citySlug}`);
        addUrl(`${BASE_URL}/properties/${purpose}/${citySlug}`, 'daily', '0.9', cityLastmod);
      }

      let areas: any[] = [];
      try {
        areas = await serverApi.getAreasByCity(cityData._id);
      } catch (err) {
        console.error(`[sitemap-city-${citySlug}] Areas fetch failed:`, err);
      }

      for (const area of areas) {
        const areaSlug = area.areaSlug || area.slug || area.name?.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
        if (!areaSlug) continue;

        const areaLastmod = area.updatedAt
          ? new Date(area.updatedAt).toISOString().split('T')[0]!
          : today;

        for (const purpose of PURPOSES) {
          addUrl(`${BASE_URL}/properties/${purpose}/${citySlug}/${areaSlug}`, 'daily', '0.85', areaLastmod);
          for (const type of PROPERTY_TYPES) {
            addUrl(`${BASE_URL}/properties/${purpose}/${citySlug}/${areaSlug}/${type}`, 'weekly', '0.7');
          }
        }

        if (urls.length >= 49000) break;
      }

      try {
        const res = await serverApi.getProperties(`city=${citySlug}&limit=500&page=1&status=active`);
        const properties: any[] = Array.isArray(res) ? res : (res as any).properties || [];

        for (const property of properties) {
          const propSlug = property.slug || property._id;
          if (!propSlug) continue;
          const propLastmod = property.updatedAt
            ? new Date(property.updatedAt).toISOString().split('T')[0]!
            : today;
          addUrl(`${BASE_URL}/p/${propSlug}`, 'weekly', '0.8', propLastmod);
        }
      } catch (err) {
        console.error(`[sitemap-city-${citySlug}] Properties fetch failed:`, err);
      }
    }

    if (urls.length === 0) {
      return new NextResponse('City not found', { status: 404 });
    }

    const xml = generateXml(citySlug, urls);
    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=7200, stale-while-revalidate=14400',
      },
    });
  } catch (err) {
    console.error(`[sitemap-city-${citySlug}] Fatal error:`, err);
    return new NextResponse('Error generating sitemap', { status: 500 });
  }
}
// app/sitemap-properties.xml/route.ts
// ─── PROPERTIES SITEMAP ────────────────────────────────────────────────────
// Ye sitemap tamam individual property listings cover karta hai.
// MongoDB se real-time fetch hota hai.
// Jab naya property add ho, automatically yahan aa jata hai.
//
// URL format: /properties/[slug]  ya  /p/[slug]
// Example:    /p/3-bed-house-for-sale-in-dha-lahore-abc123

import { NextResponse } from 'next/server';
import { serverApi } from '@/lib/server-api';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealers.pk';

// Ek baar mein kitne properties fetch karne hain
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

    // Paginated fetch — agar bohot zyada properties hain
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      try {
        const res = await serverApi.getProperties(
          `limit=${PAGE_SIZE}&page=${page}&status=active`
        );

        // Aapka API array ya { properties: [] } return karta hai
        const rawProps: any[] = Array.isArray(res) ? res : (res as any).properties || [];

        if (rawProps.length === 0) {
          hasMore = false;
          break;
        }

        for (const property of rawProps) {
          // slug based URL — aapke code mein /p/[slug] pattern use hota hai
          const slug = property.slug || property._id;
          if (!slug) continue;

          // Naye listings ko zyada priority
          const createdAt = property.createdAt ? new Date(property.createdAt) : new Date();
          const ageInDays = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
          const priority = ageInDays < 7 ? '0.9' : ageInDays < 30 ? '0.8' : '0.7';
          const changefreq = ageInDays < 30 ? 'daily' : 'weekly';

          const lastmod = property.updatedAt
            ? new Date(property.updatedAt).toISOString().split('T')[0]!
            : today;

          urls.push({
            loc:        `${BASE_URL}/p/${slug}`,
            lastmod,
            changefreq,
            priority,
          });

          // Clean URL format bhi add karo (sale/rent + city + area)
          // Aapke code mein /properties/[purpose]/[city]/[area] format hai
          const areaObj  = typeof property.area === 'object' ? property.area : null;
          const citySlug = areaObj?.city?.areaSlug || areaObj?.city?.slug;
          const areaSlug = areaObj?.areaSlug || areaObj?.slug;
          const purpose  = property.listingType === 'sale' ? 'sale' : 'rent';

          // Agar city aur area dono hain tou clean URL bhi add karo
          if (citySlug && areaSlug) {
            // Duplicate avoid karo
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

        // Agar returned results PAGE_SIZE se kam hain, tou last page hai
        if (rawProps.length < PAGE_SIZE) {
          hasMore = false;
        } else {
          page++;
        }

        // Safety limit — 50,000 se zyada URLs ek sitemap mein nahi chahiye
        if (urls.length >= 49000) {
          hasMore = false;
        }
      } catch (pageErr) {
        console.error(`[sitemap-properties] Page ${page} fetch failed:`, pageErr);
        hasMore = false;
      }
    }

    const xml = generateXml(urls);

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        // 30 minute cache — properties regularly update hoti hain
        'Cache-Control': 'public, max-age=1800, stale-while-revalidate=3600',
      },
    });
  } catch (err) {
    console.error('[sitemap-properties] Fatal error:', err);
    return new NextResponse('Error generating sitemap', { status: 500 });
  }
}
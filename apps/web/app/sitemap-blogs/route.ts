 // app/sitemap-blogs.xml/route.ts
// ─── BLOGS SITEMAP ─────────────────────────────────────────────────────────

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
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlSet}
</urlset>`;
}

export async function GET() {
  try {
    const urls: Array<{ loc: string; lastmod: string; changefreq: string; priority: string }> = [];
    const today = new Date().toISOString().split('T')[0]!;

    // Blog index page
    urls.push({
      loc:        `${BASE_URL}/blog`,
      lastmod:    today,
      changefreq: 'daily',
      priority:   '0.8',
    });

    // ── 1. Blog Posts ───────────────────────────────────────────────────────
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      try {
        // FIX 1: status=published query hataya — backend filter kaam nahi kar raha tha
        // FIX 2: revalidate: 0 — taake fresh data aaye, purana cache na serve ho
        const res = await serverApi.get(
          `/blog?limit=${PAGE_SIZE}&page=${page}`,
          { next: { revalidate: 0 } }
        );

        // FIX 3: Aapka API direct array deta hai — sirf Array.isArray check kaafi hai
        const blogs: any[] = Array.isArray(res) ? res : [];

        console.log(`[sitemap-blogs] Page ${page}: ${blogs.length} blogs fetched`);

        if (blogs.length === 0) {
          hasMore = false;
          break;
        }

        for (const blog of blogs) {
          if (!blog.slug) continue;

          // FIX 4: Status filter ab code side ho raha hai (query side nahi)
          if (blog.status && blog.status !== 'published') continue;

          const lastmod = blog.updatedAt
            ? new Date(blog.updatedAt).toISOString().split('T')[0]!
            : blog.createdAt
              ? new Date(blog.createdAt).toISOString().split('T')[0]!
              : today;

          const createdAt = blog.createdAt ? new Date(blog.createdAt) : new Date();
          const ageInDays = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
          const priority   = ageInDays < 7 ? '0.8' : '0.7';
          const changefreq = ageInDays < 30 ? 'weekly' : 'monthly';

          urls.push({
            loc: `${BASE_URL}/blog/${blog.slug}`,
            lastmod,
            changefreq,
            priority,
          });
        }

        // Agar returned results PAGE_SIZE se kam hain — last page hai
        if (blogs.length < PAGE_SIZE) {
          hasMore = false;
        } else {
          page++;
        }

        if (urls.length >= 49000) hasMore = false;

      } catch (pageErr) {
        console.error(`[sitemap-blogs] Blog page ${page} failed:`, pageErr);
        hasMore = false;
      }
    }

    console.log(`[sitemap-blogs] Total blog URLs: ${urls.length}`);

    // ── 2. Blog Categories ──────────────────────────────────────────────────
    try {
      const categoriesRes = await serverApi.get(
        `/blog-category?limit=200`,
        { next: { revalidate: 0 } } // FIX 5: categories bhi fresh fetch karo
      );

      // FIX 6: Direct array handle karo
      const categories: any[] = Array.isArray(categoriesRes)
        ? categoriesRes
        : (categoriesRes as any).categories || (categoriesRes as any).data || [];

      console.log(`[sitemap-blogs] Categories fetched: ${categories.length}`);

      for (const cat of categories) {
        if (!cat.slug) continue;

        urls.push({
          loc:        `${BASE_URL}/blog/${cat.slug}`,
          lastmod:    cat.updatedAt
            ? new Date(cat.updatedAt).toISOString().split('T')[0]!
            : today,
          changefreq: 'weekly',
          priority:   '0.7',
        });
      }
    } catch (catErr) {
      console.error('[sitemap-blogs] Categories fetch failed:', catErr);
    }

    const xml = generateXml(urls);

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        // FIX 7: Cache kam kiya — 30 min — taake naye blogs jaldi nazar aayein
        'Cache-Control': 'public, max-age=1800, stale-while-revalidate=3600',
      },
    });

  } catch (err) {
    console.error('[sitemap-blogs] Fatal error:', err);
    return new NextResponse('Error generating sitemap', { status: 500 });
  }
}
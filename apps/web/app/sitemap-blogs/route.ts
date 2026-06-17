// app/sitemap-blogs.xml/route.ts
// ─── BLOGS SITEMAP ─────────────────────────────────────────────────────────
// Ye sitemap cover karta hai:
// - Tamam published blog posts (/blog/[slug])
// - Blog categories (/blog/category/[slug])
// - Blog tag pages (agar aap use karte hain)
//
// Aapke code mein: serverApi.get('/blog/slug/[slug]') pattern hai
// Aur blogCategoryApi.getCategoryBySlug() bhi hai

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
    // Aapke blogApi.getPublishedBlogs() se fetch karo
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      try {
        // Aapki serverApi use karo — blog list endpoint
        const res = await serverApi.get(
          `/blog?status=published&limit=${PAGE_SIZE}&page=${page}`,
          { next: { revalidate: 1800 } }
        );

        // Response format: array ya { blogs: [], total: N }
        const blogs: any[] = Array.isArray(res)
          ? res
          : (res as any).blogs || (res as any).data || [];

        if (blogs.length === 0) {
          hasMore = false;
          break;
        }

        for (const blog of blogs) {
          if (!blog.slug) continue;
          // Sirf published blogs
          if (blog.status && blog.status !== 'published') continue;

          const lastmod = blog.updatedAt
            ? new Date(blog.updatedAt).toISOString().split('T')[0]!
            : blog.createdAt
              ? new Date(blog.createdAt).toISOString().split('T')[0]!
              : today;

          // Naye blogs ko zyada priority
          const createdAt  = blog.createdAt ? new Date(blog.createdAt) : new Date();
          const ageInDays  = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
          const priority   = ageInDays < 7 ? '0.8' : '0.7';
          const changefreq = ageInDays < 30 ? 'weekly' : 'monthly';

          urls.push({
            loc: `${BASE_URL}/blog/${blog.slug}`,
            lastmod,
            changefreq,
            priority,
          });
        }

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

    // ── 2. Blog Categories ──────────────────────────────────────────────────
    // Aapke code mein /blog/[slug] category pages hain
    try {
      const categoriesRes = await serverApi.get(
        `/blog-category?limit=200`,
        { next: { revalidate: 3600 } }
      );

      const categories: any[] = Array.isArray(categoriesRes)
        ? categoriesRes
        : (categoriesRes as any).categories || (categoriesRes as any).data || [];

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
        // 1 ghante ka cache — blogs daily nahi aate
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=7200',
      },
    });
  } catch (err) {
    console.error('[sitemap-blogs] Fatal error:', err);
    return new NextResponse('Error generating sitemap', { status: 500 });
  }
}
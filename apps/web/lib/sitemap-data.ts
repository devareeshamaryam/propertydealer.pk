/*
 * The sitemaps' data (GET /seo/sitemap-data): live listings, published blog
 * posts, and the archive pages that have listings. One cached request shared
 * by sitemap-pages / -areas / -properties / -blogs.
 */

export const SITE_URL = (process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealer.pk').replace(/\/$/, '');

export interface SitemapData {
  listings: { slug: string; lastmod: string; image?: string; title?: string }[];
  blogs: { slug: string; lastmod: string; image?: string; title?: string }[];
  /** `/properties/<purpose>/<city>[/<area>][/<type>]` with at least one listing. */
  archives: { path: string; count: number; lastmod: string; depth: number }[];
}

const RAW = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';
const API = `${RAW.trim().replace(/\/$/, '')}/api`;

export async function getSitemapData(): Promise<SitemapData> {
  const res = await fetch(`${API}/seo/sitemap-data`, { next: { revalidate: 3600, tags: ['properties', 'blogs'] }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`sitemap-data ${res.status}`);
  return res.json();
}

const esc = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);

const abs = (u: string) => (u.startsWith('http') ? u : `${SITE_URL}${u.startsWith('/') ? '' : '/'}${u}`);

export function sitemapXml(rows: { loc: string; lastmod?: string; changefreq?: string; priority?: string; image?: string; imageTitle?: string }[]) {
  const hasImages = rows.some((r) => r.image);
  const body = rows
    .map(
      (r) => `
  <url>
    <loc>${esc(r.loc)}</loc>${r.lastmod ? `\n    <lastmod>${r.lastmod}</lastmod>` : ''}${r.changefreq ? `\n    <changefreq>${r.changefreq}</changefreq>` : ''}${
        r.priority ? `\n    <priority>${r.priority}</priority>` : ''
      }${r.image ? `\n    <image:image><image:loc>${esc(abs(r.image))}</image:loc>${r.imageTitle ? `<image:title>${esc(r.imageTitle)}</image:title>` : ''}</image:image>` : ''}
  </url>`,
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${hasImages ? ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"' : ''}>${body}
</urlset>`;
}

export function xmlResponse(xml: string) {
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400' },
  });
}

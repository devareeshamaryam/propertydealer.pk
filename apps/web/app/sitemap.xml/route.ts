// /sitemap.xml — a sitemap index (the format search engines expect for a list
// of sitemaps). It used to be a plain URL list that happened to contain them.

import { SITE_URL } from '@/lib/sitemap-data';

const SITEMAPS = ['pages', 'properties', 'areas', 'blogs', 'rates', 'maps'];

export function GET() {
  const now = new Date().toISOString();
  const body = SITEMAPS.map((s) => `\n  <sitemap>\n    <loc>${SITE_URL}/sitemap-${s}.xml</loc>\n    <lastmod>${now}</lastmod>\n  </sitemap>`).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}\n</sitemapindex>`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}

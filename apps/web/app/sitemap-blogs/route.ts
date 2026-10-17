// /sitemap-blogs.xml — the blog and every published post. (The old one asked
// for page after page of an API that ignores paging, so it never finished.)

import { getSitemapData, sitemapXml, xmlResponse, SITE_URL } from '@/lib/sitemap-data';

export async function GET() {
  const rows: Parameters<typeof sitemapXml>[0] = [{ loc: `${SITE_URL}/blog`, changefreq: 'daily', priority: '0.8' }];
  try {
    const data = await getSitemapData();
    for (const b of data.blogs) {
      rows.push({ loc: `${SITE_URL}/blog/${b.slug}`, lastmod: b.lastmod, changefreq: 'monthly', priority: '0.7', image: b.image, imageTitle: b.title });
    }
  } catch (err) {
    console.error('[sitemap-blogs]', err);
  }
  return xmlResponse(sitemapXml(rows));
}

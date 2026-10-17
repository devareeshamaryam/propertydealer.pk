// /sitemap-areas.xml — area archive pages (city + area, and + property type),
// only those with listings. Listing every combination put 15,600 mostly empty
// pages in front of search engines.

import { getSitemapData, sitemapXml, xmlResponse, SITE_URL } from '@/lib/sitemap-data';

const TYPE = /\/(house|apartment|flat|plot|shop|office|land|commercial|factory|hotel|restaurant)$/;

export async function GET() {
  const rows: Parameters<typeof sitemapXml>[0] = [];
  try {
    const data = await getSitemapData();
    for (const a of data.archives) {
      const area = (a.depth === 4 && !TYPE.test(a.path)) || a.depth === 5;
      if (!area) continue;
      rows.push({ loc: `${SITE_URL}${a.path}`, lastmod: a.lastmod, changefreq: 'daily', priority: a.depth === 4 ? '0.7' : '0.6' });
    }
  } catch (err) {
    console.error('[sitemap-areas]', err);
  }
  return xmlResponse(sitemapXml(rows));
}

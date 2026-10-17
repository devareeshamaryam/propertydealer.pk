// /sitemap-properties.xml — every live listing at its real address,
// /properties/<slug>, with its main photo. (It used to list /p/<slug>, which
// is not a listing route — every one 404'd — and stopped after 50 listings.)

import { getSitemapData, sitemapXml, xmlResponse, SITE_URL } from '@/lib/sitemap-data';

export async function GET() {
  const rows: Parameters<typeof sitemapXml>[0] = [];
  try {
    const data = await getSitemapData();
    for (const l of data.listings.slice(0, 49000)) {
      rows.push({ loc: `${SITE_URL}/properties/${l.slug}`, lastmod: l.lastmod, changefreq: 'weekly', priority: '0.7', image: l.image, imageTitle: l.title });
    }
  } catch (err) {
    console.error('[sitemap-properties]', err);
  }
  return xmlResponse(sitemapXml(rows));
}

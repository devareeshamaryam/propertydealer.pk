// /sitemap-pages.xml — the site's own pages, then each city's archive pages
// (city, and city + property type) — only those with listings.

import { getSitemapData, sitemapXml, xmlResponse, SITE_URL } from '@/lib/sitemap-data';
import { getSocieties } from '@/lib/societies';
import { TOOLS } from '@/lib/tools';

const STATIC_PAGES = [
  { url: '/',                                      priority: '1.0', changefreq: 'daily'   },
  { url: '/about',                                 priority: '0.6', changefreq: 'monthly' },
  { url: '/blog',                                  priority: '0.8', changefreq: 'daily'   },
  { url: '/contact',                               priority: '0.5', changefreq: 'monthly' },
  { url: '/privacy-policy',                        priority: '0.3', changefreq: 'yearly'  },
  { url: '/terms',                                 priority: '0.3', changefreq: 'yearly'  },
  { url: '/agents',                                priority: '0.6', changefreq: 'weekly'  },
  { url: '/properties',                            priority: '0.9', changefreq: 'daily'   },
  { url: '/properties/sale',                       priority: '0.9', changefreq: 'daily'   },
  { url: '/properties/rent',                       priority: '0.9', changefreq: 'daily'   },
  { url: '/properties/all',                        priority: '0.9', changefreq: 'daily'   },
  { url: '/packages',                              priority: '0.7', changefreq: 'weekly'  },
  { url: '/emap',                                  priority: '0.5', changefreq: 'weekly'  },
  { url: '/today-cement-rate-in-pakistan',         priority: '0.8', changefreq: 'daily'   },
  { url: '/today-steel-rate-in-pakistan',          priority: '0.8', changefreq: 'daily'   },
  { url: '/today-bajri-rate-in-pakistan',          priority: '0.8', changefreq: 'daily'   },
  { url: '/today-bricks-rate-in-pakistan',         priority: '0.8', changefreq: 'daily'   },
  { url: '/today-sand-rate-in-pakistan',           priority: '0.8', changefreq: 'daily'   },
  { url: '/today-door-rate-in-pakistan',           priority: '0.8', changefreq: 'daily'   },
  { url: '/today-tile-rate-in-pakistan',           priority: '0.8', changefreq: 'daily'   },
  { url: '/today-wood-rate-in-pakistan',           priority: '0.8', changefreq: 'daily'   },
  { url: '/tools',                                 priority: '0.7', changefreq: 'monthly' },
  ...TOOLS.map((t) => ({ url: `/tools/${t.slug}`, priority: t.slug === 'construction-cost-calculator' ? '0.8' : '0.7', changefreq: t.slug === 'construction-cost-calculator' ? 'daily' : 'monthly' })),
];

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);
  const rows: Parameters<typeof sitemapXml>[0] = STATIC_PAGES.map((p) => ({ loc: `${SITE_URL}${p.url}`, lastmod: today, changefreq: p.changefreq, priority: p.priority }));
  try {
    const data = await getSitemapData();
    for (const a of data.archives) {
      // /properties/<purpose>/<city> and /properties/<purpose>/<city>/<type>; areas are in sitemap-areas.
      if (a.depth > 4) continue;
      const isType = a.depth === 4 && /\/(house|apartment|flat|plot|shop|office|land|commercial|factory|hotel|restaurant)$/.test(a.path);
      if (a.depth === 4 && !isType) continue;
      rows.push({ loc: `${SITE_URL}${a.path}`, lastmod: a.lastmod, changefreq: 'daily', priority: a.depth === 3 ? '0.8' : '0.6' });
    }
  } catch (err) {
    console.error('[sitemap-pages]', err);
  }
  // Society guides (published only), and each city's list of them.
  const societies = await getSocieties();
  if (societies.length) {
    rows.push({ loc: `${SITE_URL}/societies`, lastmod: today, changefreq: 'weekly', priority: '0.7' });
    for (const city of [...new Set(societies.map((s) => s.citySlug))]) {
      rows.push({ loc: `${SITE_URL}/societies/${city}`, lastmod: today, changefreq: 'weekly', priority: '0.7' });
    }
    for (const s of societies) {
      rows.push({ loc: `${SITE_URL}/societies/${s.citySlug}/${s.slug}`, lastmod: today, changefreq: 'weekly', priority: '0.8' });
    }
  }
  return xmlResponse(sitemapXml(rows));
}

import { getDealerCities } from '@/lib/server-api';
import { getSiteSettings } from '@/lib/site-settings.server';
import { dealersCityPath, hasDealers } from '@/lib/dealers';

/*
 * There is no all-Pakistan dealers page — only one page per city. Where the
 * site needs one dealers link (the footer, the homepage, and the old
 * addresses /agents and /property-dealers, which redirect), it goes to the
 * default city's page (Settings → Homepage → Default city), or to the city
 * with the most dealers when that one has none yet.
 */

const slug = (name: string) =>
  String(name ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export async function mainDealersPath(): Promise<string | null> {
  const [settings, cities] = await Promise.all([getSiteSettings(), getDealerCities()]);
  const live = cities.filter(hasDealers);
  const want = slug(settings.defaultCity || 'lahore');
  const hit = live.find((c) => c.slug === want) ?? [...live].sort((a, b) => b.agencies + b.agents - (a.agencies + a.agents))[0];
  return hit ? dealersCityPath(hit.slug) : null;
}

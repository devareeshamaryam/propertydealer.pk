import PropertiesClient from './PropertiesClient';
import { fetchInitialListings } from '@/lib/server-api';

/*
 * /properties: the newest listings are rendered with the HTML (they used to
 * load only in the browser, so the page reached search engines empty).
 * Cached, refreshed every 5 minutes and whenever a listing changes.
 */
export const revalidate = 300;

export default async function PropertiesPage() {
  const initial = await fetchInitialListings({ purpose: 'all' });
  return <PropertiesClient initialProperties={initial.properties} />;
}

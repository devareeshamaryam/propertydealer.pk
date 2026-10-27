import { permanentRedirect } from 'next/navigation';
import { mainDealersPath } from '@/lib/dealers.server';

/*
 * /agents — once a page of verified agencies. Agencies and agents now live on
 * one page per city (/property-dealers-in-<city>, agencies at the top), so
 * this address redirects permanently to the default city's page and its
 * ranking goes with it. Agent profiles stay where they are: /agents/<name>.
 */

export const revalidate = 600;

export default async function AgentsIndex() {
  permanentRedirect((await mainDealersPath()) ?? '/properties');
}

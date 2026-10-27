import { permanentRedirect } from 'next/navigation';
import { mainDealersPath } from '@/lib/dealers.server';

/*
 * /property-dealers — there is no all-Pakistan page, only one page per city
 * (/property-dealers-in-<city>). This address sends visitors and search
 * engines to the default city's page.
 */

export const revalidate = 600;

export default async function PropertyDealersIndex() {
  permanentRedirect((await mainDealersPath()) ?? '/properties');
}

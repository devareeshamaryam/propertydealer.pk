'use server';

import { cookies } from 'next/headers';
import { revalidatePath, updateTag } from 'next/cache';

/*
 * Make a dashboard write visible on the site straight away.
 *
 * The API also pings /api/revalidate after writes, but that depends on
 * WEB_URL and REVALIDATE_SECRET being set on both servers and the request
 * getting through — when it does not, a new brand colour or a "Sold" mark
 * only shows once the hour-long cache runs out. The dashboard calls these
 * right after a successful save instead, from the same server that renders
 * the pages, so the next page view is already fresh.
 *
 * Only for signed-in users (the token is checked against the API): clearing
 * a cache is harmless, but it should not be something anyone can spam.
 */

function apiBase(): string {
  const raw =
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://propertydealer.pk';
  return raw.endsWith('/') ? `${raw}api` : `${raw}/api`;
}

async function currentRole(token?: string | null): Promise<string | null> {
  const jar = await cookies();
  const bearer = token || jar.get('access_token')?.value;
  if (!bearer) return null;
  try {
    const response = await fetch(`${apiBase()}/auth/profile`, {
      headers: { Authorization: `Bearer ${bearer}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return null;
    const user = await response.json();
    return typeof user?.role === 'string' ? user.role : 'USER';
  } catch {
    return null;
  }
}

/** After Settings → Appearance / General: every page carries these values. */
export async function refreshSiteSettings(token?: string | null): Promise<boolean> {
  if ((await currentRole(token)) !== 'ADMIN') return false;
  updateTag('site-settings');
  revalidatePath('/', 'layout');
  return true;
}

/** After a listing is edited, marked sold/rented, featured or deleted. */
export async function refreshListing(slug?: string | null, token?: string | null): Promise<boolean> {
  if (!(await currentRole(token))) return false;
  updateTag('properties');
  if (slug) {
    updateTag(`property:slug:${slug}`);
    revalidatePath(`/properties/${slug}`);
    revalidatePath(`/p/${slug}`);
  }
  revalidatePath('/');
  revalidatePath('/properties', 'layout');
  return true;
}

/** After a rate, product or shop setting changes. */
export async function refreshShop(token?: string | null): Promise<boolean> {
  if (!(await currentRole(token))) return false;
  revalidatePath('/', 'layout');
  return true;
}

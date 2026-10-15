/**
 * A single-segment path under /properties is a listing (/properties/5-marla-
 * house-dha-lahore); /properties/all, /rent and /sale are the search pages.
 * /listing-detail/[id] and /p/[slug] are listing pages too.
 *
 * Used by the header and the tab bar: on phones a listing opens full-bleed,
 * photo to the top edge, the way property and classifieds apps do it.
 */
export function isPropertyDetail(pathname: string): boolean {
  if (pathname.startsWith('/p/') || pathname.startsWith('/listing-detail')) {
    return true;
  }
  const match = /^\/properties\/([^/]+)\/?$/.exec(pathname);
  return Boolean(match && !['all', 'rent', 'sale'].includes(match[1] ?? ''));
}

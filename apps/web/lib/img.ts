import type { ImageLoader } from 'next/image';

/*
 * Photos at the size they are shown.
 *
 * An uploaded photo (/uploads/…) is served resized by the API at
 * /img/<width>/<same path>. That address ends in the file's extension, so
 * Cloudflare caches it — unlike /_next/image?url=…, which went back to the
 * server for every photo on every visit. Anything else (an outside link) is
 * returned unchanged. Page addresses, og:image and schema keep the original.
 */

/** Must match THUMB_WIDTHS in apps/api/src/media/thumbs.ts. */
const WIDTHS = [96, 160, 256, 384, 480, 640, 828, 1080, 1280, 1600];
const OWN_HOST = /^(?:https?:\/\/(?:www\.)?(?:propertydealer\.pk|localhost(?::\d+)?|127\.0\.0\.1(?::\d+)?))?\/uploads\/(.+)$/i;
const EXT = /\.(?:jpe?g|png|webp|avif|gif)$/i;

const snap = (w: number) => WIDTHS.find((x) => x >= w) ?? WIDTHS[WIDTHS.length - 1]!;

/** The part after /uploads/ when this is one of our own photos, else null. */
function ownPath(src: string | null | undefined): string | null {
  if (!src) return null;
  const m = OWN_HOST.exec(src.split('?')[0]!.split('#')[0]!);
  return m && EXT.test(m[1]!) && !m[1]!.includes('..') ? m[1]! : null;
}

/** The photo resized to at least `width` pixels wide (or the address as given). */
export function photo(src: string, width: number): string;
export function photo(src: string | null | undefined, width: number): string | undefined;
export function photo(src: string | null | undefined, width: number) {
  const rel = ownPath(src);
  return rel ? `/img/${snap(width)}/${rel}` : (src ?? undefined);
}

/** srcset for an <img>: the browser picks the width it needs. */
export function photoSrcSet(src: string | null | undefined, widths: number[]): string | undefined {
  const rel = ownPath(src);
  if (!rel) return undefined;
  return [...new Set(widths.map(snap))].map((w) => `/img/${w}/${rel} ${w}w`).join(', ');
}

/**
 * For next/image: our photos go to /img, anything else to Next's own
 * optimizer exactly as before.
 */
export const photoLoader: ImageLoader = ({ src, width, quality }) => {
  const rel = ownPath(src);
  if (rel) return `/img/${snap(width)}/${rel}`;
  if (/^(?:https?:)?\/\//.test(src) || src.startsWith('/')) return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality ?? 75}`;
  return src;
};

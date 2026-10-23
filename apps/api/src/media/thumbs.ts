import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import type { NextFunction, Request, Response } from 'express';

/*
 * Resized copies of uploaded photos: /img/<width>/<path under /uploads>.
 *
 * Next's own optimizer (/_next/image?url=…) has no file extension, so
 * Cloudflare never caches it: every photo on every page went back to the
 * server, and a busy page could queue enough resizes for some photos to time
 * out and show as missing. These addresses end in the file's extension, so
 * Cloudflare keeps them at the edge after the first request; each width is
 * made once with sharp, kept on disk, and served from there afterwards.
 */

/** The only widths made — the image loader rounds up to one of these. */
export const THUMB_WIDTHS = [
  96, 160, 256, 384, 480, 640, 828, 1080, 1280, 1600,
];
const EXT = /\.(jpe?g|png|webp|avif|gif)$/i;
const QUALITY = 74;
/** At most this many resizes at once; the rest wait their turn. */
const MAX_PARALLEL = 2;

let running = 0;
const waiting: (() => void)[] = [];
const slot = () =>
  new Promise<void>((resolve) => {
    if (running < MAX_PARALLEL) {
      running++;
      resolve();
    } else waiting.push(resolve);
  });
const release = () => {
  const next = waiting.shift();
  if (next) next();
  else running--;
};

/** One resize per file and width at a time, however many visitors ask. */
const inFlight = new Map<string, Promise<void>>();

async function make(src: string, out: string, width: number) {
  await slot();
  try {
    await fs.promises.mkdir(path.dirname(out), { recursive: true });
    const tmp = `${out}.${process.pid}.${Date.now()}.tmp`;
    await sharp(src, { limitInputPixels: 80e6, animated: false })
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: QUALITY, effort: 4 })
      .toFile(tmp);
    await fs.promises.rename(tmp, out);
  } finally {
    release();
  }
}

export function thumbsMiddleware(uploadsPath: string) {
  const root = path.resolve(uploadsPath);
  const cacheRoot = path.join(root, '.thumbs');

  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    // /img/640/properties/2026/10/name.webp  (req.path is relative to /img)
    const m = /^\/(\d{2,4})\/(.+)$/.exec(req.path);
    const width = m ? Number(m[1]) : 0;
    let rel = '';
    try {
      rel = m ? decodeURIComponent(m[2]!) : '';
    } catch {
      rel = '';
    }
    if (
      !THUMB_WIDTHS.includes(width) ||
      !rel ||
      !EXT.test(rel) ||
      rel.includes('..') ||
      rel.startsWith('.')
    ) {
      res.status(404).setHeader('Cache-Control', 'public, max-age=300').end();
      return;
    }
    const src = path.resolve(root, rel);
    if (!src.startsWith(root + path.sep)) {
      res.status(404).end();
      return;
    }
    const out = path.join(cacheRoot, String(width), `${rel}.webp`);

    try {
      const [srcStat, outStat] = await Promise.all([
        fs.promises.stat(src).catch(() => null),
        fs.promises.stat(out).catch(() => null),
      ]);
      if (!srcStat) {
        res.status(404).setHeader('Cache-Control', 'public, max-age=300').end();
        return;
      }
      if (!outStat || outStat.mtimeMs < srcStat.mtimeMs) {
        const key = `${width}:${rel}`;
        let job = inFlight.get(key);
        if (!job) {
          job = make(src, out, width).finally(() => inFlight.delete(key));
          inFlight.set(key, job);
        }
        await job;
      }
      res.setHeader('Content-Type', 'image/webp');
      res.setHeader(
        'Cache-Control',
        'public, max-age=31536000, s-maxage=31536000, immutable',
      );
      res.sendFile(out, { dotfiles: 'allow' }, (err) => {
        if (err && !res.headersSent)
          res.status(500).setHeader('Cache-Control', 'no-store').end();
      });
    } catch {
      // Cannot resize (a corrupt file, say): send the original rather than nothing.
      if (!res.headersSent) {
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.sendFile(src, { dotfiles: 'allow' }, (err) => {
          if (err && !res.headersSent) res.status(404).end();
        });
      }
    }
  };
}

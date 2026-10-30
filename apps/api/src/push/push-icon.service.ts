import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import sharp from 'sharp';
import { SiteSettingsService } from '../site-settings/site-settings.service';

/**
 * The notification icon and the Android status-bar badge, made from the
 * site's own icon — whatever it is today:
 *
 *   1. the icon set in Push notifications → Settings,
 *   2. the favicon (Settings → Appearance),
 *   3. the logo (Settings → Appearance),
 *   4. the site's built-in logo and favicon.
 *
 * Change the favicon and the notifications change with it. The icon is the
 * picture on a white square (192 px, the size phones show); the badge is its
 * shape in white on transparent (96 px), which is what Android draws in the
 * status bar. Both are cached until the source changes, and their URLs carry
 * a version so browsers fetch the new one at once.
 */
@Injectable()
export class PushIconService {
  private readonly logger = new Logger('Push');
  private cache = new Map<string, { at: number; png: Buffer }>();

  constructor(private readonly site: SiteSettingsService) {}

  private webBase(): string {
    return (process.env.WEB_URL || process.env.NEXT_PUBLIC_SITE_URL || `https://${process.env.APP_HOST || 'propertydealer.pk'}`).replace(/\/$/, '');
  }

  /** The pictures to try, best first. */
  async sources(pushIcon?: string): Promise<string[]> {
    const s: any = await this.site.get().catch(() => ({}));
    return [pushIcon, s?.faviconUrl, s?.logoUrl, '/logo.png', '/favicon.ico'].map((u) => String(u || '').trim()).filter(Boolean);
  }

  /** "?v=…" for the icon URLs: changes whenever the source does. */
  async version(pushIcon?: string): Promise<string> {
    return createHash('sha1').update((await this.sources(pushIcon)).join('|')).digest('hex').slice(0, 10);
  }

  private async fetchImage(url: string): Promise<Buffer | null> {
    try {
      const abs = /^https?:\/\//i.test(url) ? url : `${this.webBase()}${url.startsWith('/') ? '' : '/'}${url}`;
      const res = await fetch(abs, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      return buf.length > 0 && buf.length < 8 * 1024 * 1024 ? this.fromIco(buf) : null;
    } catch {
      return null;
    }
  }

  /** An .ico holds one or more images; take the biggest PNG one (modern favicons). Anything else is passed through. */
  private fromIco(buf: Buffer): Buffer {
    if (buf.length < 6 || buf.readUInt16LE(0) !== 0 || buf.readUInt16LE(2) !== 1) return buf;
    const n = buf.readUInt16LE(4);
    let best: Buffer | null = null;
    let bestSize = 0;
    for (let i = 0; i < n; i++) {
      const e = 6 + i * 16;
      if (e + 16 > buf.length) break;
      const w = buf[e] || 256;
      const size = buf.readUInt32LE(e + 8);
      const off = buf.readUInt32LE(e + 12);
      const img = buf.subarray(off, off + size);
      if (img.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) && w > bestSize) {
        best = img;
        bestSize = w;
      }
    }
    return best || buf;
  }

  /** The first source sharp can read, trimmed to its content. */
  private async picture(pushIcon?: string): Promise<{ img: sharp.Sharp; src: string } | null> {
    for (const src of await this.sources(pushIcon)) {
      const buf = await this.fetchImage(src);
      if (!buf) continue;
      try {
        const base = sharp(buf, { density: 300 }).ensureAlpha();
        await base.metadata();
        // Trim the empty margin (transparent or white) so the shape fills the icon.
        const trimmed = await base.clone().trim({ threshold: 12 }).png().toBuffer().catch(() => null);
        return { img: sharp(trimmed || (await base.png().toBuffer())), src };
      } catch {
        /* not an image sharp knows — try the next */
      }
    }
    return null;
  }

  async render(kind: 'icon' | 'badge', pushIcon?: string): Promise<Buffer | null> {
    const key = `${kind}|${await this.version(pushIcon)}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < 10 * 60_000) return hit.png;
    const pic = await this.picture(pushIcon);
    if (!pic) return null;
    try {
      let png: Buffer;
      if (kind === 'icon') {
        const inner = await pic.img.clone().resize(150, 150, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
        png = await sharp({ create: { width: 192, height: 192, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
          .composite([{ input: inner, gravity: 'center' }])
          .png()
          .toBuffer();
      } else {
        // The shape: whatever is drawn (opaque and not white) becomes white, the rest transparent.
        const { data, info } = await pic.img.clone().resize(80, 80, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).raw().toBuffer({ resolveWithObject: true });
        const out = Buffer.alloc(info.width * info.height * 4);
        for (let i = 0, j = 0; i < data.length; i += info.channels, j += 4) {
          const [r, g, b] = [data[i]!, data[i + 1]!, data[i + 2]!];
          const a = info.channels === 4 ? data[i + 3]! : 255;
          const ink = a > 40 && (r + g + b) / 3 < 235 ? a : 0;
          out[j] = 255;
          out[j + 1] = 255;
          out[j + 2] = 255;
          out[j + 3] = ink;
        }
        const shape = await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
        png = await sharp({ create: { width: 96, height: 96, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
          .composite([{ input: shape, gravity: 'center' }])
          .png()
          .toBuffer();
      }
      this.cache.set(key, { at: Date.now(), png });
      return png;
    } catch (e: any) {
      this.logger.warn(`could not make the ${kind} from ${pic.src}: ${e?.message}`);
      return null;
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import { nanoid } from 'nanoid';

/**
 * Turns an uploaded file into the WebP derivatives the site serves.
 *
 * Two deliberate choices:
 *
 *  - **WebP, but not "compressed".** Everything is re-encoded to WebP because
 *    it is 25-35% smaller than JPEG at the same visual quality. The quality
 *    setting is high (92 by default, `near_lossless` available) specifically
 *    so photos do not visibly degrade — the saving comes from the format, not
 *    from throwing away detail.
 *  - **Readable file names.** The stored name is the slug of whatever the
 *    caller names the image (usually the property or post title), plus a short
 *    random suffix so two uploads with the same name cannot collide. Replaces
 *    the previous `randomUUID()` names, which told Google nothing.
 */

export interface ProcessedImage {
  /** Full-size WebP. */
  main: Buffer;
  /** 480px WebP thumbnail for the library grid. */
  thumb: Buffer;
  /** File stem, no extension: "5-marla-house-dha-phase-6-a1b2c3d4". */
  stem: string;
  width: number;
  height: number;
  sizeBytes: number;
  /** 16px blur-up data URL. */
  placeholder: string;
  /** Dominant colour as #rrggbb. */
  color: string;
}

sharp.cache({ memory: 64, files: 0 });
sharp.concurrency(2);

/** "5 Marla House, DHA Phase 6 (1).JPG" -> "5-marla-house-dha-phase-6-1" */
export function slugifyFileName(raw: string, fallback = 'image'): string {
  const slug = String(raw || '')
    .replace(/\.[a-z0-9]{2,5}$/i, '') // drop the extension
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
  return slug.length >= 2 ? slug : fallback;
}

/** Camera/phone default names carry no meaning — prefer the caller's context. */
const MEANINGLESS_NAME =
  /^(image|img|photo|dsc|dcim|pxl|screenshot|whatsapp|untitled|\d+)/i;

export function pickImageName(
  originalName: string,
  context?: string | null,
): string {
  const bare = String(originalName || '').replace(/\.[a-z0-9]{2,5}$/i, '');
  if (context && (!bare || MEANINGLESS_NAME.test(bare))) return context;
  return originalName || context || 'image';
}

@Injectable()
export class ImagePipelineService {
  private readonly logger = new Logger(ImagePipelineService.name);

  /** Longest edge for the stored image. Large enough for a full-bleed hero. */
  private readonly maxEdge: number;
  /** WebP quality. High on purpose — the user asked for no visible quality loss. */
  private readonly quality: number;
  private readonly thumbWidth: number;

  constructor(private readonly config: ConfigService) {
    this.maxEdge = this.int('IMAGE_MAX_EDGE', 2000, 480, 6000);
    this.quality = this.int('IMAGE_WEBP_QUALITY', 92, 60, 100);
    this.thumbWidth = this.int('IMAGE_THUMB_WIDTH', 480, 120, 1200);
  }

  private int(key: string, fallback: number, min: number, max: number): number {
    const parsed = parseInt(this.config.get<string>(key) ?? '', 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  }

  /** True for anything sharp can decode into one of our output formats. */
  static isSupportedImage(mime: string): boolean {
    return /^image\/(jpe?g|png|webp|gif|avif|tiff|heic|heif)$/i.test(mime);
  }

  /**
   * Decode -> auto-rotate from EXIF -> strip metadata (including GPS, which
   * phone photos of a property would otherwise leak) -> resize down only ->
   * WebP. Animated GIF/WebP stay animated.
   */
  async process(input: Buffer, name: string): Promise<ProcessedImage> {
    const probe = await sharp(input, {
      limitInputPixels: 80e6,
      animated: true,
    }).metadata();
    const animated = (probe.pages ?? 1) > 1;

    const source = () =>
      sharp(input, { limitInputPixels: 80e6, animated }).rotate();

    const main = await source()
      .resize({
        width: this.maxEdge,
        height: this.maxEdge,
        fit: 'inside',
        // Never upscale a small image — that only adds bytes.
        withoutEnlargement: true,
      })
      .webp({
        quality: this.quality,
        alphaQuality: 100,
        effort: 5,
        smartSubsample: true,
      })
      .toBuffer({ resolveWithObject: true });

    const thumb = await sharp(input, { limitInputPixels: 80e6 })
      .rotate()
      .resize({
        width: this.thumbWidth,
        height: this.thumbWidth,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 78, effort: 4 })
      .toBuffer();

    // A 16px blur-up stand-in, and the dominant colour for the tile background.
    let placeholder = '';
    let color = '';
    try {
      const tiny = await sharp(main.data, { animated: false })
        .resize(16, 16, { fit: 'inside' })
        .webp({ quality: 40 })
        .toBuffer();
      placeholder = `data:image/webp;base64,${tiny.toString('base64')}`;

      const { dominant } = await sharp(main.data, { animated: false }).stats();
      color = `#${[dominant.r, dominant.g, dominant.b]
        .map((n) => n.toString(16).padStart(2, '0'))
        .join('')}`;
    } catch (error) {
      // Decorative only — never fail an upload over a placeholder.
      this.logger.debug(
        `Placeholder/colour skipped: ${(error as Error).message}`,
      );
    }

    return {
      main: main.data,
      thumb,
      stem: `${slugifyFileName(name)}-${nanoid(8)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, 'x')}`,
      width: main.info.width,
      height: animated
        ? (main.info.pageHeight ?? main.info.height)
        : main.info.height,
      sizeBytes: main.data.byteLength,
      placeholder,
      color,
    };
  }

  /** `properties/2026/10` — keeps directories from growing without bound. */
  static datePrefix(date = new Date()): string {
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import sharp from 'sharp';

export interface AiImageMeta {
  alt: string;
  title: string;
  caption: string;
}

/**
 * Writes image SEO metadata (alt / title / caption) with OpenAI vision.
 *
 * Shaped for a Pakistani property and construction-materials site:
 *  - the image is downscaled to 768px and sent at "low" detail, so a call
 *    costs a fraction of a cent on gpt-4o-mini;
 *  - it never identifies people and never repeats a phone number, which
 *    property photos frequently have painted on a board;
 *  - a daily cap protects the bill;
 *  - every failure is swallowed — an upload must never fail because the AI
 *    was slow, rate-limited or switched off.
 */
@Injectable()
export class ImageAiService {
  private readonly logger = new Logger(ImageAiService.name);
  private client: OpenAI | null = null;

  private readonly enabled: boolean;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly dailyLimit: number;

  /** Resets with the calendar day. */
  private day = '';
  private usedToday = 0;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('OPENAI_API_KEY') ?? '';
    this.model = this.config.get<string>('OPENAI_MODEL') ?? 'gpt-4o-mini';
    const flag = (
      this.config.get<string>('IMAGE_AI_ENABLED') ?? 'true'
    ).toLowerCase();
    this.enabled = flag !== 'false' && !!this.apiKey;

    const limit = parseInt(
      this.config.get<string>('IMAGE_AI_DAILY_LIMIT') ?? '',
      10,
    );
    this.dailyLimit = Number.isFinite(limit) && limit > 0 ? limit : 2000;

    if (!this.enabled) {
      this.logger.warn(
        'Image AI metadata is off — set OPENAI_API_KEY to have alt text written automatically.',
      );
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /** Strip anything that should never end up in public metadata. */
  private clean(value: unknown, max: number): string {
    if (typeof value !== 'string') return '';
    return (
      value
        .replace(/\s+/g, ' ')
        .replace(/^["'\s]+|["'\s]+$/g, '')
        // Pakistani mobile numbers, which are often painted on "For Sale" boards.
        .replace(/(\+?92|0)?3\d{2}[\s-]?\d{7}/g, '')
        .replace(/\b(image|photo|picture) of\b\s*/gi, '')
        .trim()
        .slice(0, max)
    );
  }

  private budgetAvailable(): boolean {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== this.day) {
      this.day = today;
      this.usedToday = 0;
    }
    return this.usedToday < this.dailyLimit;
  }

  /** What the folder is a picture of, so the model does not have to guess. */
  private subjectFor(folder: string): string {
    const subjects: Record<string, string> = {
      properties:
        'a photo of a house, flat, plot, shop or office listed for sale or rent in Pakistan',
      blog: 'a cover image for a property or construction article',
      pages: 'an illustration on an informational page of a property website',
      rates:
        'a photo of a construction material — cement, bricks, sand, bajri (crush), steel (sarya), wood, doors or tiles',
      cities: 'a photo representing a Pakistani city',
      areas: 'a photo representing a neighbourhood, society, sector or phase',
      'tile-categories': 'a photo of a tile or flooring category',
      packages: 'a graphic for a subscription package',
      branding: "the website's own logo or brand graphic",
    };
    return subjects[folder] ?? 'an image on a Pakistani property website';
  }

  /**
   * @param webp   the stored image
   * @param ctx    folder, plus any context the caller has (property title,
   *               blog title, material + city) — this is what makes the alt
   *               text specific rather than generic.
   */
  async describe(
    webp: Buffer,
    ctx: { folder: string; hint?: string | null; name?: string | null },
  ): Promise<AiImageMeta | null> {
    if (!this.enabled || !this.budgetAvailable()) return null;
    this.usedToday += 1;

    this.client ||= new OpenAI({
      apiKey: this.apiKey,
      timeout: 20_000,
      maxRetries: 1,
    });

    let small: Buffer;
    try {
      small = await sharp(webp, { animated: false })
        .resize({
          width: 768,
          height: 768,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 82 })
        .toBuffer();
    } catch (error) {
      this.logger.debug(
        `AI skipped — could not downscale: ${(error as Error).message}`,
      );
      return null;
    }

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0.2,
        max_tokens: 250,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: [
              'You write image metadata for a Pakistani property and construction-materials website.',
              'Return strict JSON with keys alt, title, caption.',
              'alt: one natural sentence under 125 characters describing what is actually visible — room or exterior, storeys, finish, notable features (lawn, car porch, marble flooring, boundary wall), or for a material its type, brand and packaging. Use the given context for the property or product name; never invent a location or a size that is not visible.',
              'title: 3 to 8 words in Title Case.',
              'caption: one helpful sentence under 160 characters.',
              'Never identify real people. Never include phone numbers, prices, URLs, or text that looks like personal data, even if it is visible in the image.',
              'Do not begin with "Image of" or "Photo of". Write in English.',
            ].join(' '),
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text:
                  `This is ${this.subjectFor(ctx.folder)}.` +
                  (ctx.hint ? ` Context: ${ctx.hint.slice(0, 200)}.` : '') +
                  (ctx.name ? ` File name: ${ctx.name.slice(0, 80)}.` : ''),
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${small.toString('base64')}`,
                  detail: 'low',
                },
              },
            ],
          },
        ],
      });

      const parsed = JSON.parse(
        response.choices?.[0]?.message?.content || '{}',
      );
      const meta: AiImageMeta = {
        alt: this.clean(parsed.alt, 160),
        title: this.clean(parsed.title, 90),
        caption: this.clean(parsed.caption, 200),
      };
      return meta.alt ? meta : null;
    } catch (error) {
      const err = error as { status?: number; message?: string };
      this.logger.warn(
        `AI metadata failed (${err.status ?? '—'}): ${err.message ?? error}`,
      );
      return null;
    }
  }

  /**
   * A reasonable alt text without calling the model — used when the AI is off,
   * out of budget, or failed. Still better than an empty alt attribute.
   */
  fallbackMeta(ctx: {
    folder: string;
    hint?: string | null;
    name?: string | null;
  }): AiImageMeta {
    const base = (ctx.hint || ctx.name || '')
      .replace(/\.[a-z0-9]{2,5}$/i, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!base) return { alt: '', title: '', caption: '' };

    const titled = base.replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 90);
    return { alt: base.slice(0, 160), title: titled, caption: '' };
  }
}

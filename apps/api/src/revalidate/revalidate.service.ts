 import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { RedisCacheService } from '../redis-cache/redis-cache.service';

@Injectable()
export class RevalidateService {
  private readonly logger = new Logger(RevalidateService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly redisCache: RedisCacheService,
  ) {}

  async revalidate(input: { tags?: string[]; paths?: string[] }): Promise<void> {
    const tags = (input.tags ?? []).filter(Boolean);
    const paths = (input.paths ?? []).filter(Boolean);

    if (tags.length === 0 && paths.length === 0) return;

    // 1. Redis side — invalidate API-side cache
    if (tags.length > 0) {
      this.redisCache.invalidateTags(tags).catch((err) => {
        this.logger.debug(`redis invalidate fail: ${err?.message}`);
      });
    }

    // 2. Next.js ISR pages revalidate
    this.callWebHook(tags, paths).catch((err) => {
      this.logger.debug(`web revalidate fail: ${err?.message}`);
    });

    // 3. ✅ Sitemap revalidate — jab bhi koi write ho, sitemap fresh ho jaye
    this.callSitemapWebHook().catch((err) => {
      this.logger.debug(`sitemap revalidate fail: ${err?.message}`);
    });
  }

  // ── Existing ISR webhook (unchanged) ──────────────────────────────────────
  private async callWebHook(tags: string[], paths: string[]): Promise<void> {
    const webUrl =
      this.configService.get<string>('WEB_URL') ||
      this.configService.get<string>('FRONTEND_URL') ||
      this.configService.get<string>('APP_URL');
    const secret = this.configService.get<string>('REVALIDATE_SECRET');

    if (!webUrl || !secret) {
      this.logger.debug(
        'WEB_URL or REVALIDATE_SECRET missing — skipping web revalidation webhook.',
      );
      return;
    }

    const url = `${webUrl.replace(/\/$/, '')}/api/revalidate`;
    try {
      await axios.post(
        url,
        { tags, paths },
        {
          headers: {
            'content-type': 'application/json',
            'x-revalidate-secret': secret,
          },
          timeout: 4000,
        },
      );
      this.logger.debug(
        `revalidated web → tags=${tags.join(',')} paths=${paths.join(',')}`,
      );
    } catch (err: any) {
      const status = err?.response?.status;
      this.logger.debug(
        `revalidate webhook ${url} failed${status ? ` (${status})` : ''}: ${err?.message}`,
      );
    }
  }

  // ── ✅ NEW: Sitemap webhook ────────────────────────────────────────────────
  // Jab bhi koi bhi data save ho (property, blog, city, area, koi bhi rate),
  // ye function Next.js ko signal deta hai k sitemaps refresh karo.
  private async callSitemapWebHook(): Promise<void> {
    const webUrl =
      this.configService.get<string>('WEB_URL') ||
      this.configService.get<string>('FRONTEND_URL') ||
      this.configService.get<string>('APP_URL');
    const secret = this.configService.get<string>('REVALIDATE_SECRET');

    if (!webUrl || !secret) return;

    const url = `${webUrl.replace(/\/$/, '')}/api/revalidate-sitemap`;
    try {
      await axios.post(
        url,
        {},
        {
          headers: {
            'content-type': 'application/json',
            'x-revalidate-secret': secret,
          },
          timeout: 4000,
        },
      );
      this.logger.debug('sitemap revalidated successfully');
    } catch (err: any) {
      // Silent fail — sitemap update fail hone se website nahi rukti
      this.logger.debug(`sitemap webhook failed: ${err?.message}`);
    }
  }
}
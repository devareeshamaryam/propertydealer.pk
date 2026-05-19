import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { RedisCacheService } from '../redis-cache/redis-cache.service';

/**
 * RevalidateService
 * -----------------
 * Centralised place every write path calls when something changes that
 * affects public-facing pages. Two responsibilities:
 *
 *  1. **Redis cache invalidation** — drop our own server-side caches by tag
 *     so the next read recomputes from the database.
 *  2. **Next.js ISR revalidation** — POST to the Next.js webhook
 *     `/api/revalidate` so the public site forgets its cached HTML.
 *
 * Both are best-effort; they never throw and never block the caller. If the
 * webhook is misconfigured the worst case is the public site shows slightly
 * stale data for `revalidate` seconds (60 by default).
 */
@Injectable()
export class RevalidateService {
  private readonly logger = new Logger(RevalidateService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly redisCache: RedisCacheService,
  ) {}

  /**
   * Invalidate the given Redis cache tags **and** ping the Next.js
   * revalidation webhook with the same tags + any explicit paths.
   *
   * Caller can use any combination of `tags` and `paths`.
   */
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

    // 2. Next.js side — fire-and-forget webhook so the public site rebuilds
    //    affected ISR pages on demand.
    this.callWebHook(tags, paths).catch((err) => {
      this.logger.debug(`web revalidate fail: ${err?.message}`);
    });
  }

  private async callWebHook(tags: string[], paths: string[]): Promise<void> {
    const webUrl =
      this.configService.get<string>('WEB_URL') ||
      this.configService.get<string>('FRONTEND_URL') ||
      this.configService.get<string>('APP_URL');
    const secret = this.configService.get<string>('REVALIDATE_SECRET');

    if (!webUrl || !secret) {
      // Silent in production: revalidation is optional. Log once at debug
      // level so an operator can spot it during setup.
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
          // Don't block API responses on a slow web revalidation call.
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
}

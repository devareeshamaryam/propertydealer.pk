import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * RedisCacheService
 * -----------------
 * Thin, fail-soft wrapper around ioredis. Public reads should use `wrap()`
 * which performs a get-or-compute pattern; writes call `invalidate()` /
 * `invalidateTags()` to expire dependent keys.
 *
 * Design choices:
 *  - **Fail-soft**: if Redis is unreachable, every method behaves as a cache
 *    miss; we never break the request path because of caching infra.
 *  - **Tag-based invalidation**: each cached entry can declare a list of
 *    "tags" (e.g. `properties`, `cities`). `invalidateTags()` deletes every
 *    key registered against the tag using a Redis Set per tag.
 *  - **Conservative defaults**: 60s default TTL (user-requested fresh-first
 *    strategy). Short enough that even if a write skips invalidation the
 *    public site self-heals quickly.
 *  - **Namespaced keys**: every key is prefixed with `pd:` so we never
 *    collide with another app sharing the same Redis instance.
 */
@Injectable()
export class RedisCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private client: Redis | null = null;
  private connected = false;
  private readonly prefix = 'pd:';
  private readonly tagPrefix = 'pd:tag:';
  /** Default TTL in seconds. Conservative (fresh-first). */
  static readonly DEFAULT_TTL = 60;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const url = this.configService.get<string>('REDIS_URL') || 'redis://127.0.0.1:6379';
    const enabled =
      (this.configService.get<string>('REDIS_ENABLED') ?? 'true').toLowerCase() !== 'false';

    if (!enabled) {
      this.logger.warn('Redis cache disabled via REDIS_ENABLED=false; running without cache.');
      return;
    }

    try {
      this.client = new Redis(url, {
        // Don't crash if Redis is briefly unreachable; just fall through to
        // origin and try again later.
        lazyConnect: false,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        retryStrategy: (times) => Math.min(times * 200, 2000),
      });

      this.client.on('connect', () => {
        this.connected = true;
        this.logger.log(`✅ Redis connected (${url})`);
      });
      this.client.on('error', (err) => {
        this.connected = false;
        // Avoid log spam: log once per connection failure cycle.
        this.logger.warn(`Redis error (cache will fail-soft): ${err.message}`);
      });
      this.client.on('end', () => {
        this.connected = false;
      });
    } catch (err: any) {
      this.logger.error(`Failed to initialize Redis client: ${err?.message}`);
      this.client = null;
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        /* noop */
      }
    }
  }

  isHealthy(): boolean {
    return !!this.client && this.connected;
  }

  /** Build a deterministic, namespaced key. Object args are JSON-stringified. */
  buildKey(scope: string, parts: Array<string | number | undefined | null | object>): string {
    const tail = parts
      .map((p) => {
        if (p === undefined || p === null) return '_';
        if (typeof p === 'object') return JSON.stringify(p);
        return String(p);
      })
      .join(':');
    return `${this.prefix}${scope}:${tail}`;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client) return null;
    try {
      const raw = await this.client.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (err: any) {
      this.logger.debug(`cache get miss (${key}): ${err?.message}`);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds = RedisCacheService.DEFAULT_TTL, tags: string[] = []): Promise<void> {
    if (!this.client) return;
    try {
      const payload = JSON.stringify(value);
      // Use a single round-trip pipeline. SET with EX + SADD per tag.
      const pipeline = this.client.pipeline();
      pipeline.set(key, payload, 'EX', ttlSeconds);
      for (const tag of tags) {
        pipeline.sadd(`${this.tagPrefix}${tag}`, key);
        // Slightly longer TTL on the tag set so the tag survives at least one
        // refresh cycle.
        pipeline.expire(`${this.tagPrefix}${tag}`, Math.max(ttlSeconds * 2, 300));
      }
      await pipeline.exec();
    } catch (err: any) {
      this.logger.debug(`cache set fail (${key}): ${err?.message}`);
    }
  }

  /**
   * Get-or-compute. The compute function is only invoked on a miss / Redis
   * outage. Result is cached with the supplied TTL and tags.
   */
  async wrap<T>(
    key: string,
    compute: () => Promise<T>,
    options: { ttl?: number; tags?: string[] } = {},
  ): Promise<T> {
    const ttl = options.ttl ?? RedisCacheService.DEFAULT_TTL;
    const tags = options.tags ?? [];

    const cached = await this.get<T>(key);
    if (cached !== null && cached !== undefined) {
      return cached;
    }

    const value = await compute();
    // Don't cache empty / null results — usually indicates a transient miss
    // we don't want to hold onto.
    if (value !== undefined && value !== null) {
      // Fire-and-forget; we never block the caller on the cache write.
      this.set(key, value, ttl, tags).catch(() => {});
    }
    return value;
  }

  async del(...keys: string[]): Promise<void> {
    if (!this.client || keys.length === 0) return;
    try {
      await this.client.del(...keys);
    } catch (err: any) {
      this.logger.debug(`cache del fail: ${err?.message}`);
    }
  }

  /**
   * Invalidate every cached value associated with the given tags. Safe to
   * call from any write path (`property.create`, `cement-rate.update`, ...).
   */
  async invalidateTags(tags: string[]): Promise<void> {
    if (!this.client || tags.length === 0) return;
    try {
      for (const tag of tags) {
        const tagKey = `${this.tagPrefix}${tag}`;
        const members = await this.client.smembers(tagKey);
        if (members.length > 0) {
          await this.client.del(...members);
        }
        await this.client.del(tagKey);
      }
      this.logger.debug(`Invalidated tags: ${tags.join(', ')}`);
    } catch (err: any) {
      this.logger.debug(`invalidateTags fail: ${err?.message}`);
    }
  }
}

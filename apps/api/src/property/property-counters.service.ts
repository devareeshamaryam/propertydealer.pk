import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Property } from '@rent-ghar/db/schemas/property.schema';
import { RedisCacheService } from '../redis-cache/redis-cache.service';

type CounterField = 'views' | 'impressions' | 'phoneClicks' | 'whatsappClicks';

/**
 * Write-behind counters for listing performance.
 *
 * Every card scrolled past is an impression and every listing opened is a view,
 * so writing each event straight away would mean one database write per card
 * per visitor — the popular listings become write hot-spots and the database
 * spends its time on counters instead of serving pages.
 *
 * Events are summed in memory instead and written every few seconds as a
 * single bulkWrite with one $inc per listing, however many people looked in
 * between. The trade-off is explicit: a crash loses at most FLUSH_MS of counts.
 * These are "how is my listing doing" numbers, not money.
 *
 * Deliberately does NOT invalidate the property caches. A view count is not
 * worth busting a cached page over, and at this write rate it would mean the
 * public pages were never cached at all.
 */
@Injectable()
export class PropertyCountersService implements OnModuleDestroy {
  private readonly logger = new Logger(PropertyCountersService.name);

  private static readonly FLUSH_MS = Number(process.env.COUNTER_FLUSH_MS || 3000);
  /** Flush early once this many listings are pending, to bound memory. */
  private static readonly MAX_PENDING = 2000;

  /** listingId → { field → count } */
  private pending = new Map<string, Partial<Record<CounterField, number>>>();
  private timer: NodeJS.Timeout | null = null;
  private flushing: Promise<void> | null = null;

  /**
   * Abuse ceiling, not de-duplication.
   *
   * The browser already counts one view per listing per session. Collapsing
   * further by IP would be wrong here: most Pakistani mobile traffic shares a
   * handful of carrier addresses, so one view per IP would quietly throw away
   * most real visitors. This only stops a script hammering one listing — well
   * above anything a person does, well below anything that distorts the count.
   */
  private static readonly ABUSE_WINDOW_SECONDS = 600;
  private static readonly ABUSE_MAX_PER_WINDOW = 12;

  constructor(
    @InjectModel(Property.name) private readonly propertyModel: Model<Property>,
    private readonly cache: RedisCacheService,
  ) {}

  /**
   * One detail-page open. The browser de-duplicates per visitor session; this
   * drops the rest only when one address is clearly looping.
   */
  async countView(id: string, fingerprint?: string) {
    if (await this.isFlooding('view', id, fingerprint)) return;
    this.add(id, 'views');
  }

  /**
   * Counts how often one address has reported the same event recently, and
   * says whether this one is beyond the ceiling.
   *
   * Without Redis it always allows: a missing cache must not silently switch
   * analytics off.
   */
  private async isFlooding(
    kind: string,
    id: string,
    fingerprint?: string,
  ): Promise<boolean> {
    if (!fingerprint || !this.cache.isHealthy()) return false;

    try {
      const key = this.cache.buildKey(`analytics:${kind}`, [id, fingerprint]);
      const seen = (await this.cache.get<number>(key)) ?? 0;

      if (seen >= PropertyCountersService.ABUSE_MAX_PER_WINDOW) return true;

      // Not atomic, and does not need to be: two requests racing to write the
      // same number costs one extra count, which is noise at this scale.
      await this.cache.set(
        key,
        seen + 1,
        PropertyCountersService.ABUSE_WINDOW_SECONDS,
      );
      return false;
    } catch {
      return false;
    }
  }

  /** A batch of cards that came into view in a feed. */
  countImpressions(ids: string[]) {
    for (const id of ids) this.add(id, 'impressions');
  }

  /** A tap on Call or WhatsApp — the strongest signal a listing produces. */
  async countContact(id: string, kind: 'phone' | 'whatsapp', fingerprint?: string) {
    if (await this.isFlooding('contact', id, fingerprint)) return;
    this.add(id, kind === 'phone' ? 'phoneClicks' : 'whatsappClicks');
  }

  private add(id: string, field: CounterField, by = 1) {
    if (!Types.ObjectId.isValid(id)) return;

    const row = this.pending.get(id) ?? {};
    row[field] = (row[field] ?? 0) + by;
    this.pending.set(id, row);

    if (this.pending.size >= PropertyCountersService.MAX_PENDING) {
      void this.flush();
      return;
    }

    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.timer = null;
        void this.flush();
      }, PropertyCountersService.FLUSH_MS);
      // Never hold the process open just for a counter flush.
      this.timer.unref?.();
    }
  }

  /** Write everything pending now. Also used on shutdown. */
  async flush(): Promise<void> {
    if (this.flushing) await this.flushing;
    if (this.pending.size === 0) return;

    const batch = this.pending;
    this.pending = new Map();

    this.flushing = (async () => {
      const operations = [...batch.entries()].map(([id, increments]) => ({
        updateOne: {
          filter: { _id: new Types.ObjectId(id) },
          update: { $inc: increments },
        },
      }));

      try {
        await this.propertyModel.bulkWrite(operations, { ordered: false });
      } catch (error) {
        // Counters are loss-tolerant: log and move on rather than retrying
        // into a growing backlog.
        this.logger.warn(
          `Could not flush ${operations.length} listing counters: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    })().finally(() => {
      this.flushing = null;
    });

    await this.flushing;
  }

  /** Don't lose the last few seconds on a deploy. */
  async onModuleDestroy() {
    if (this.timer) clearTimeout(this.timer);
    await this.flush();
  }
}

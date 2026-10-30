import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createHash, randomBytes } from 'crypto';
import * as webpush from 'web-push';
import {
  PushCampaign, PushCampaignDocument, PushSetting, PushSettingDocument, PushStat, PushStatDocument, PushSubscriber, PushSubscriberDocument,
} from '@rent-ghar/db/schemas/push.schema';
import { SiteSettingsService } from '../site-settings/site-settings.service';
import { dayKey, mergePushConfig, type PushConfig } from './push.config';
import { PushIconService } from './push-icon.service';

/**
 * The machinery every push goes through:
 *   - settings (one document, cached 30 s across the process);
 *   - VAPID keys — from VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY, or made once on
 *     first start and kept in the settings document, so push works with no
 *     setup at all (and the keys never change: changing them would cut off
 *     every subscriber);
 *   - encrypting a message for one browser and handing it to that browser's
 *     push service (Google, Mozilla, Apple, Microsoft — no third-party SDK);
 *   - what the push service answers: 404/410 expired, 400/403/413 invalid
 *     (both retired so they are not retried on every campaign), 429/5xx
 *     retried with backoff and Retry-After;
 *   - engagement counters, summed in memory and written every few seconds.
 */

export interface PushMessage {
  title: string;
  body: string;
  url: string;
  icon?: string | null;
  badge?: string | null;
  image?: string | null;
  tag?: string | null;
  renotify?: boolean;
  requireInteraction?: boolean;
  actions?: { title: string; url: string }[];
  /** Notification type ("listing_live", "campaign"…), reported back by the service worker. */
  type: string;
  campaignId?: string | null;
  id: string;
}

export interface SendOptions {
  ttlSec?: number;
  urgency?: 'very-low' | 'low' | 'normal' | 'high';
  topic?: string | null;
}
export interface Target { endpoint: string; keys: { p256dh: string; auth: string } }
type Outcome = 'sent' | 'expired' | 'invalid' | 'failed';
export type StatField = 'sent' | 'failed' | 'delivered' | 'clicked' | 'closed' | 'subscribed' | 'unsubscribed';
type Inc = Partial<Record<StatField, number>>;

export const newPushId = () => randomBytes(6).toString('base64url');
/** Push-service collapse key: one pending push per topic per device. */
export const topicOf = (tag: string) => createHash('sha256').update(tag).digest('base64url').slice(0, 32);

const clip = (s: string | null | undefined, n: number) => {
  const t = String(s || '').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

@Injectable()
export class PushCoreService implements OnModuleDestroy {
  private readonly logger = new Logger('Push');
  private cache: { at: number; cfg: PushConfig; siteName: string; icon: string; badge: string } | null = null;
  private vapid: { publicKey: string; privateKey: string; subject: string } | null = null;
  private vapidLoading: Promise<void> | null = null;

  private daily = new Map<string, Inc>();
  private campaigns = new Map<string, Inc>();
  private clicks = new Map<string, number>();
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(
    @InjectModel(PushSetting.name) private readonly settings: Model<PushSettingDocument>,
    @InjectModel(PushSubscriber.name) readonly subscribers: Model<PushSubscriberDocument>,
    @InjectModel(PushStat.name) private readonly stats: Model<PushStatDocument>,
    @InjectModel(PushCampaign.name) private readonly campaignModel: Model<PushCampaignDocument>,
    private readonly site: SiteSettingsService,
    private readonly icons: PushIconService,
  ) {}

  /* ── settings ── */

  async load() {
    if (this.cache && Date.now() - this.cache.at < 30_000) return this.cache;
    const [doc, site] = await Promise.all([
      this.settings.findOne({ key: 'push' }).lean().exec() as Promise<any>,
      this.site.get().catch(() => ({}) as any),
    ]);
    const cfg = mergePushConfig(doc?.config);
    // Made from the site's own icon (push icon setting → favicon → logo → the built-in ones), see PushIconService.
    // The version changes with the source, so browsers pick up a new favicon at once.
    const v = await this.icons.version(cfg.icon);
    const loaded = {
      at: Date.now(),
      cfg,
      siteName: String(site?.siteName || 'Property Dealer'),
      icon: `/api/push/icon.png?v=${v}`,
      badge: cfg.badge || `/api/push/badge.png?v=${v}`,
    };
    this.cache = loaded;
    return loaded;
  }

  async config(): Promise<PushConfig> {
    return (await this.load()).cfg;
  }

  async saveConfig(next: unknown): Promise<PushConfig> {
    const cfg = mergePushConfig(next);
    await this.settings.updateOne({ key: 'push' }, { $set: { config: cfg } }, { upsert: true }).exec();
    this.cache = null;
    return cfg;
  }

  today(cfg: PushConfig) {
    return dayKey(cfg.timezone);
  }

  /* ── VAPID ── */

  private async ensureVapid(): Promise<boolean> {
    if (this.vapid) return true;
    this.vapidLoading ??= (async () => {
      let publicKey = process.env.VAPID_PUBLIC_KEY || '';
      let privateKey = process.env.VAPID_PRIVATE_KEY || '';
      if (!publicKey || !privateKey) {
        const doc: any = await this.settings.findOne({ key: 'push' }).select('+vapidPrivateKey vapidPublicKey').lean().exec();
        if (doc?.vapidPublicKey && doc?.vapidPrivateKey) {
          publicKey = doc.vapidPublicKey;
          privateKey = doc.vapidPrivateKey;
        } else {
          const k = webpush.generateVAPIDKeys();
          // Only if nobody else saved keys first (several API processes may start together).
          await this.settings
            .updateOne({ key: 'push', vapidPublicKey: { $in: [null] } }, { $set: { vapidPublicKey: k.publicKey, vapidPrivateKey: k.privateKey } }, { upsert: true })
            .exec()
            .catch(() => undefined);
          const saved: any = await this.settings.findOne({ key: 'push' }).select('+vapidPrivateKey vapidPublicKey').lean().exec();
          publicKey = saved?.vapidPublicKey || k.publicKey;
          privateKey = saved?.vapidPrivateKey || k.privateKey;
          this.logger.log('Made the site push keys (kept in pushsettings — do not delete them)');
        }
      }
      const host = process.env.APP_HOST || 'propertydealer.pk';
      const subject = process.env.VAPID_SUBJECT || `mailto:info@${host}`;
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.vapid = { publicKey, privateKey, subject };
    })().finally(() => {
      this.vapidLoading = null;
    });
    await this.vapidLoading;
    return !!this.vapid;
  }

  async publicKey(): Promise<string | null> {
    try {
      return (await this.ensureVapid()) ? this.vapid!.publicKey : null;
    } catch (e: any) {
      this.logger.error(`Push keys unavailable: ${e?.message}`);
      return null;
    }
  }

  /* ── sending ── */

  /** The JSON the service worker gets (well under the 4 KB push limit). */
  payloadOf(m: PushMessage): string {
    return JSON.stringify({
      title: clip(m.title, 90),
      body: clip(m.body, 220),
      url: m.url || '/',
      icon: m.icon || undefined,
      badge: m.badge || undefined,
      image: m.image || undefined,
      tag: m.tag || undefined,
      renotify: m.renotify || undefined,
      requireInteraction: m.requireInteraction || undefined,
      actions: (m.actions || []).slice(0, 2).map((a, i) => ({ action: `a${i}`, title: clip(a.title, 24), url: a.url })),
      t: m.type,
      c: m.campaignId || undefined,
      id: m.id,
    });
  }

  private async sendOne(sub: Target, payload: string, o: SendOptions): Promise<Outcome> {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload, {
          TTL: o.ttlSec ?? 86_400,
          urgency: o.urgency ?? 'normal',
          ...(o.topic ? { topic: o.topic } : {}),
          timeout: 10_000,
        });
        return 'sent';
      } catch (e: any) {
        const status: number | undefined = e?.statusCode;
        if (status === 404 || status === 410) return 'expired';
        if (status === 400 || status === 403 || status === 413) return 'invalid';
        if (attempt === 3) return 'failed';
        const retryAfter = Number(e?.headers?.['retry-after']);
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 10_000) : 400 * 2 ** (attempt - 1) + Math.random() * 200);
      }
    }
    return 'failed';
  }

  /** Many devices with limited concurrency; outcomes written in one bulk write. */
  async sendBatch(subs: Target[], message: PushMessage, o: SendOptions = {}, concurrency = 40) {
    if (!subs.length) return { sent: 0, failed: 0, removed: 0 };
    if (!(await this.ensureVapid().catch(() => false))) return { sent: 0, failed: subs.length, removed: 0 };
    const payload = this.payloadOf(message);
    const results: { s: Target; outcome: Outcome }[] = [];
    let next = 0;
    const worker = async () => {
      while (next < subs.length) {
        const s = subs[next++]!;
        results.push({ s, outcome: await this.sendOne(s, payload, o) });
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, subs.length) }, worker));

    const now = new Date();
    const ops: any[] = [];
    let sent = 0;
    let failed = 0;
    let removed = 0;
    for (const { s, outcome } of results) {
      if (outcome === 'sent') {
        sent++;
        ops.push({ updateOne: { filter: { endpoint: s.endpoint }, update: { $inc: { sentCount: 1 }, $set: { lastSentAt: now, failCount: 0 } } } });
      } else if (outcome === 'expired' || outcome === 'invalid') {
        removed++;
        ops.push({ updateOne: { filter: { endpoint: s.endpoint, status: 'active' }, update: { $set: { status: outcome, endedAt: now } } } });
      } else {
        failed++;
        ops.push({ updateOne: { filter: { endpoint: s.endpoint }, update: { $inc: { failCount: 1 } } } });
      }
    }
    if (ops.length) await this.subscribers.bulkWrite(ops, { ordered: false }).catch((e) => this.logger.warn(`outcome write failed: ${e?.message}`));
    return { sent, failed, removed };
  }

  /* ── counters ── */

  private add(m: Map<string, Inc>, k: string, inc: Inc) {
    const cur = m.get(k) || {};
    for (const [f, n] of Object.entries(inc) as [StatField, number][]) cur[f] = (cur[f] || 0) + n;
    m.set(k, cur);
    this.schedule();
  }

  private schedule() {
    this.flushTimer ??= setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, 3000);
  }

  bump(type: string, inc: Inc) {
    const tz = this.cache?.cfg.timezone || 'Asia/Karachi';
    this.add(this.daily, `${dayKey(tz)}|${type}`, inc);
  }

  bumpCampaign(id: string, inc: Inc) {
    this.add(this.campaigns, id, inc);
  }

  bumpClick(endpoint: string) {
    this.clicks.set(endpoint, (this.clicks.get(endpoint) || 0) + 1);
    this.schedule();
  }

  async flush() {
    const daily = this.daily;
    const campaigns = this.campaigns;
    const clicks = this.clicks;
    this.daily = new Map();
    this.campaigns = new Map();
    this.clicks = new Map();
    const prefixed = (inc: Inc, p = '') => Object.fromEntries(Object.entries(inc).map(([k, v]) => [p + k, v]));
    try {
      const now = new Date();
      await Promise.all([
        daily.size &&
          this.stats.bulkWrite(
            [...daily].map(([k, inc]) => {
              const [day, type] = k.split('|');
              return { updateOne: { filter: { day, type }, update: { $inc: prefixed(inc) }, upsert: true } };
            }) as any,
            { ordered: false },
          ),
        campaigns.size &&
          this.campaignModel.bulkWrite([...campaigns].map(([id, inc]) => ({ updateOne: { filter: { _id: id }, update: { $inc: prefixed(inc, 'stats.') } } })) as any, { ordered: false }),
        clicks.size &&
          this.subscribers.bulkWrite([...clicks].map(([endpoint, n]) => ({ updateOne: { filter: { endpoint }, update: { $inc: { clickCount: n }, $set: { lastClickAt: now } } } })) as any, { ordered: false }),
      ]);
    } catch (e: any) {
      this.logger.warn(`stats flush failed: ${e?.message}`);
    }
  }

  async onModuleDestroy() {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    await this.flush();
  }

  /* ── "only once" ── */

  /** True the first time `key` is claimed within `hours` (works across processes). */
  async once(key: string, hours: number): Promise<boolean> {
    const coll = this.settings.db.collection<{ _id: string; exp: Date }>('push_once');
    if (!(this as any).__onceIndexed) {
      (this as any).__onceIndexed = true;
      coll.createIndex({ exp: 1 }, { expireAfterSeconds: 0 }).catch(() => ((this as any).__onceIndexed = false));
    }
    const exp = new Date(Date.now() + hours * 3_600_000);
    try {
      await coll.insertOne({ _id: key, exp });
      return true;
    } catch (e: any) {
      if (e?.code !== 11000) throw e;
      const r = await coll.updateOne({ _id: key, exp: { $lt: new Date() } }, { $set: { exp } });
      return r.modifiedCount === 1;
    }
  }
}

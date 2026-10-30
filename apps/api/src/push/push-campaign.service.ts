import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PushCampaign, PushCampaignDocument, type PushAudience } from '@rent-ghar/db/schemas/push.schema';
import { PushCoreService, type PushMessage } from './push-core.service';
import { renderTemplate } from './push.config';

const BATCH = 500;
const WHO = new Set(['all', 'users', 'guests', 'agents', 'paid', 'free', 'buyers', 'admins', 'specific']);
const URGENCY = new Set(['very-low', 'low', 'normal', 'high']);
const str = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
const strs = (v: unknown, max = 200) => (Array.isArray(v) ? v.map((x) => str(x, 80)).filter(Boolean).slice(0, max) : []);
const oids = (a?: string[]) => (a || []).filter((x) => Types.ObjectId.isValid(x)).map((x) => new Types.ObjectId(x));

/** A site path ("/packages") or an http(s) address; anything else is refused. */
export function cleanUrl(v: unknown, fallback = '/'): string | null {
  const s = str(v, 500);
  if (!s) return fallback;
  if (s.startsWith('/') && !s.startsWith('//')) return s;
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Manual campaigns: audience → database filter, audience size, and the
 * background sender. The sender walks the matching devices in _id order, 500
 * at a time, saving its place and a heartbeat after every batch — if the
 * process stops mid-send, the next tick (in any process) continues from
 * there: nobody gets it twice, nobody is skipped. Stopping takes effect at
 * the next batch.
 */
@Injectable()
export class PushCampaignService {
  private readonly logger = new Logger('Push');
  private readonly workerId = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

  constructor(
    private readonly core: PushCoreService,
    @InjectModel(PushCampaign.name) readonly campaigns: Model<PushCampaignDocument>,
  ) {}

  cleanAudience(a: any): PushAudience {
    return {
      who: WHO.has(a?.who) ? a.who : 'all',
      cityIds: strs(a?.cityIds),
      areaIds: strs(a?.areaIds),
      purpose: a?.purpose === 'rent' || a?.purpose === 'sale' ? a.purpose : '',
      devices: strs(a?.devices, 5),
      browsers: strs(a?.browsers, 10),
      os: strs(a?.os, 10),
      userIds: strs(a?.userIds, 1000),
      activeWithinDays: Math.max(0, Math.min(365, Number(a?.activeWithinDays) || 0)),
    };
  }

  /** What the composer sends, checked, so a saved campaign is always sendable. */
  clean(b: any): { data?: Record<string, unknown>; error?: string } {
    const title = str(b?.title, 120);
    if (!title) return { error: 'Add a title' };
    const url = cleanUrl(b?.url);
    if (!url) return { error: 'The link must be a page of this site (/...) or an https:// address' };
    const actions: { title: string; url: string }[] = [];
    for (const a of Array.isArray(b?.actions) ? b.actions.slice(0, 2) : []) {
      const t = str(a?.title, 24);
      const u = cleanUrl(a?.url, '');
      if (t && u) actions.push({ title: t, url: u });
    }
    const audience = this.cleanAudience(b?.audience);
    if (audience.who === 'specific' && !audience.userIds?.length) return { error: 'Pick at least one person' };
    return {
      data: {
        name: str(b?.name, 80) || title,
        title,
        body: str(b?.body, 400),
        url,
        icon: cleanUrl(b?.icon, '') || null,
        image: cleanUrl(b?.image, '') || null,
        actions,
        requireInteraction: !!b?.requireInteraction,
        ttlHours: Math.max(1, Math.min(672, Number(b?.ttlHours) || 24)),
        urgency: URGENCY.has(b?.urgency) ? b.urgency : 'normal',
        audience,
      },
    };
  }

  /** Devices an audience reaches: active ones only, never people who switched off "News & offers". */
  filter(a: PushAudience): Record<string, any> {
    const f: Record<string, any> = { status: 'active', promoOff: { $ne: true } };
    switch (a?.who) {
      case 'users': f.userId = { $ne: null }; break;
      case 'guests': f.userId = null; break;
      case 'agents': f.userId = { $ne: null }; f.role = 'AGENT'; break;
      case 'paid': f.userId = { $ne: null }; f.paid = true; break;
      case 'free': f.userId = { $ne: null }; f.role = 'AGENT'; f.paid = { $ne: true }; break;
      case 'buyers': f.userId = { $ne: null }; f.role = 'USER'; break;
      case 'admins': f.role = 'ADMIN'; break;
      case 'specific': f.userId = { $in: oids(a.userIds) }; break;
    }
    if (a?.cityIds?.length) f.cityId = { $in: oids(a.cityIds) };
    if (a?.areaIds?.length || a?.purpose) {
      f.interests = { $elemMatch: { ...(a.areaIds?.length ? { areaId: { $in: oids(a.areaIds) } } : {}), ...(a.purpose ? { purpose: a.purpose } : {}) } };
    }
    if (a?.devices?.length) f.device = { $in: a.devices };
    if (a?.browsers?.length) f.browser = { $in: a.browsers };
    if (a?.os?.length) f.os = { $in: a.os };
    if (a?.activeWithinDays && a.activeWithinDays > 0) f.lastSeenAt = { $gte: new Date(Date.now() - a.activeWithinDays * 86_400_000) };
    return f;
  }

  estimate(a: PushAudience) {
    return this.core.subscribers.countDocuments(this.filter(this.cleanAudience(a))).maxTimeMS(10_000).exec();
  }

  async message(c: any): Promise<PushMessage> {
    const { siteName, icon, badge } = await this.core.load();
    return {
      title: renderTemplate(c.title, {}, siteName),
      body: renderTemplate(c.body, {}, siteName),
      url: c.url || '/',
      icon: c.icon || icon,
      badge,
      image: c.image || null,
      actions: c.actions || [],
      requireInteraction: !!c.requireInteraction,
      tag: `campaign:${c._id}`,
      type: 'campaign',
      campaignId: String(c._id),
      id: `c${c._id}`,
    };
  }

  /** "Test on me": only this admin's own devices, not counted. */
  async test(c: any, userId: string) {
    const subs = await this.core.subscribers.find({ userId: new Types.ObjectId(userId), status: 'active' }).select('endpoint keys').lean().exec();
    if (!subs.length) return { sent: 0, devices: 0 };
    const m = await this.message({ ...c, _id: c._id || 'test' });
    const r = await this.core.sendBatch(subs as any, { ...m, type: 'test', campaignId: null, id: `t${Date.now()}` }, { urgency: 'high', ttlSec: 3600 });
    return { sent: r.sent, devices: subs.length };
  }

  /** Claim one due campaign (or one whose sender went quiet) and send it to the end. */
  async runNext(): Promise<boolean> {
    const now = new Date();
    const c: any = await this.campaigns
      .findOneAndUpdate(
        {
          $or: [
            { status: 'scheduled', sendAt: { $lte: now } },
            { status: 'sending', heartbeatAt: { $lt: new Date(now.getTime() - 180_000) } },
          ],
        },
        [{ $set: { status: 'sending', lockedBy: this.workerId, heartbeatAt: now, startedAt: { $ifNull: ['$startedAt', now] } } }] as any,
        { sort: { sendAt: 1 }, new: true },
      )
      .lean()
      .exec();
    if (!c) return false;

    try {
      const base = this.filter(c.audience || { who: 'all' });
      if (!c.cursor) {
        const targeted = await this.core.subscribers.countDocuments(base);
        await this.campaigns.updateOne({ _id: c._id }, { $set: { 'stats.targeted': targeted } });
      }
      const message = await this.message(c);
      const opts = { ttlSec: Math.max(1, c.ttlHours || 24) * 3600, urgency: c.urgency || 'normal' } as const;
      let cursor = c.cursor as Types.ObjectId | null;
      for (;;) {
        const live: any = await this.campaigns.findById(c._id).select('status lockedBy').lean().exec();
        if (!live || live.status !== 'sending' || live.lockedBy !== this.workerId) return true;
        const batch = await this.core.subscribers
          .find(cursor ? { ...base, _id: { $gt: cursor } } : base)
          .sort({ _id: 1 })
          .limit(BATCH)
          .select('endpoint keys')
          .lean()
          .exec();
        if (!batch.length) break;
        const r = await this.core.sendBatch(batch as any, message, opts, 80);
        cursor = batch[batch.length - 1]!._id as Types.ObjectId;
        await this.campaigns.updateOne(
          { _id: c._id, lockedBy: this.workerId },
          { $inc: { 'stats.sent': r.sent, 'stats.failed': r.failed, 'stats.removed': r.removed }, $set: { cursor, heartbeatAt: new Date() } },
        );
        this.core.bump('campaign', { sent: r.sent, failed: r.failed + r.removed });
        await new Promise((res) => setImmediate(res));
      }
      await this.campaigns.updateOne({ _id: c._id, lockedBy: this.workerId }, { $set: { status: 'sent', finishedAt: new Date(), lockedBy: null } });
    } catch (e: any) {
      this.logger.error(`campaign failed: ${e?.message}`);
      await this.campaigns.updateOne({ _id: c._id, lockedBy: this.workerId }, { $set: { status: 'failed', error: String(e?.message || e).slice(0, 300), lockedBy: null } });
    }
    return true;
  }
}

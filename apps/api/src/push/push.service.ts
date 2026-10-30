import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PushJob, PushJobDocument } from '@rent-ghar/db/schemas/push.schema';
import { User } from '@rent-ghar/db/schemas/user.schema';
import { AUTO_TYPES, quietUntil, renderTemplate } from './push.config';
import { newPushId, PushCoreService, topicOf, type PushMessage } from './push-core.service';

export interface AutoPush {
  type: keyof typeof AUTO_TYPES | string;
  vars?: Record<string, unknown>;
  /** Where a tap opens (site-relative). */
  url: string;
  image?: string | null;
  /** The small picture beside the text (e.g. the listing photo); default = the site icon. */
  icon?: string | null;
  /** Same tag = the new notification replaces the previous one. */
  tag?: string | null;
  renotify?: boolean;
}

/**
 * Automatic pushes to people. For every send:
 *   - the type must be on (Dashboard → Push notifications → Automatic);
 *   - the person must not have switched its group off;
 *   - unless the type "sends straight away", it waits out quiet hours (held
 *     and sent in the morning, spread over 20 minutes) and counts towards a
 *     daily limit per person, so notifications stay welcome;
 *   - the words come from the admin's templates.
 * Callers use `later()`: it never waits and never throws.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger('Push');

  constructor(
    private readonly core: PushCoreService,
    @InjectModel(PushJob.name) private readonly jobs: Model<PushJobDocument>,
    @InjectModel(User.name) private readonly users: Model<any>,
  ) {}

  private oids(ids: unknown[]): Types.ObjectId[] {
    return [...new Set(ids.map((v) => String(v ?? '')).filter((v) => Types.ObjectId.isValid(v)))].map((v) => new Types.ObjectId(v));
  }

  /** `held`: sent from the queue after quiet hours (skip that check). */
  async toUsers(userIds: unknown[], p: AutoPush, held = false): Promise<{ sent: number; held: number }> {
    const def = AUTO_TYPES[p.type];
    const ids = this.oids(userIds);
    if (!def || !ids.length) return { sent: 0, held: 0 };
    const { cfg, siteName, icon, badge } = await this.core.load();
    if (!cfg.enabled || !cfg.auto[p.type]?.enabled) return { sent: 0, held: 0 };

    // People with a device who have not switched this group off.
    const withDevice = await this.core.subscribers.distinct('userId', { userId: { $in: ids }, status: 'active' });
    if (!withDevice.length) return { sent: 0, held: 0 };
    let people: Types.ObjectId[] = (
      await this.users.find({ _id: { $in: withDevice }, isActive: { $ne: false }, pushOff: { $ne: def.category } }).select('_id').lean().exec()
    ).map((u: any) => u._id);
    if (!people.length) return { sent: 0, held: 0 };

    const immediate = cfg.auto[p.type]?.immediate ?? def.immediate;
    if (!immediate) {
      const until = held ? null : quietUntil(cfg);
      if (until) {
        const sendAt = new Date(until.getTime() + Math.floor(Math.random() * 20 * 60_000));
        await this.jobs
          .insertMany(people.map((userId) => ({ userId, type: p.type, vars: p.vars || {}, url: p.url, image: p.image || null, icon: p.icon || null, tag: p.tag || null, sendAt })), { ordered: false })
          .catch(() => undefined);
        return { sent: 0, held: people.length };
      }
      // Daily limit: two bulk queries however many people (a price drop can reach thousands).
      const day = this.core.today(cfg);
      people = (
        await this.users.find({ _id: { $in: people }, $or: [{ pushDay: { $ne: day } }, { pushDayCount: { $lt: cfg.dailyCap } }] }).select('_id').lean().exec()
      ).map((u: any) => u._id);
      if (!people.length) return { sent: 0, held: 0 };
      await this.users
        .updateMany({ _id: { $in: people } }, [
          { $set: { pushDayCount: { $cond: [{ $eq: ['$pushDay', day] }, { $add: [{ $ifNull: ['$pushDayCount', 0] }, 1] }, 1] }, pushDay: day } },
        ] as any)
        .exec();
    }

    const subs = await this.core.subscribers.find({ userId: { $in: people }, status: 'active' }).select('endpoint keys').lean().exec();
    const tpl = cfg.auto[p.type]!;
    const vars = p.vars || {};
    const message: PushMessage = {
      title: renderTemplate(tpl.title, vars, siteName) || siteName,
      body: renderTemplate(tpl.body, vars, siteName),
      url: p.url,
      icon: p.icon || icon,
      badge,
      image: p.image || null,
      tag: p.tag || null,
      renotify: p.renotify,
      type: p.type,
      id: newPushId(),
    };
    const r = await this.core.sendBatch(subs as any, message, {
      urgency: immediate ? 'high' : 'normal',
      ttlSec: immediate ? 86_400 : 3 * 86_400,
      topic: p.tag ? topicOf(p.tag) : null,
    });
    this.core.bump(p.type, { sent: r.sent, failed: r.failed + r.removed });
    return { sent: r.sent, held: 0 };
  }

  /**
   * Straight to devices (not people): "new in your area" and price drops,
   * which also reach guests. The caller has already applied its own limits.
   */
  async toDevices(subs: { endpoint: string; keys: any }[], p: AutoPush) {
    const def = AUTO_TYPES[p.type];
    if (!def || !subs.length) return { sent: 0 };
    const { cfg, siteName, icon, badge } = await this.core.load();
    if (!cfg.enabled || !cfg.auto[p.type]?.enabled) return { sent: 0 };
    const tpl = cfg.auto[p.type]!;
    const vars = p.vars || {};
    const r = await this.core.sendBatch(
      subs as any,
      {
        title: renderTemplate(tpl.title, vars, siteName) || siteName,
        body: renderTemplate(tpl.body, vars, siteName),
        url: p.url,
        icon: p.icon || icon,
        badge,
        image: p.image || null,
        tag: p.tag || null,
        type: p.type,
        id: newPushId(),
      },
      { urgency: 'normal', ttlSec: 2 * 86_400, topic: p.tag ? topicOf(p.tag) : null },
    );
    this.core.bump(p.type, { sent: r.sent, failed: r.failed + r.removed });
    return { sent: r.sent };
  }

  /** Fire and forget: never blocks the caller, never throws. */
  later(userIds: unknown | unknown[], p: AutoPush): void {
    const ids = Array.isArray(userIds) ? userIds : [userIds];
    this.toUsers(ids, p).catch((e) => this.logger.warn(`${p.type} failed: ${e?.message}`));
  }

  /** Every admin account. */
  async admins(): Promise<Types.ObjectId[]> {
    return (await this.users.find({ role: 'ADMIN', isActive: { $ne: false } }).select('_id').lean().exec()).map((u: any) => u._id);
  }
}

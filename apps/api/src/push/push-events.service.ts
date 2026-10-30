import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from '@rent-ghar/db/schemas/user.schema';
import { PushService } from './push.service';
import { PushCoreService } from './push-core.service';

/**
 * What happens on the site → which push goes to whom.
 *
 * Every method returns at once and never throws: a push problem can never
 * slow down or break approving a listing, saving a review or a payment.
 */

/** "2.5 Crore", "85 Lakh", "45 Thousand". */
export function pkr(n: unknown): string {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return '';
  const t = (x: number) => String(Number(x.toFixed(2)));
  if (v >= 1e9) return `PKR ${t(v / 1e9)} Arab`;
  if (v >= 1e7) return `PKR ${t(v / 1e7)} Crore`;
  if (v >= 1e5) return `PKR ${t(v / 1e5)} Lakh`;
  if (v >= 1e3) return `PKR ${t(v / 1e3)} Thousand`;
  return `PKR ${Math.round(v)}`;
}

const photo = (p: any): string | null => p?.mainPhotoUrl || p?.additionalPhotosUrls?.[0] || null;
const title = (p: any) => String(p?.title || 'Your listing').slice(0, 80);
const shortName = (name?: string) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Someone';
  return parts.length === 1 ? parts[0]! : `${parts[0]} ${parts[parts.length - 1]![0]!.toUpperCase()}.`;
};

@Injectable()
export class PushEventsService {
  private readonly logger = new Logger('Push');

  constructor(
    private readonly push: PushService,
    private readonly core: PushCoreService,
    @InjectModel(User.name) private readonly users: Model<any>,
  ) {}

  private safe(label: string, fn: () => Promise<unknown>) {
    fn().catch((e) => this.logger.warn(`${label}: ${e?.message}`));
  }

  private async nameOf(id: unknown): Promise<string> {
    if (!id || !Types.ObjectId.isValid(String(id))) return 'Someone';
    const u: any = await this.users.findById(id).select('name companyName').lean().exec();
    return u?.companyName || u?.name || 'Someone';
  }

  /* ── listings ── */

  /** A listing's status changed (admin decision, renewal, expiry). */
  listingStatus(p: any, was: string | undefined) {
    this.safe('listing status', async () => {
      if (!p?.owner) return;
      const now = p.status;
      if (now === 'approved' && was === 'pending') {
        await this.push.toUsers([p.owner], { type: 'listing_live', vars: { listing: title(p) }, url: `/properties/${p.slug}`, tag: `listing:${p._id}`, icon: photo(p) });
      } else if (now === 'rejected' && was !== 'rejected') {
        await this.push.toUsers([p.owner], { type: 'listing_rejected', vars: { listing: title(p) }, url: `/dashboard/property/edit/${p._id}`, tag: `listing:${p._id}` });
      }
    });
  }

  /** A new listing is waiting for an admin. */
  listingHeld(p: any) {
    this.safe('listing held', async () => {
      const by = await this.nameOf(p.owner);
      await this.push.toUsers(await this.push.admins(), {
        type: 'admin_listing',
        vars: { listing: title(p), by },
        url: '/dashboard/listed-properties',
        tag: 'admin:listings',
        renotify: true,
        icon: photo(p),
      });
    });
  }

  /** The price went down: everyone whose device opened this listing (once a day per listing). */
  priceChanged(p: any, oldPrice: unknown) {
    this.safe('price drop', async () => {
      const before = Number(oldPrice);
      const after = Number(p?.price);
      if (p?.status !== 'approved' || !(before > 0) || !(after > 0) || after >= before) return;
      const cfg = await this.core.config();
      if (((before - after) / before) * 100 < cfg.priceDropMinPct) return;
      if (!(await this.core.once(`drop:${p._id}:${this.core.today(cfg)}`, 24))) return;
      const owner = p.owner ? String(p.owner) : '';
      const subs = await this.core.subscribers
        .find({ viewed: p._id, status: 'active', alertsOff: { $ne: true }, ...(owner ? { userId: { $ne: new Types.ObjectId(owner) } } : {}) })
        .select('endpoint keys')
        .limit(20_000)
        .lean()
        .exec();
      await this.push.toDevices(subs as any, {
        type: 'price_drop',
        vars: { listing: title(p), price: pkr(after), oldPrice: pkr(before) },
        url: `/properties/${p.slug}`,
        tag: `drop:${p._id}`,
        image: photo(p),
        icon: photo(p),
      });
    });
  }

  /** Views were counted: tell the agent when a listing crosses a milestone (each once). */
  viewsCounted(rows: { _id: unknown; title?: string; slug?: string; owner?: unknown; views: number; added: number }[]) {
    this.safe('views', async () => {
      const cfg = await this.core.config();
      if (!cfg.auto.views_milestone?.enabled) return;
      const marks = cfg.milestones.split(',').map((s) => parseInt(s, 10)).filter((n) => n > 0).sort((a, b) => a - b);
      for (const r of rows) {
        const crossed = marks.filter((m) => r.views - r.added < m && r.views >= m).pop();
        if (!crossed || !r.owner || !(await this.core.once(`views:${r._id}:${crossed}`, 24 * 365))) continue;
        await this.push.toUsers([r.owner], {
          type: 'views_milestone',
          vars: { count: crossed.toLocaleString('en-PK'), listing: String(r.title || 'Your listing').slice(0, 80) },
          url: `/properties/${r.slug}`,
          tag: `views:${r._id}`,
        });
      }
    });
  }

  /* ── reviews ── */

  /** A review went live: the agent (and their agency, for an agent's review). */
  reviewLive(o: { agentId: string; reviewerName?: string; rating: number; text: string; agentPath: string }) {
    this.safe('review', async () => {
      const agent: any = await this.users.findById(o.agentId).select('agencyId').lean().exec();
      const to = [o.agentId, ...(agent?.agencyId ? [String(agent.agencyId)] : [])];
      await this.push.toUsers(to, {
        type: 'review_received',
        vars: { rating: o.rating, reviewer: shortName(o.reviewerName), review: o.text.slice(0, 140) },
        url: `${o.agentPath}#reviews`,
      });
    });
  }

  reviewReply(o: { reviewerId: string; agentId: string; reply: string; agentPath: string }) {
    this.safe('review reply', async () => {
      await this.push.toUsers([o.reviewerId], {
        type: 'review_reply',
        vars: { agent: await this.nameOf(o.agentId), reply: o.reply.slice(0, 160) },
        url: `${o.agentPath}#reviews`,
        tag: `review-reply:${o.agentId}`,
      });
    });
  }

  reviewApproved(o: { reviewerId: string; agentId: string; agentPath: string }) {
    this.safe('review approved', async () => {
      await this.push.toUsers([o.reviewerId], { type: 'review_approved', vars: { agent: await this.nameOf(o.agentId) }, url: `${o.agentPath}#reviews` });
    });
  }

  reviewHeld(o: { agentId: string; reasons: string[] }) {
    this.safe('review held', async () => {
      await this.push.toUsers(await this.push.admins(), {
        type: 'admin_review',
        vars: { agent: await this.nameOf(o.agentId), reason: o.reasons.join(', ') || 'needs a look' },
        url: '/dashboard/reviews',
        tag: 'admin:reviews',
        renotify: true,
      });
    });
  }

  /* ── plans and payments ── */

  paymentSubmitted(o: { userId: string; plan: string; amount?: number }) {
    this.safe('payment submitted', async () => {
      await this.push.toUsers(await this.push.admins(), {
        type: 'admin_payment',
        vars: { plan: o.plan || 'plan', by: await this.nameOf(o.userId), amount: pkr(o.amount) || 'a payment' },
        url: '/dashboard/subscriptions',
        tag: 'admin:payments',
        renotify: true,
      });
    });
  }

  planActive(o: { userId: string; plan: string; endDate?: Date | null }) {
    this.safe('plan active', async () => {
      const until = o.endDate ? new Date(o.endDate).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }) : 'the end of the plan';
      await this.push.toUsers([o.userId], { type: 'plan_active', vars: { plan: o.plan || 'new', until }, url: '/dashboard/my-subscription' });
    });
  }

  paymentRejected(o: { userId: string; plan: string; reason?: string }) {
    this.safe('payment rejected', async () => {
      await this.push.toUsers([o.userId], {
        type: 'payment_rejected',
        vars: { plan: o.plan || '', reason: o.reason ? `Reason: ${o.reason}` : 'Open your plan page to see why.' },
        url: '/dashboard/my-subscription',
      });
    });
  }

  /* ── reports ── */

  reported(o: { reason: string; what: string }) {
    this.safe('report', async () => {
      await this.push.toUsers(await this.push.admins(), { type: 'admin_report', vars: { reason: o.reason, what: o.what.slice(0, 140) }, url: '/dashboard/reports', tag: 'admin:reports', renotify: true });
    });
  }
}

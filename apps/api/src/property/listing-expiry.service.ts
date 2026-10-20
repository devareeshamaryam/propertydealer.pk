import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Property } from '@rent-ghar/db/schemas/property.schema';
import { SubscriptionService } from '../subscription/subscription.service';
import { AgencyService } from '../agency/agency.service';
import { RevalidateService } from '../revalidate/revalidate.service';
import { PropertyService } from './property.service';

/*
 * The Free plan's month, kept in step every hour.
 *
 *   1. A live listing of an account on the Free plan with no end date gets
 *      one, 30 days from now — the listings that were up before this rule
 *      existed (so none disappears at once), and those of an account whose
 *      paid plan has ended.
 *   2. A listing whose team is on a paid plan loses its end date: paid
 *      listings stay up while the plan does.
 *   3. An approved listing past its end date becomes 'expired' — out of
 *      search, the area pages, the map and the sitemap, not counted against
 *      the plan, its own page still answering. Renewing brings it back.
 *
 * Every step is an idempotent update, so it is safe with several API
 * processes running it. The admin's own listings never get an end date.
 * AUTO_SETUP=false switches it off, like the other background jobs.
 */
@Injectable()
export class ListingExpiryService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ListingExpiryService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    @InjectModel(Property.name) private readonly properties: Model<Property>,
    private readonly subscriptions: SubscriptionService,
    private readonly agency: AgencyService,
    private readonly revalidate: RevalidateService,
  ) {}

  onApplicationBootstrap() {
    if ((process.env.AUTO_SETUP ?? 'true').toLowerCase() === 'false') return;
    const tick = () => void this.run().catch((e) => this.logger.error(`Listing expiry failed: ${e?.message}`));
    setTimeout(tick, 90_000).unref?.();
    this.timer = setInterval(tick, 60 * 60 * 1000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async run() {
    if (this.running) return null;
    this.running = true;
    try {
      const col = this.properties.collection;
      const users = this.properties.db.collection('users');

      // Who is on which plan — asked once per plan owner per run.
      const freeByPlanOwner = new Map<string, boolean>();
      const isFree = async (owner: string) => {
        const planOwner = await this.agency.planOwnerOf(owner);
        if (!freeByPlanOwner.has(planOwner)) {
          const plan = await this.subscriptions.getEffectivePlan(planOwner).catch(() => null);
          // Unknown (lookup failed): treated as paid, so nothing is cut short by mistake.
          freeByPlanOwner.set(planOwner, !!plan && plan.tier === 'free' && !plan.subscription);
        }
        return freeByPlanOwner.get(planOwner)!;
      };

      const owners = (await col.distinct('owner', { status: { $in: ['pending', 'approved'] } }))
        .map((o) => String(o ?? ''))
        .filter((o) => Types.ObjectId.isValid(o));
      const uniq = [...new Set(owners)];
      const accounts = await users.find({ _id: { $in: uniq.map((o) => new Types.ObjectId(o)) } }, { projection: { _id: 1, role: 1 } }).toArray();
      // The admin's listings, and any whose account no longer exists, are never dated.
      const known = new Set(accounts.map((u) => String(u._id)));
      const admins = new Set([...accounts.filter((u: any) => u.role === 'ADMIN').map((u) => String(u._id)), ...uniq.filter((o) => !known.has(o))]);

      const now = new Date();
      const end = new Date(now.getTime() + PropertyService.FREE_LISTING_DAYS * 24 * 60 * 60 * 1000);
      let dated = 0;
      let undated = 0;
      for (const owner of uniq) {
        const ids = AgencyService.anyIds([owner]);
        const live = { owner: { $in: ids }, status: { $in: ['pending', 'approved'] } };
        if (admins.has(owner)) {
          undated += (await col.updateMany({ ...live, expiresAt: { $ne: null } }, { $unset: { expiresAt: '' } })).modifiedCount;
          continue;
        }
        if (await isFree(owner)) {
          dated += (await col.updateMany({ ...live, expiresAt: null }, { $set: { expiresAt: end } })).modifiedCount;
        } else {
          undated += (await col.updateMany({ ...live, expiresAt: { $ne: null } }, { $unset: { expiresAt: '' } })).modifiedCount;
        }
      }

      const due = await col.find({ status: 'approved', expiresAt: { $lte: now } }, { projection: { slug: 1 } }).toArray();
      let expired = 0;
      if (due.length) {
        expired = (await col.updateMany({ _id: { $in: due.map((d) => d._id) }, status: 'approved' }, { $set: { status: 'expired' } })).modifiedCount;
        await this.revalidate
          .revalidate({
            tags: ['properties', 'property-types', 'society-maps', ...due.slice(0, 200).map((d: any) => `property:slug:${d.slug}`)],
            paths: ['/', '/properties', ...due.slice(0, 100).flatMap((d: any) => [`/properties/${d.slug}`])],
          })
          .catch(() => undefined);
      }
      // Featured beyond what the plan now allows (it ended, or moved down): the newest stay, the rest are un-featured.
      let unfeatured = 0;
      // Only the account's own pins: the admin's editorial ones (and older ones of unknown origin) are left alone.
      const featuredOwners = (await col.distinct('owner', { isFeatured: true, featuredBy: 'owner' })).map((o) => String(o ?? '')).filter((o) => Types.ObjectId.isValid(o));
      const seenPlans = new Set<string>();
      for (const owner of featuredOwners) {
        if (admins.has(owner)) continue;
        const planOwner = await this.agency.planOwnerOf(owner);
        if (seenPlans.has(planOwner)) continue;
        seenPlans.add(planOwner);
        const plan = await this.subscriptions.getEffectivePlan(planOwner).catch(() => null);
        if (!plan) continue;
        const team = await this.agency.teamOf(planOwner);
        const rows = await col
          .find({ owner: { $in: AgencyService.anyIds(team) }, isFeatured: true, featuredBy: 'owner' }, { projection: { _id: 1, featuredAt: 1 } })
          .sort({ featuredAt: -1, _id: -1 })
          .toArray();
        const extra = rows.slice(Math.max(0, plan.featuredLimit));
        if (extra.length) {
          unfeatured += (await col.updateMany({ _id: { $in: extra.map((r) => r._id) } }, { $set: { isFeatured: false, featuredAt: null } })).modifiedCount;
        }
      }
      if (unfeatured) await this.revalidate.revalidate({ tags: ['properties'], paths: ['/', '/properties'] }).catch(() => undefined);

      if (dated || undated || expired || unfeatured) this.logger.log(`Listing expiry: ${dated} given a month, ${undated} made open-ended (paid plan), ${expired} expired, ${unfeatured} un-featured (over the plan's limit)`);
      return { dated, undated, expired, unfeatured };
    } finally {
      this.running = false;
    }
  }
}

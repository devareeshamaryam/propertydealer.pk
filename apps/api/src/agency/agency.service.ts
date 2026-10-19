import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from '@rent-ghar/db/schemas/user.schema';
import { Subscription } from '@rent-ghar/db/schemas/subscription.schema';
import { Package } from '@rent-ghar/db/schemas/package.schema';
import { RedisCacheService } from '../redis-cache/redis-cache.service';

/*
 * Who belongs to which agency, and who is verified — the one place every
 * other part of the API asks.
 *
 * An agency (a plan with agent accounts) can create agent accounts. An
 * agent's user document carries `agencyId` = the owner's id. Then:
 *   - the agent lists under the owner's plan (limits are shared by the team,
 *     and the owner may give an agent a cap of their own),
 *   - the agent sees, edits and marks sold only their own listings,
 *   - the owner sees and manages every listing of the team, and alone
 *     features and deletes them.
 *
 * "Verified" is not stored on the user: it is whoever holds a live plan with
 * the verified badge, plus that agency's agents — so it starts and stops with
 * the plan by itself.
 */

const sid = (v: unknown) => String(v ?? '');

@Injectable()
export class AgencyService {
  private readonly memberOf = new Map<string, { agencyId: string | null; at: number }>();

  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Subscription.name) private readonly subscriptions: Model<Subscription>,
    @InjectModel(Package.name) private readonly packages: Model<Package>,
    private readonly cache: RedisCacheService,
  ) {}

  /** The agency an agent account belongs to, or null. Cached for a minute per process. */
  async agencyOf(userId: string): Promise<string | null> {
    const id = sid(userId);
    if (!Types.ObjectId.isValid(id)) return null;
    const hit = this.memberOf.get(id);
    if (hit && Date.now() - hit.at < 60_000) return hit.agencyId;
    const u: any = await this.users.collection.findOne({ _id: new Types.ObjectId(id) }, { projection: { agencyId: 1 } });
    const agencyId = u?.agencyId ? sid(u.agencyId) : null;
    this.memberOf.set(id, { agencyId, at: Date.now() });
    return agencyId;
  }

  /** Forget a cached membership (after an owner adds or removes an agent). */
  forget(userId: string) {
    this.memberOf.delete(sid(userId));
  }

  /** Whose plan this account lists under: its agency's, or its own. */
  async planOwnerOf(userId: string): Promise<string> {
    return (await this.agencyOf(userId)) ?? sid(userId);
  }

  /** The owner and every agent account under them. */
  async teamOf(ownerId: string): Promise<string[]> {
    const id = sid(ownerId);
    if (!Types.ObjectId.isValid(id)) return [id];
    const members = await this.users.collection
      .find({ agencyId: { $in: [new Types.ObjectId(id), id] } }, { projection: { _id: 1 } })
      .toArray();
    return [id, ...members.map((m) => sid(m._id))];
  }

  /** Listings this account may see in its dashboard: an owner's whole team, else its own. */
  async visibleOwners(userId: string): Promise<string[]> {
    if (await this.agencyOf(userId)) return [sid(userId)];
    return this.teamOf(userId);
  }

  /** May this account edit, feature, mark sold or delete a listing owned by `listingOwner`? */
  async canManage(listingOwner: unknown, userId: string): Promise<boolean> {
    const owner = sid(listingOwner);
    if (!owner || !userId) return false;
    if (owner === sid(userId)) return true;
    return (await this.agencyOf(owner)) === sid(userId);
  }

  /**
   * May this account feature or delete a listing owned by `listingOwner`?
   * The agency keeps those for itself: the owner of the listing (when they
   * are not someone's agent) or the agency the listing's agent belongs to.
   * An agent posts, edits and marks their own listings sold — nothing more.
   */
  async canAdminister(listingOwner: unknown, userId: string): Promise<boolean> {
    if (!userId || (await this.agencyOf(userId))) return false;
    return this.canManage(listingOwner, userId);
  }

  /** Both stored forms of a list of ids, for raw-collection `$in` queries. */
  static anyIds(ids: string[]): (Types.ObjectId | string)[] {
    return ids.flatMap((i) => (Types.ObjectId.isValid(i) ? [new Types.ObjectId(i), i] : [i]));
  }

  /**
   * Everyone who shows the "Verified" badge: holders of a live plan with the
   * badge, and their agencies' agents. Cached for five minutes.
   */
  async verifiedIds(): Promise<Set<string>> {
    const ids = await this.cache.wrap(
      this.cache.buildKey('agency:verified', []),
      async () => {
        const badgePlans = await this.packages.find({ verifiedBadge: true }).select('_id').lean().exec();
        if (!badgePlans.length) return [] as string[];
        const subs = await this.subscriptions
          .find({ status: 'active', endDate: { $gt: new Date() }, packageId: { $in: AgencyService.anyIds(badgePlans.map((p: any) => String(p._id))) } })
          .select('userId')
          .lean()
          .exec();
        const owners = subs.map((s: any) => sid(s.userId));
        if (!owners.length) return [] as string[];
        const members = await this.users.collection
          .find({ agencyId: { $in: AgencyService.anyIds(owners) } }, { projection: { _id: 1 } })
          .toArray();
        return [...owners, ...members.map((m) => sid(m._id))];
      },
      { ttl: 300, tags: ['subscriptions'] },
    );
    return new Set(ids);
  }

  async isVerified(userId: unknown): Promise<boolean> {
    return (await this.verifiedIds()).has(sid(userId));
  }

  /** Clear the cached badge list — after a plan is activated, granted or cancelled. */
  async refreshVerified() {
    await this.cache.del(this.cache.buildKey('agency:verified', []));
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '@rent-ghar/db/schemas/user.schema';
import { SubscriptionService } from '../subscription/subscription.service';
import { AgencyService } from '../agency/agency.service';
import { RedisCacheService } from '../redis-cache/redis-cache.service';
import { RevalidateService } from '../revalidate/revalidate.service';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly subscriptions: SubscriptionService,
    private readonly agency: AgencyService,
    private readonly cache: RedisCacheService,
    private readonly revalidate: RevalidateService,
  ) {}

  /** The public profile's address, the way the site builds it: /agents/<company-or-name>-<id>. */
  private static profilePath(u: { _id: unknown; companyName?: string; name?: string }) {
    const label = String(u.companyName || u.name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return label ? `/agents/${label}-${String(u._id)}` : `/agents/${String(u._id)}`;
  }

  /**
   * After a profile change: the agent's page (old and new address — the name
   * is in it), the agents directory and the listings that show this agent's
   * card are refreshed at once, instead of after the 10-minute cache.
   */
  private async refreshProfile(before: any, after: any) {
    const id = String(after?._id ?? before?._id ?? '');
    if (!id) return;
    const paths = new Set<string>(['/agents', `/agents/${id}`]);
    if (before) paths.add(UserService.profilePath(before));
    if (after) paths.add(UserService.profilePath(after));
    const owned = await this.userModel.db
      .collection('properties')
      .find({ owner: { $in: [new Types.ObjectId(id), id] }, status: 'approved' }, { projection: { slug: 1 } })
      .limit(150)
      .toArray();
    await this.cache.invalidateTags(['agents']).catch(() => undefined);
    await this.revalidate
      .revalidate({
        tags: ['agents', ...owned.map((p: any) => `property:slug:${p.slug}`)],
        paths: [...paths, ...owned.slice(0, 60).map((p: any) => `/properties/${p.slug}`)],
      })
      .catch(() => undefined);
  }

  /**
   * Agencies on a plan with the spotlight benefit — for "Verified agencies" on
   * the homepage and the top of the agents page. Most live listings first.
   */
  async spotlight(limit = 12) {
    return this.cache.wrap(this.cache.buildKey('agents:spotlight', [limit]), async () => {
      const db = this.userModel.db;
      const plans = await db.collection('packages').find({ spotlight: true }, { projection: { _id: 1 } }).toArray();
      if (!plans.length) return [];
      const owners = await db
        .collection('subscriptions')
        .distinct('userId', { status: 'active', endDate: { $gt: new Date() }, packageId: { $in: AgencyService.anyIds(plans.map((p) => String(p._id))) } });
      if (!owners.length) return [];
      const users = await this.userModel
        .find({ _id: { $in: owners.map(String).filter((i) => Types.ObjectId.isValid(i)) }, isActive: { $ne: false } })
        .select('name companyName avatarUrl address')
        .lean();
      const ids = users.map((u: any) => u._id);
      const counts = await db
        .collection('properties')
        .aggregate([
          { $match: { owner: { $in: [...ids, ...ids.map(String)] }, status: 'approved' } },
          { $group: { _id: { $toString: '$owner' }, n: { $sum: 1 } } },
        ])
        .toArray();
      // The badge only where the plan includes it — a spotlight plan need not.
      const verified = await this.agency.verifiedIds().catch(() => new Set<string>());
      return users
        .map((u: any) => ({
          _id: String(u._id),
          name: u.companyName || u.name || 'Agency',
          person: u.companyName ? u.name ?? '' : '',
          avatarUrl: u.avatarUrl ?? '',
          address: u.address ?? '',
          listings: counts.find((c: any) => c._id === String(u._id))?.n ?? 0,
          verified: verified.has(String(u._id)),
        }))
        .sort((a, b) => b.listings - a.listings)
        .slice(0, limit);
    }, { ttl: 600, tags: ['subscriptions', 'properties'] });
  }

  /**
   * Verified agencies and agents of one city, for its listing pages: on a
   * plan with the verified badge, and either with this city on their profile
   * or — for accounts that have not chosen one yet — with live listings here.
   * Most listings in the city first.
   */
  async cityAgencies(cityId: string, limit = 12) {
    if (!Types.ObjectId.isValid(cityId)) return [];
    return this.cache.wrap(this.cache.buildKey('agents:city', [cityId, limit]), async () => {
      const db = this.userModel.db;
      const verified = [...(await this.agency.verifiedIds().catch(() => new Set<string>()))].filter((i) => Types.ObjectId.isValid(i));
      if (!verified.length) return [];
      const users = await this.userModel
        .find({ _id: { $in: verified }, isActive: { $ne: false } })
        .select('name companyName avatarUrl address city agencyId')
        .lean();
      // Their live listings in this city (areas store `city` as an ObjectId or a string).
      const areaIds = await db
        .collection('areas')
        .find({ city: { $in: [new Types.ObjectId(cityId), cityId] } }, { projection: { _id: 1 } })
        .toArray();
      const inCityAreas = [...areaIds.map((a) => a._id), ...areaIds.map((a) => String(a._id))];
      const ids = users.map((u: any) => u._id);
      const counts = inCityAreas.length
        ? await db
            .collection('properties')
            .aggregate([
              { $match: { owner: { $in: [...ids, ...ids.map(String)] }, status: 'approved', area: { $in: inCityAreas } } },
              { $group: { _id: { $toString: '$owner' }, n: { $sum: 1 } } },
            ])
            .toArray()
        : [];
      const n = new Map(counts.map((c: any) => [String(c._id), c.n as number]));
      return users
        .filter((u: any) => (u.city ? String(u.city) === cityId : (n.get(String(u._id)) ?? 0) > 0))
        // One card per agency: its own agents are on the agency's page.
        .filter((u: any) => !u.agencyId || !verified.includes(String(u.agencyId)))
        .map((u: any) => ({
          _id: String(u._id),
          name: u.companyName || u.name || 'Agency',
          person: u.companyName ? u.name ?? '' : '',
          avatarUrl: u.avatarUrl ?? '',
          address: u.address ?? '',
          listings: n.get(String(u._id)) ?? 0,
          verified: true,
        }))
        .sort((a, b) => b.listings - a.listings)
        .slice(0, limit);
    }, { ttl: 600, tags: ['subscriptions', 'properties', 'agents'] });
  }

  async findAll() {
    // 🚀 PERF: .lean() — the users table renders plain fields, so there is no
    // reason to hydrate full Mongoose documents for every row.
    return this.userModel
      .find()
      .select('-password -refreshToken')
      .sort({ createdAt: -1 })
      .lean();
  }

  /**
   * Counts for the dashboard overview. The overview used to download every
   * user just to read `.length`.
   */
  async getStats() {
    const rows = await this.userModel
      .aggregate<{
        _id: string | null;
        count: number;
      }>([{ $group: { _id: '$role', count: { $sum: 1 } } }])
      .exec();

    const byRole: Record<string, number> = {};
    let total = 0;
    for (const row of rows) {
      byRole[row._id ?? 'USER'] = row.count;
      total += row.count;
    }

    const inactive = await this.userModel.countDocuments({ isActive: false });
    return { total, byRole, inactive };
  }

  async findOne(id: string) {
    const user = await this.userModel
      .findById(id)
      .select('-password -refreshToken');
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  /**
   * The agent profile a visitor may see.
   *
   * An allow-list rather than a deny-list:  strips the password and
   * refresh token but would still hand out the email address, the role, the
   * active flag and the lockout counters. Here only the fields an agent would
   * print on a business card go out, and only for an account that is active.
   */
  /**
   * The agent profile a visitor may see.
   *
   * An allow-list, not a deny-list: `findOne` strips the password and refresh
   * token but would still hand out the email address, the role, the active flag
   * and the lockout counters. Only what an agent would print on a business card
   * goes out, and only for an account that is still active.
   */
  /**
   * An agent's public profile, with what their plan unlocks: the verified
   * badge, social links, cover photo — and for an agency, its team; for an
   * agency's agent, the agency.
   */
  async findPublicProfile(id: string) {
    const user: any = await this.userModel
      .findOne({ _id: id, isActive: { $ne: false } })
      .select('name companyName bio avatarUrl coverUrl socialLinks experienceYears phone whatsappNumber address createdAt agencyId')
      .lean();

    if (!user) {
      throw new NotFoundException('Agent not found');
    }

    const [plan, verified] = await Promise.all([
      this.subscriptions.getEffectivePlan(String(user._id)).catch(() => null),
      this.agency.isVerified(user._id).catch(() => false),
    ]);
    const perks = plan?.perks;

    let agency: Record<string, unknown> | null = null;
    if (user.agencyId) {
      const a: any = await this.userModel.findById(user.agencyId).select('name companyName avatarUrl').lean();
      if (a) agency = { _id: String(a._id), name: a.companyName || a.name || 'Agency', avatarUrl: a.avatarUrl ?? '' };
    }

    let team: Record<string, unknown>[] = [];
    if (!user.agencyId && (perks?.teamMembers ?? 0) > 0) {
      const members = await this.userModel
        .find({ agencyId: { $in: [user._id, String(user._id)] }, isActive: { $ne: false } })
        .select('name avatarUrl')
        .sort({ name: 1 })
        .limit(50)
        .lean();
      const ids = members.map((m: any) => m._id);
      const counts = ids.length
        ? await this.userModel.db
            .collection('properties')
            .aggregate([
              { $match: { owner: { $in: [...ids, ...ids.map(String)] }, status: 'approved' } },
              { $group: { _id: { $toString: '$owner' }, n: { $sum: 1 } } },
            ])
            .toArray()
        : [];
      const n = new Map(counts.map((c: any) => [String(c._id), c.n as number]));
      team = members.map((m: any) => ({ _id: String(m._id), name: m.name ?? 'Agent', avatarUrl: m.avatarUrl ?? '', listings: n.get(String(m._id)) ?? 0 }));
    }

    const { agencyId: _agencyId, socialLinks, coverUrl, ...rest } = user;
    return {
      ...rest,
      verified,
      // The plan decides whether there is a public page at all (admins always have one).
      profilePage: await this.subscriptions.hasProfilePage(String(user._id)).catch(() => true),
      // An agency's agents carry its branding and links.
      socialLinks: perks?.socialLinks ? socialLinks ?? {} : undefined,
      // Every profile may have a cover photo, whatever the plan.
      coverUrl: coverUrl || undefined,
      agency,
      team,
    };
  }

  /**
   * First listing makes you an agent.
   *
   * Accounts are created as USER — including the ones made purely to see a
   * phone number — and this is the moment that changes. Guarded on the current
   * role so it can never demote an ADMIN, and a no-op for anyone who is
   * already an AGENT.
   */
  async promoteToAgent(id: string): Promise<void> {
    await this.userModel
      .updateOne(
        { _id: id, role: { $nin: ['ADMIN', 'AGENT'] } },
        { $set: { role: 'AGENT' } },
      )
      .exec();
  }

  async update(id: string, updateData: Partial<User>) {
    const before: any = await this.userModel.findById(id).select('name companyName').lean();
    const user = await this.userModel
      .findByIdAndUpdate(id, { $set: updateData }, { new: true })
      .select('-password -refreshToken');

    if (!user) {
      throw new NotFoundException('User not found');
    }
    void this.refreshProfile(before, user).catch(() => undefined);
    return user;
  }

  async remove(id: string) {
    const result = await this.userModel.findByIdAndDelete(id);
    if (!result) {
      throw new NotFoundException('User not found');
    }
    // Off the agents pages at once — a city left with no dealers loses its page.
    void this.revalidate.revalidate({ tags: ['agents', 'dealers'], paths: ['/agents', '/property-dealers'] }).catch(() => undefined);
    return { success: true };
  }
}

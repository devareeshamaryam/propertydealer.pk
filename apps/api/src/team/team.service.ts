import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '@rent-ghar/db/schemas/user.schema';
import { Property } from '@rent-ghar/db/schemas/property.schema';
import { SubscriptionService } from '../subscription/subscription.service';
import { AgencyService } from '../agency/agency.service';
import { emailQuery } from '../auth/auth.service';

/*
 * An agency's own agent accounts (the agency plans: Agency and Agency Plus).
 *
 * The owner creates each agent with an email and a password and hands those
 * over; the agent signs in like anyone else. An agent:
 *   - lists under the agency's plan (the allowance is the team's), within a
 *     cap of their own if the owner sets one,
 *   - sees, edits and marks sold only their own listings,
 *   - cannot feature or delete listings, buy plans or manage the team.
 * The owner sees every listing of the team and can: edit an agent's details,
 * set their listing cap, reset their password, pause them (they are signed
 * out and cannot sign in; their listings stay up), move their listings to
 * another member, and remove them — their listings then move to whoever the
 * owner picks, so nothing published disappears.
 */

export interface TeamMemberView {
  _id: string;
  name: string;
  email: string;
  phone: string;
  isActive: boolean;
  createdAt?: Date;
  /** The owner's cap for this agent; 0 = none of their own. */
  listingLimit: number;
  listings: { total: number; live: number; pending: number; expired: number; featured: number };
  stats: { views: number; calls: number; whatsapp: number };
}

const ids2 = (id: Types.ObjectId | string) => [new Types.ObjectId(String(id)), String(id)];

@Injectable()
export class TeamService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(Property.name) private readonly properties: Model<Property>,
    private readonly subscriptions: SubscriptionService,
    private readonly agency: AgencyService,
  ) {}

  /** The caller must be an account that can own a team (not an agent of someone else's). */
  private async ownerOnly(userId: string) {
    if (await this.agency.agencyOf(userId)) {
      throw new ForbiddenException('Only the agency owner can manage the team.');
    }
  }

  private async memberOf(ownerId: string, memberId: string): Promise<UserDocument> {
    if (!Types.ObjectId.isValid(memberId)) throw new NotFoundException('Agent not found');
    const member = await this.users.findById(memberId).select('+refreshToken').exec();
    if (!member || String(member.agencyId ?? '') !== String(ownerId)) throw new NotFoundException('Agent not found');
    return member;
  }

  private static cap(v: unknown): number {
    const n = Math.floor(Number(v));
    if (!Number.isFinite(n) || n < 0) throw new BadRequestException('The listing limit must be 0 (no limit of their own) or more');
    return Math.min(n, 100_000);
  }

  /** Per-owner listing numbers and lead counts, for the given accounts. */
  private async numbers(ids: (Types.ObjectId | string)[]) {
    if (!ids.length) return new Map<string, any>();
    const rows = await this.properties.collection
      .aggregate([
        { $match: { owner: { $in: ids.flatMap((i) => ids2(i)) } } },
        {
          $group: {
            _id: { $toString: '$owner' },
            total: { $sum: 1 },
            live: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
            pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
            expired: { $sum: { $cond: [{ $eq: ['$status', 'expired'] }, 1, 0] } },
            featured: { $sum: { $cond: [{ $eq: ['$isFeatured', true] }, 1, 0] } },
            views: { $sum: { $ifNull: ['$views', 0] } },
            calls: { $sum: { $ifNull: ['$phoneClicks', 0] } },
            whatsapp: { $sum: { $ifNull: ['$whatsappClicks', 0] } },
          },
        },
      ])
      .toArray();
    return new Map(rows.map((r: any) => [String(r._id), r]));
  }

  async list(ownerId: string) {
    await this.ownerOnly(ownerId);
    const plan = await this.subscriptions.getEffectivePlan(ownerId);
    const members = await this.users
      .find({ agencyId: { $in: ids2(ownerId) } })
      .select('name email phone isActive createdAt listingLimit')
      .sort({ createdAt: 1 })
      .lean()
      .exec();
    const n = await this.numbers([ownerId, ...members.map((m: any) => m._id)]);
    const view = (c: any) => ({
      listings: { total: c?.total ?? 0, live: c?.live ?? 0, pending: c?.pending ?? 0, expired: c?.expired ?? 0, featured: c?.featured ?? 0 },
      stats: { views: c?.views ?? 0, calls: c?.calls ?? 0, whatsapp: c?.whatsapp ?? 0 },
    });
    return {
      limit: plan.perks.teamMembers,
      planName: plan.name,
      /** The team's shared allowance: live + pending listings of everyone, against the plan. */
      pool: { limit: plan.propertyLimit, used: plan.used, featuredLimit: plan.featuredLimit },
      /** The owner's own listings, for the team summary. */
      owner: view(n.get(String(ownerId))),
      members: members.map(
        (m: any): TeamMemberView => ({
          _id: String(m._id),
          name: m.name ?? '',
          email: m.email,
          phone: m.phone ?? '',
          isActive: m.isActive !== false,
          createdAt: m.createdAt,
          listingLimit: Number(m.listingLimit ?? 0) || 0,
          ...view(n.get(String(m._id))),
        }),
      ),
    };
  }

  async create(ownerId: string, input: { name?: string; email?: string; password?: string; phone?: string; listingLimit?: number }) {
    await this.ownerOnly(ownerId);
    const plan = await this.subscriptions.getEffectivePlan(ownerId);
    const limit = plan.perks.teamMembers;
    if (limit <= 0) throw new ForbiddenException('Agent accounts come with the agency plans. Choose one from Buy a Plan.');
    const count = await this.users.countDocuments({ agencyId: { $in: ids2(ownerId) } });
    if (count >= limit) throw new ForbiddenException(`Your plan includes ${limit} agent accounts, and they are all in use.`);

    const name = String(input.name ?? '').trim().slice(0, 120);
    const email = String(input.email ?? '').trim().toLowerCase();
    const password = String(input.password ?? '');
    const phone = String(input.phone ?? '').trim().slice(0, 30);
    const listingLimit = input.listingLimit === undefined || input.listingLimit === null ? 0 : TeamService.cap(input.listingLimit);
    if (!name) throw new BadRequestException("Enter the agent's name");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('Enter a valid email address');
    if (password.length < 6) throw new BadRequestException('Use at least 6 characters for the password');
    if (await this.users.exists(emailQuery(email))) throw new BadRequestException('An account with this email already exists');

    const owner: any = await this.users.findById(ownerId).select('companyName name').lean();
    const member = await new this.users({
      name,
      email,
      password, // hashed by the schema
      phone,
      whatsappNumber: phone,
      role: 'AGENT',
      provider: 'credentials',
      isActive: true,
      agencyId: new Types.ObjectId(ownerId),
      companyName: owner?.companyName || owner?.name || undefined,
      ...(listingLimit ? { listingLimit } : {}),
    }).save();
    this.agency.forget(String(member._id));
    void this.agency.refreshVerified();
    return { _id: String(member._id), name, email, phone, isActive: true, createdAt: (member as any).createdAt };
  }

  async update(
    ownerId: string,
    memberId: string,
    input: { name?: string; phone?: string; email?: string; isActive?: boolean; password?: string; listingLimit?: number | null },
  ) {
    await this.ownerOnly(ownerId);
    const member = await this.memberOf(ownerId, memberId);
    if (input.name !== undefined) member.name = String(input.name).trim().slice(0, 120) || member.name;
    if (input.phone !== undefined) {
      member.phone = String(input.phone).trim().slice(0, 30);
      (member as any).whatsappNumber = member.phone;
    }
    if (input.email !== undefined) {
      const email = String(input.email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('Enter a valid email address');
      if (email !== member.email) {
        const taken: any = await this.users.findOne(emailQuery(email)).select('_id').lean();
        if (taken && String(taken._id) !== String(member._id)) throw new BadRequestException('An account with this email already exists');
        member.email = email;
      }
    }
    if (input.listingLimit !== undefined) (member as any).listingLimit = input.listingLimit === null ? undefined : TeamService.cap(input.listingLimit) || undefined;
    if (input.isActive !== undefined) {
      member.isActive = !!input.isActive;
      // Paused: signed out at once (their refresh token stops matching).
      if (!member.isActive) (member as any).refreshToken = undefined;
    }
    if (input.password !== undefined) {
      if (String(input.password).length < 6) throw new BadRequestException('Use at least 6 characters for the password');
      member.password = String(input.password);
      // Signs them out everywhere: their refresh token no longer matches.
      (member as any).refreshToken = undefined;
    }
    await member.save();
    return {
      _id: String(member._id),
      name: member.name,
      email: member.email,
      phone: member.phone ?? '',
      isActive: member.isActive !== false,
      listingLimit: Number((member as any).listingLimit ?? 0) || 0,
    };
  }

  /** Where an agent's listings may go: the owner, or another agent of the same team. */
  private async target(ownerId: string, to: string | undefined, notId: string): Promise<Types.ObjectId> {
    if (!to || to === ownerId) return new Types.ObjectId(ownerId);
    if (to === notId) throw new BadRequestException('Choose someone else to receive the listings');
    const t = await this.memberOf(ownerId, to);
    return t._id as Types.ObjectId;
  }

  /** Move every listing of one agent to the owner or to another agent. */
  async transfer(ownerId: string, memberId: string, to?: string) {
    await this.ownerOnly(ownerId);
    const member = await this.memberOf(ownerId, memberId);
    const dest = await this.target(ownerId, to, memberId);
    const moved = await this.properties.collection.updateMany({ owner: { $in: ids2(member._id as Types.ObjectId) } }, { $set: { owner: dest } });
    return { moved: moved.modifiedCount, to: String(dest) };
  }

  /** Give one listing of the team to the owner (no `to`) or to one of the agents. */
  async assignListing(ownerId: string, propertyId: string, to?: string) {
    await this.ownerOnly(ownerId);
    if (!Types.ObjectId.isValid(propertyId)) throw new NotFoundException('Listing not found');
    const listing: any = await this.properties.collection.findOne({ _id: new Types.ObjectId(propertyId) }, { projection: { owner: 1 } });
    if (!listing) throw new NotFoundException('Listing not found');
    const team = await this.agency.teamOf(ownerId);
    if (!team.includes(String(listing.owner))) throw new ForbiddenException('That listing is not one of your team\'s');
    const dest = !to || to === ownerId ? new Types.ObjectId(ownerId) : ((await this.memberOf(ownerId, to))._id as Types.ObjectId);
    await this.properties.collection.updateOne({ _id: listing._id }, { $set: { owner: dest } });
    return { _id: propertyId, owner: String(dest) };
  }

  /** Remove an agent: their listings move to the owner (or the agent `to`), then the account is closed. */
  async remove(ownerId: string, memberId: string, to?: string) {
    await this.ownerOnly(ownerId);
    const member = await this.memberOf(ownerId, memberId);
    const dest = await this.target(ownerId, to, memberId);
    const moved = await this.properties.collection.updateMany({ owner: { $in: ids2(member._id as Types.ObjectId) } }, { $set: { owner: dest } });
    await this.users.deleteOne({ _id: member._id });
    this.agency.forget(String(member._id));
    void this.agency.refreshVerified();
    return { removed: true, listingsMoved: moved.modifiedCount };
  }
}

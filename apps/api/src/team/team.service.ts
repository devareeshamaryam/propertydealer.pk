import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '@rent-ghar/db/schemas/user.schema';
import { Property } from '@rent-ghar/db/schemas/property.schema';
import { SubscriptionService } from '../subscription/subscription.service';
import { AgencyService } from '../agency/agency.service';

/*
 * An agency's own agent accounts (Agency Plus).
 *
 * The owner creates each agent with an email and a password and hands those
 * over; the agent signs in like anyone else. An agent:
 *   - lists under the agency's plan (the allowance is the team's),
 *   - sees and edits only their own listings,
 *   - cannot buy plans or manage the team.
 * The owner sees every listing of the team, can switch an agent off (they can
 * no longer sign in), reset their password, and remove them — their listings
 * then move to the owner, so nothing published disappears.
 */

export interface TeamMemberView {
  _id: string;
  name: string;
  email: string;
  phone: string;
  isActive: boolean;
  createdAt?: Date;
  listings: { total: number; live: number };
}

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
    const member = await this.users.findById(memberId).exec();
    if (!member || String(member.agencyId ?? '') !== String(ownerId)) throw new NotFoundException('Agent not found');
    return member;
  }

  async list(ownerId: string) {
    await this.ownerOnly(ownerId);
    const plan = await this.subscriptions.getEffectivePlan(ownerId);
    const members = await this.users
      .find({ agencyId: { $in: [new Types.ObjectId(ownerId), ownerId] } })
      .select('name email phone isActive createdAt')
      .sort({ createdAt: 1 })
      .lean()
      .exec();
    const ids = members.map((m: any) => m._id);
    const counts = ids.length
      ? await this.properties.collection
          .aggregate([
            { $match: { owner: { $in: [...ids, ...ids.map(String)] } } },
            { $group: { _id: { $toString: '$owner' }, total: { $sum: 1 }, live: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } } } },
          ])
          .toArray()
      : [];
    return {
      limit: plan.perks.teamMembers,
      planName: plan.name,
      members: members.map((m: any): TeamMemberView => {
        const c: any = counts.find((x: any) => x._id === String(m._id));
        return {
          _id: String(m._id),
          name: m.name ?? '',
          email: m.email,
          phone: m.phone ?? '',
          isActive: m.isActive !== false,
          createdAt: m.createdAt,
          listings: { total: c?.total ?? 0, live: c?.live ?? 0 },
        };
      }),
    };
  }

  async create(ownerId: string, input: { name?: string; email?: string; password?: string; phone?: string }) {
    await this.ownerOnly(ownerId);
    const plan = await this.subscriptions.getEffectivePlan(ownerId);
    const limit = plan.perks.teamMembers;
    if (limit <= 0) throw new ForbiddenException('Team accounts come with the Agency Plus plan.');
    const count = await this.users.countDocuments({ agencyId: { $in: [new Types.ObjectId(ownerId), ownerId] } });
    if (count >= limit) throw new ForbiddenException(`Your plan includes ${limit} agent accounts, and they are all in use.`);

    const name = String(input.name ?? '').trim().slice(0, 120);
    const email = String(input.email ?? '').trim().toLowerCase();
    const password = String(input.password ?? '');
    const phone = String(input.phone ?? '').trim().slice(0, 30);
    if (!name) throw new BadRequestException("Enter the agent's name");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('Enter a valid email address');
    if (password.length < 6) throw new BadRequestException('Use at least 6 characters for the password');
    if (await this.users.exists({ email })) throw new BadRequestException('An account with this email already exists');

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
    }).save();
    this.agency.forget(String(member._id));
    void this.agency.refreshVerified();
    return { _id: String(member._id), name, email, phone, isActive: true, createdAt: (member as any).createdAt, listings: { total: 0, live: 0 } };
  }

  async update(ownerId: string, memberId: string, input: { name?: string; phone?: string; isActive?: boolean; password?: string }) {
    await this.ownerOnly(ownerId);
    const member = await this.memberOf(ownerId, memberId);
    if (input.name !== undefined) member.name = String(input.name).trim().slice(0, 120) || member.name;
    if (input.phone !== undefined) member.phone = String(input.phone).trim().slice(0, 30);
    if (input.isActive !== undefined) member.isActive = !!input.isActive;
    if (input.password !== undefined) {
      if (String(input.password).length < 6) throw new BadRequestException('Use at least 6 characters for the password');
      member.password = String(input.password);
      // Signs them out everywhere: their refresh token no longer matches.
      (member as any).refreshToken = undefined;
    }
    await member.save();
    return { _id: String(member._id), name: member.name, phone: member.phone ?? '', isActive: member.isActive !== false };
  }

  /** Remove an agent: their listings move to the owner, then the account is closed. */
  async remove(ownerId: string, memberId: string) {
    await this.ownerOnly(ownerId);
    const member = await this.memberOf(ownerId, memberId);
    const moved = await this.properties.collection.updateMany(
      { owner: { $in: [member._id, String(member._id)] } },
      { $set: { owner: new Types.ObjectId(ownerId) } },
    );
    await this.users.deleteOne({ _id: member._id });
    this.agency.forget(String(member._id));
    void this.agency.refreshVerified();
    return { removed: true, listingsMoved: moved.modifiedCount };
  }
}

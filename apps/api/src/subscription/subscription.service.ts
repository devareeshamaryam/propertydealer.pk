import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Optional } from '@nestjs/common';
import { PushEventsService } from '../push/push-events.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Subscription,
  SubscriptionDocument,
} from '@rent-ghar/db/schemas/subscription.schema';
import { Package, PackageDocument } from '@rent-ghar/db/schemas/package.schema';
import { Property } from '@rent-ghar/db/schemas/property.schema';
import { CreateSubscriptionDto } from '@rent-ghar/types/subscription';
import { DiscordService, DISCORD_COLORS } from '../notify/discord.service';
import { AgencyService } from '../agency/agency.service';

/** What a plan unlocks, beyond its listing numbers. */
export interface PlanPerks {
  verifiedBadge: boolean;
  teamMembers: number;
  socialLinks: boolean;
  brandedProfile: boolean;
  autoPublish: boolean;
  spotlight: boolean;
  /** A public profile page and the links to it. */
  profilePage: boolean;
  /** Photos a listing may have (cover + gallery). */
  photosPerProperty: number;
}

/** Only when there is no Free package at all (a fresh install): the least an account gets. */
export const NO_PERKS: PlanPerks = {
  verifiedBadge: false,
  teamMembers: 0,
  socialLinks: false,
  brandedProfile: false,
  autoPublish: false,
  spotlight: false,
  profilePage: true,
  photosPerProperty: 20,
};

export function perksOf(pkg: any): PlanPerks {
  if (!pkg) return NO_PERKS;
  return {
    verifiedBadge: !!pkg.verifiedBadge,
    teamMembers: Math.max(0, Number(pkg.teamMembers) || 0),
    socialLinks: !!pkg.socialLinks,
    brandedProfile: !!pkg.brandedProfile,
    autoPublish: !!pkg.autoPublish,
    spotlight: !!pkg.spotlight,
    // Every account has a public profile page, Free included — it is not a plan benefit.
    profilePage: true,
    photosPerProperty: Math.max(1, Number(pkg.photosPerProperty) || 20),
  };
}

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly discord: DiscordService,
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(Package.name)
    private packageModel: Model<PackageDocument>,
    // Needed to count a free user's live listings against the free allowance.
    @InjectModel(Property.name)
    private propertyModel: Model<any>,
    private readonly agency: AgencyService,
    @Optional() private readonly pushEvents?: PushEventsService,
  ) {}

  /** Live listings (pending or approved) of a whole team — the number the plan limit is about. */
  private async countTeamListings(ownerId: string): Promise<number> {
    const team = await this.agency.teamOf(ownerId);
    return this.propertyModel.collection.countDocuments({
      owner: { $in: AgencyService.anyIds(team) },
      status: { $in: ['pending', 'approved'] },
    });
  }

  /**
   * Live listings allowed without a paid package.
   *
   * Deliberately a constant rather than a Setting lookup: it is read on every
   * "add property" attempt, and one is the number that makes the dashboard
   * usable on day one while still leaving a reason to buy a package.
   */
  static readonly FREE_PROPERTY_LIMIT = 1;

  private freeCache: { at: number; pkg: any } | null = null;

  /**
   * The Free package as the admin set it (Dashboard → Packages): what an
   * account with no paid plan gets — its listing limit, featured slots,
   * photos and switches. Cached for a minute. Before this, Free's numbers
   * were fixed in code and editing the Free package changed nothing.
   */
  async freePackage(): Promise<any | null> {
    if (this.freeCache && Date.now() - this.freeCache.at < 60_000) return this.freeCache.pkg;
    const rows = await this.packageModel.find({ price: { $lte: 0 } }).sort({ isActive: -1, createdAt: 1 }).lean().exec();
    const pkg = rows.find((p: any) => String(p.name).trim().toLowerCase() === 'free') ?? rows[0] ?? null;
    this.freeCache = { at: Date.now(), pkg };
    return pkg;
  }

  async purchase(
    userId: string,
    dto: CreateSubscriptionDto,
  ): Promise<SubscriptionDocument> {
    // Verify package exists and is active
    const packageDoc = await this.packageModel.findById(dto.packageId).exec();
    if (!packageDoc) {
      throw new NotFoundException('Package not found');
    }
    if (!packageDoc.isActive) {
      throw new BadRequestException('This package is not available for purchase');
    }

    // An agency's agents list under the agency's plan; only the owner buys.
    if (await this.agency.agencyOf(userId)) {
      throw new ForbiddenException('Your agency manages the plan for your account. Ask your agency owner to upgrade.');
    }

    /*
     * Having a plan is not a reason to refuse selling another one.
     *
     * This used to throw "You already have an active subscription. Please
     * wait for it to expire or cancel it" at anyone who tried — so an agent
     * on Starter who filled up five listings and wanted Dealer today could
     * not buy it, and the money went nowhere. It got worse once a zero-price
     * plan started activating on the spot: clicking Free left an active row
     * for thirty days, and from then on every single Buy ended as a 400 the
     * moment the confirmation dialog closed. That is the "popup opens and
     * then shuts" with nothing behind it.
     *
     * Buying while subscribed is an upgrade or a renewal, and activate()
     * already expires whatever came before, so one plan is still live at a
     * time. The old plan keeps working until the new one is paid for and
     * approved, which is the right way round.
     */
    const activePlan = await this.subscriptionModel
      .findOne({ userId, status: 'active', endDate: { $gt: new Date() } })
      .exec();

    /*
     * The one case still worth refusing: dropping onto the free plan while
     * paying for a real one. Zero-price plans activate immediately, so this
     * would expire the paid plan the instant it was clicked — almost always
     * a misclick on the pricing page rather than a decision.
     */
    if (activePlan && (packageDoc.price ?? 0) <= 0 && (activePlan.amount ?? 0) > 0) {
      throw new BadRequestException(
        `You are on the ${activePlan.planName ?? 'paid'} plan. Switching to Free would end it straight away — ask an admin to cancel it if that is what you want.`,
      );
    }

    /*
     * Free is where every account already is — there is nothing to buy, so no
     * invoice and no checkout. (Choosing Free used to open the payment screen
     * for a zero-rupee invoice.) The answer says the plan is in effect.
     */
    if ((packageDoc.price ?? 0) <= 0) {
      return {
        free: true,
        status: 'active',
        paymentStatus: 'completed',
        planName: packageDoc.name,
        amount: 0,
        planPropertyLimit: packageDoc.propertyLimit,
        planDurationDays: packageDoc.duration,
      } as any;
    }

    /*
     * An unpaid invoice they already have, rather than a pile of them.
     *
     * Clicking Buy twice created two invoices for the same plan, and the
     * admin screen then showed both with no way to tell which one the
     * screenshot belonged to.
     */
    const openInvoice = await this.subscriptionModel
      .findOne({
        userId,
        status: 'pending',
        paymentStatus: { $in: ['pending', 'submitted'] },
      })
      .sort({ createdAt: -1 })
      .exec();

    if (openInvoice) {
      if (String(openInvoice.packageId) === String(dto.packageId)) {
        // Same plan, still unpaid: send them back to the invoice they have.
        return openInvoice;
      }
      // They changed their mind about which plan. Retire the old invoice so
      // only one is ever waiting for payment.
      openInvoice.status = 'cancelled';
      await openInvoice.save();
    }

    /*
     * A purchase starts as an unpaid invoice.
     *
     * The amount and the plan's terms are copied in rather than read from the
     * package later: the admin may change the price or delete the package
     * entirely, and an invoice whose amount moves on its own is worthless in
     * an argument about what someone paid.
     */
    const subscription = new this.subscriptionModel({
      userId,
      packageId: dto.packageId,
      status: 'pending',
      paymentStatus: 'pending',
      invoiceNumber: await this.nextInvoiceNumber(),
      amount: packageDoc.price,
      planName: packageDoc.name,
      planPropertyLimit: packageDoc.propertyLimit,
      planDurationDays: packageDoc.duration,
    });

    const saved = await subscription.save();

    /*
     * Nothing to pay, nothing to wait for.
     *
     * A zero-price plan went through the whole invoice ritual — pending
     * status, a checkout screen with bank accounts on it, a screenshot
     * upload and an admin approval — to hand over something that costs
     * nothing. It activates on the spot instead.
     */
    if ((packageDoc.price ?? 0) <= 0) {
      return this.activate(saved._id.toString());
    }

    /*
     * A purchase arrives as "pending" and an admin activates it, so this alert
     * is the only thing standing between an agent paying and somebody
     * noticing. The link goes straight to the subscriptions screen.
     */
    this.discord.send({
      title: '💳 Package purchased — needs activating',
      description: `${packageDoc.name} · ${DiscordService.money(packageDoc.price)}`,
      url: '/dashboard/subscriptions',
      color: DISCORD_COLORS.money,
      category: 'Payments',
      fields: [
        { name: 'Listings included', value: String(packageDoc.propertyLimit ?? '—') },
        { name: 'Duration', value: packageDoc.duration ? `${packageDoc.duration} days` : '—' },
      ],
      who: [{ label: '💳 Buyer', id: userId }],
      links: [{ label: 'Subscriptions', url: '/dashboard/subscriptions' }],
    });

    return saved;
  }

  async findUserSubscriptions(userId: string): Promise<SubscriptionDocument[]> {
    return this.subscriptionModel
      .find({ userId })
      .populate('packageId')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findActiveSubscription(
    userId: string,
  ): Promise<SubscriptionDocument | null> {
    return this.subscriptionModel
      .findOne({
        // Stored as a string on some rows and an ObjectId on others.
        userId: { $in: AgencyService.anyIds([String(userId)]) },
        status: 'active',
        endDate: { $gt: new Date() },
      })
      .sort({ endDate: -1 })
      .populate('packageId')
      .exec();
  }

  async findAll(): Promise<SubscriptionDocument[]> {
    return this.subscriptionModel
      .find()
      .populate('userId', 'name email')
      .populate('packageId')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(id: string): Promise<SubscriptionDocument> {
    const subscription = await this.subscriptionModel
      .findById(id)
      .populate('userId', 'name email')
      .populate('packageId')
      .exec();

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    return subscription;
  }

  /**
   * Give an agent a plan, with no invoice and no payment.
   *
   * Plans get handed out for reasons that have nothing to do with the
   * checkout: a dealer who paid in cash at the office, an agency being
   * courted, an apology for a bad week. Before this the only route was to
   * make the agent "buy" the plan and then approve an invoice for money that
   * never moved through the site, which left the books lying.
   *
   * The result is a real subscription — same status, same end date, same
   * entitlement — marked so it is obvious later that nobody paid for it.
   */
  async assignToUser(
    userId: string,
    packageId: string,
    adminId?: string,
  ): Promise<SubscriptionDocument> {
    const packageDoc = await this.packageModel.findById(packageId).exec();
    if (!packageDoc) {
      throw new NotFoundException('Package not found');
    }

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + packageDoc.duration);

    // One active plan at a time, exactly as activate() enforces.
    await this.subscriptionModel
      .updateMany(
        { userId, status: 'active' },
        { $set: { status: 'expired' } },
      )
      .exec();

    const subscription = new this.subscriptionModel({
      userId,
      packageId,
      status: 'active',
      paymentStatus: 'completed',
      startDate,
      endDate,
      reviewedAt: new Date(),
      invoiceNumber: await this.nextInvoiceNumber(),
      amount: 0,
      planName: packageDoc.name,
      planPropertyLimit: packageDoc.propertyLimit,
      planDurationDays: packageDoc.duration,
      paymentMethod: 'Granted by admin',
      paymentNote: adminId ? `Assigned by admin ${adminId}` : 'Assigned by admin',
    });

    const saved = await subscription.save();
    void this.agency.refreshVerified();

    this.discord.send({
      title: '🎁 Plan granted by admin',
      description: `${packageDoc.name} · ${packageDoc.duration} days · ${packageDoc.propertyLimit} listings`,
      url: '/dashboard/subscriptions',
      color: DISCORD_COLORS.approved,
      category: 'Payments',
      fields: [{ name: 'Ends', value: endDate.toLocaleDateString('en-PK') }],
      who: [
        { label: '🎁 Given to', id: userId },
        ...(adminId ? [{ label: '🛡️ Granted by', id: adminId }] : []),
      ],
      links: [{ label: 'Subscriptions', url: '/dashboard/subscriptions' }],
    });

    return saved;
  }

  async activate(id: string): Promise<SubscriptionDocument> {
    const subscription = await this.subscriptionModel.findById(id).exec();

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (subscription.status === 'active') {
      throw new BadRequestException('Subscription is already active');
    }

    // Get package details for duration
    const packageDoc = await this.packageModel
      .findById(subscription.packageId)
      .exec();

    if (!packageDoc) {
      throw new NotFoundException('Associated package not found');
    }

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + packageDoc.duration);

    subscription.status = 'active';
    subscription.paymentStatus = 'completed';
    subscription.startDate = startDate;
    subscription.endDate = endDate;
    subscription.reviewedAt = new Date();
    subscription.rejectionReason = '';

    /*
     * One active plan at a time. Activating this one retires whatever else was
     * still marked active for this account, or the entitlement check would
     * find the older row and apply the smaller limit.
     */
    await this.subscriptionModel
      .updateMany(
        {
          userId: subscription.userId,
          status: 'active',
          _id: { $ne: subscription._id },
        },
        { $set: { status: 'expired' } },
      )
      .exec();

    const saved = await subscription.save();
    void this.agency.refreshVerified();

    this.discord.send({
      title: '✅ Payment verified — plan active',
      description: `${saved.invoiceNumber ?? ''} · ${saved.planName ?? 'Plan'} · ${DiscordService.money(saved.amount)}`,
      url: '/dashboard/subscriptions',
      color: DISCORD_COLORS.approved,
      category: 'Payments',
      fields: [
        { name: 'Listings', value: String(saved.planPropertyLimit ?? '—') },
        { name: 'Active until', value: endDate.toLocaleDateString('en-PK') },
      ],
      who: [{ label: '👤 Agent', id: saved.userId }],
      links: [{ label: 'Subscriptions', url: '/dashboard/subscriptions' }],
    });

    this.pushEvents?.planActive({ userId: String(saved.userId), plan: saved.planName || '', endDate: saved.endDate });
    return saved;
  }

  /**
   * End a subscription early.
   *
   * An agent may cancel their own. An admin may cancel anybody's, which is
   * the half that was missing: the admin screen could activate a plan and
   * reject a payment, but once a plan was live there was no way to take it
   * back — a refund, a chargeback or an account being closed left the plan
   * running until its end date with no control over it at all.
   *
   * Cancelling takes effect immediately. findActiveSubscription only matches
   * status 'active', so the account drops to the Free tier on the next
   * request; nothing it has already published is touched.
   */
  async cancel(
    id: string,
    userId: string,
    userRole?: string,
  ): Promise<SubscriptionDocument> {
    const subscription = await this.subscriptionModel.findById(id).exec();

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (userRole !== 'ADMIN' && subscription.userId.toString() !== userId) {
      throw new ForbiddenException('You can only cancel your own subscriptions');
    }

    if (subscription.status === 'cancelled') {
      throw new BadRequestException('Subscription is already cancelled');
    }

    subscription.status = 'cancelled';
    const saved = await subscription.save();
    void this.agency.refreshVerified();

    if (userRole === 'ADMIN') {
      this.discord.send({
        title: '🚫 Plan cancelled by admin',
        description: `${saved.planName ?? 'Plan'} · ${saved.invoiceNumber ?? ''}`,
        url: '/dashboard/subscriptions',
        color: DISCORD_COLORS.review,
        category: 'Payments',
        who: [
          { label: '👤 Agent', id: saved.userId },
          { label: '🛡️ Cancelled by', id: userId },
        ],
        links: [{ label: 'Subscriptions', url: '/dashboard/subscriptions' }],
      });
    }

    return saved;
  }

  async incrementPropertyCount(
    subscriptionId: string,
  ): Promise<SubscriptionDocument> {
    const subscription = await this.subscriptionModel
      .findById(subscriptionId)
      .populate('packageId')
      .exec();

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    const packageDoc = subscription.packageId as any;

    if (!packageDoc) {
      throw new NotFoundException('Associated package not found');
    }

    if (subscription.propertiesUsed >= packageDoc.propertyLimit) {
      throw new BadRequestException(
        'Property limit exceeded for this subscription',
      );
    }

    subscription.propertiesUsed += 1;
    return subscription.save();
  }

  /**
   * A short reference both sides can quote: INV-7KQ2M41.
   *
   * Time-based rather than a counter, so two purchases in the same second do
   * not collide on a shared sequence, and retried on the tiny chance of a
   * clash.
   */
  private async nextInvoiceNumber(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = `INV-${Date.now().toString(36).toUpperCase().slice(-6)}${Math.floor(10 + Math.random() * 89)}`;
      const taken = await this.subscriptionModel.exists({ invoiceNumber: candidate });
      if (!taken) return candidate;
    }
    return `INV-${Date.now()}`;
  }

  /**
   * "I have paid" — the agent's half of the checkout.
   *
   * There is no gateway: they transfer to one of the admin's accounts and
   * upload the screenshot, which is what the admin then verifies. Re-submitting
   * is allowed on purpose, because the first screenshot is often the wrong one.
   */
  async submitPayment(
    id: string,
    userId: string,
    input: { paymentScreenshotUrl?: string; paymentMethod?: string; paymentNote?: string },
  ): Promise<SubscriptionDocument> {
    const screenshot = String(input.paymentScreenshotUrl || '').trim();
    if (!screenshot) {
      throw new BadRequestException('Please upload the payment screenshot');
    }

    const subscription = await this.subscriptionModel.findById(id).exec();
    if (!subscription) throw new NotFoundException('Invoice not found');

    if (String(subscription.userId) !== String(userId)) {
      throw new ForbiddenException('This invoice belongs to another account');
    }
    if (subscription.paymentStatus === 'completed') {
      throw new BadRequestException('This payment has already been verified');
    }

    subscription.paymentScreenshotUrl = screenshot;
    subscription.paymentMethod = String(input.paymentMethod || '').trim() || undefined;
    subscription.paymentNote = String(input.paymentNote || '').trim().slice(0, 500);
    subscription.paymentStatus = 'submitted';
    subscription.submittedAt = new Date();
    // A re-submission after a rejection starts clean.
    subscription.rejectionReason = '';

    const saved = await subscription.save();

    this.discord.send({
      title: '🧾 Payment submitted — needs verifying',
      description: `${saved.invoiceNumber ?? ''} · ${saved.planName ?? 'Plan'} · ${DiscordService.money(saved.amount)}`,
      url: '/dashboard/subscriptions',
      color: DISCORD_COLORS.money,
      category: 'Payments',
      image: screenshot,
      fields: [
        { name: 'Paid via', value: saved.paymentMethod || '—' },
        { name: 'Reference', value: saved.paymentNote || '—' },
      ],
      who: [{ label: '💳 Paid by', id: userId }],
      links: [{ label: 'Verify payment', url: '/dashboard/subscriptions' }, { label: 'Screenshot', url: screenshot }],
    });

    this.pushEvents?.paymentSubmitted({ userId: String(saved.userId), plan: saved.planName || '', amount: saved.amount });
    return saved;
  }

  /** The admin could not verify the payment. The agent sees the reason. */
  async rejectPayment(
    id: string,
    reason: string,
    adminId: string,
  ): Promise<SubscriptionDocument> {
    const subscription = await this.subscriptionModel.findById(id).exec();
    if (!subscription) throw new NotFoundException('Invoice not found');

    subscription.paymentStatus = 'failed';
    subscription.status = 'pending';
    subscription.rejectionReason =
      String(reason || '').trim().slice(0, 500) ||
      'We could not verify this payment. Please check the amount and upload the screenshot again.';
    subscription.reviewedAt = new Date();

    const saved = await subscription.save();

    this.discord.send({
      title: '🚫 Payment rejected',
      description: `${saved.invoiceNumber ?? ''} · ${saved.planName ?? 'Plan'}`,
      url: '/dashboard/subscriptions',
      color: DISCORD_COLORS.report,
      category: 'Payments',
      fields: [{ name: 'Reason', value: saved.rejectionReason || '—', inline: false }],
      who: [
        { label: '👤 Agent', id: saved.userId },
        { label: '🛡️ Reviewed by', id: adminId },
      ],
      links: [{ label: 'Subscriptions', url: '/dashboard/subscriptions' }],
    });

    this.pushEvents?.paymentRejected({ userId: String(saved.userId), plan: saved.planName || '', reason: saved.rejectionReason });
    return saved;
  }

  /**
   * The plan this account is actually on, paid or not.
   *
   * An agency's agent is on the agency's plan: the numbers are the whole
   * team's (one shared allowance), and `team.role` says which side of the
   * agency this account is. `perks` is what the plan unlocks beyond numbers.
   */
  async getEffectivePlan(userId: string): Promise<{
    tier: 'free' | 'paid';
    name: string;
    propertyLimit: number;
    used: number;
    remaining: number;
    canCreate: boolean;
    /** How many listings the team may pin. Free gets none. */
    featuredLimit: number;
    perks: PlanPerks;
    endDate: Date | null;
    team: { role: 'owner' | 'agent' | null; agencyId: string | null; members: number };
    subscription: SubscriptionDocument | null;
  }> {
    const owner = await this.agency.planOwnerOf(userId);
    const isAgent = owner !== String(userId);
    const subscription = await this.findActiveSubscription(owner);
    const used = await this.countTeamListings(owner);
    const members = (await this.agency.teamOf(owner)).length - 1;
    const team = {
      role: isAgent ? ('agent' as const) : members > 0 ? ('owner' as const) : null,
      agencyId: isAgent ? owner : null,
      members,
    };

    if (!subscription) {
      const freePkg = await this.freePackage().catch(() => null);
      const propertyLimit = freePkg ? Math.max(0, Number(freePkg.propertyLimit) || 0) : SubscriptionService.FREE_PROPERTY_LIMIT;
      return {
        tier: 'free',
        name: freePkg?.name ?? 'Free',
        propertyLimit,
        used,
        remaining: Math.max(0, propertyLimit - used),
        canCreate: used < propertyLimit,
        featuredLimit: freePkg ? Math.max(0, Number(freePkg.featuredListings) || 0) : 0,
        perks: freePkg ? perksOf(freePkg) : NO_PERKS,
        endDate: null,
        team,
        subscription: null,
      };
    }

    const packageDoc = subscription.packageId as any;
    const propertyLimit = Number(packageDoc?.propertyLimit ?? subscription.planPropertyLimit ?? 0);
    const free = Number(subscription.amount ?? 0) <= 0 && Number(packageDoc?.price ?? 0) <= 0;

    return {
      tier: free ? 'free' : 'paid',
      name: packageDoc?.name ?? subscription.planName ?? 'Subscription',
      propertyLimit,
      used,
      remaining: Math.max(0, propertyLimit - used),
      canCreate: used < propertyLimit,
      featuredLimit: Number(packageDoc?.featuredListings ?? 0),
      perks: perksOf(packageDoc),
      endDate: subscription.endDate ?? null,
      team,
      subscription,
    };
  }

  /** "May I add one more listing?" — answered for the whole team, on the plan owner's subscription. */
  async canCreateProperty(userId: string): Promise<{
    canCreate: boolean;
    subscription?: SubscriptionDocument;
    message?: string;
  }> {
    const plan = await this.getEffectivePlan(userId);
    if (plan.canCreate) {
      // An agent may also have a cap of their own, set by the agency owner.
      if (plan.team.role === 'agent') {
        // Paused by the agency: no new listings even on a session that has not run out yet.
        const me: any = await this.propertyModel.db.collection('users').findOne({ _id: new Types.ObjectId(String(userId)) }, { projection: { isActive: 1 } });
        if (me?.isActive === false) {
          return { canCreate: false, message: 'Your agency has paused this account. Please contact your agency owner.' };
        }
        const cap = await this.agentCap(userId);
        if (cap && cap.used >= cap.limit) {
          return {
            canCreate: false,
            ...(plan.subscription ? { subscription: plan.subscription } : {}),
            message: `Your agency allows you ${cap.limit} live ${cap.limit === 1 ? 'listing' : 'listings'}, and they are in use. Ask your agency owner to raise your limit, or remove one of your listings.`,
          };
        }
      }
      return { canCreate: true, ...(plan.subscription ? { subscription: plan.subscription } : {}) };
    }
    const who = plan.team.role === 'agent' ? 'Your agency' : 'Your';
    return {
      canCreate: false,
      ...(plan.subscription ? { subscription: plan.subscription } : {}),
      message:
        plan.tier === 'free' && !plan.subscription
          ? `The Free plan allows ${plan.propertyLimit} live ${plan.propertyLimit === 1 ? 'listing' : 'listings'} at a time. ` +
            (plan.team.role === 'agent' ? 'Ask your agency owner to choose a package.' : 'Choose a package to list more, or remove one of your current listings.')
          : `${who} ${plan.name} plan's limit of ${plan.propertyLimit} listings is reached.` +
            (plan.team.role === 'agent' ? ' Ask your agency owner to upgrade.' : ' Move up a plan to list more.'),
    };
  }

  /** An agent's own cap (Team → listing limit) and how much of it is in use; null when none is set. */
  async agentCap(userId: string): Promise<{ limit: number; used: number } | null> {
    if (!Types.ObjectId.isValid(String(userId))) return null;
    const u: any = await this.propertyModel.db.collection('users').findOne({ _id: new Types.ObjectId(String(userId)) }, { projection: { listingLimit: 1 } });
    const limit = Number(u?.listingLimit ?? 0);
    if (!(limit > 0)) return null;
    const used = await this.propertyModel.collection.countDocuments({
      owner: { $in: AgencyService.anyIds([String(userId)]) },
      status: { $in: ['pending', 'approved'] },
    });
    return { limit, used };
  }

  private profileCache = new Map<string, { at: number; on: boolean }>();

  /** Does this account have a public profile page? Every active account does, whatever the plan. Cached for five minutes. */
  async hasProfilePage(userId: string): Promise<boolean> {
    const id = String(userId ?? '');
    if (!Types.ObjectId.isValid(id)) return false;
    const hit = this.profileCache.get(id);
    if (hit && Date.now() - hit.at < 300_000) return hit.on;
    const u: any = await this.propertyModel.db.collection('users').findOne({ _id: new Types.ObjectId(id) }, { projection: { role: 1 } });
    const on = !!u;
    this.profileCache.set(id, { at: Date.now(), on });
    return on;
  }

  async decrementPropertyCount(subscriptionId: string): Promise<SubscriptionDocument | null> {
    const subscription = await this.subscriptionModel.findById(subscriptionId).exec();

    if (!subscription) {
      // Just log warning, don't throw as this is usually called during rollback
      console.warn(`Attempted to decrement count for non-existent subscription: ${subscriptionId}`);
      return null;
    }

    if (subscription.propertiesUsed > 0) {
      subscription.propertiesUsed -= 1;
      return subscription.save();
    }
    
    return subscription;
  }

  /** Keep the subscription's counter equal to the team's real listing count. `actualCount` is ignored (kept for callers). */
  async syncPropertyUsage(userId: string, _actualCount?: number): Promise<void> {
    const owner = await this.agency.planOwnerOf(userId);
    const subscription = await this.findActiveSubscription(owner);
    if (!subscription) return;
    const team = await this.agency.teamOf(owner);
    const count = await this.propertyModel.collection.countDocuments({ owner: { $in: AgencyService.anyIds(team) } });
    if (subscription.propertiesUsed !== count) {
      subscription.propertiesUsed = count;
      await subscription.save();
    }
  }

  /**
   * Every account with the plan it is on — for the admin's Subscriptions
   * screen. Accounts on Free have no subscription row (Free is simply "no
   * paid plan"), so a list of subscriptions alone never showed them.
   * Paged and searched in the database, not in the browser.
   */
  async listAccounts(q: { search?: string; plan?: string; page?: number; limit?: number }) {
    const users = this.subscriptionModel.db.collection('users');
    const limit = Math.min(100, Math.max(5, Number(q.limit) || 25));
    const page = Math.max(1, Number(q.page) || 1);
    const filter: Record<string, any> = { role: { $ne: 'ADMIN' } };

    const search = String(q.search ?? '').trim();
    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: rx }, { email: rx }, { phone: rx }, { companyName: rx }];
    }

    const now = new Date();
    if (q.plan === 'paid' || q.plan === 'free') {
      const paid = await this.subscriptionModel
        .find({ status: 'active', endDate: { $gt: now }, amount: { $gt: 0 } })
        .distinct('userId');
      const granted = await this.subscriptionModel
        .find({ status: 'active', endDate: { $gt: now }, paymentMethod: 'Granted by admin' })
        .distinct('userId');
      // userId is stored as a string on some rows and an ObjectId on others.
      const ids = AgencyService.anyIds([...paid, ...granted].map(String));
      filter._id = q.plan === 'paid' ? { $in: ids } : { $nin: ids };
    } else if (q.plan === 'pending') {
      const ids = await this.subscriptionModel
        .find({ status: 'pending', paymentStatus: { $in: ['pending', 'submitted'] } })
        .distinct('userId');
      filter._id = { $in: AgencyService.anyIds(ids.map(String)) };
    }

    const [total, rows] = await Promise.all([
      users.countDocuments(filter),
      users
        .find(filter, { projection: { name: 1, email: 1, phone: 1, role: 1, companyName: 1, avatarUrl: 1, isActive: 1, createdAt: 1, agencyId: 1 } })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
    ]);

    const ids = rows.map((u) => u._id as Types.ObjectId);
    const idStrings = ids.map(String);
    const [active, pending, listings, teams] = await Promise.all([
      this.subscriptionModel
        .find({ userId: { $in: [...ids, ...idStrings] }, status: 'active', endDate: { $gt: now } })
        .populate('packageId', 'name price')
        .lean()
        .exec(),
      this.subscriptionModel
        .find({ userId: { $in: [...ids, ...idStrings] }, status: 'pending', paymentStatus: { $in: ['pending', 'submitted'] } })
        .select('userId paymentStatus planName amount')
        .lean()
        .exec(),
      this.propertyModel.collection
        .aggregate([
          { $match: { owner: { $in: [...ids, ...idStrings] } } },
          { $group: { _id: { $toString: '$owner' }, total: { $sum: 1 }, live: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } } } },
        ])
        .toArray(),
      users
        .aggregate([
          { $match: { agencyId: { $in: [...ids, ...idStrings] } } },
          { $group: { _id: { $toString: '$agencyId' }, n: { $sum: 1 } } },
        ])
        .toArray(),
    ]);
    const verified = await this.agency.verifiedIds().catch(() => new Set<string>());
    const agencyIds = [...new Set(rows.map((u: any) => (u.agencyId ? String(u.agencyId) : '')).filter(Boolean))];
    const agencies = agencyIds.length
      ? await users.find({ _id: { $in: agencyIds.map((i) => new Types.ObjectId(i)) } }, { projection: { name: 1, companyName: 1, email: 1 } }).toArray()
      : [];

    return {
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      rows: rows.map((u: any) => {
        const id = String(u._id);
        const sub: any = active.find((a: any) => String(a.userId) === id);
        const inv: any = pending.find((p: any) => String(p.userId) === id);
        const l: any = listings.find((x: any) => x._id === id);
        const agency: any = u.agencyId ? agencies.find((a: any) => String(a._id) === String(u.agencyId)) : null;
        return {
          _id: id,
          name: u.name ?? '',
          email: u.email,
          phone: u.phone ?? '',
          role: u.role,
          companyName: u.companyName ?? '',
          avatarUrl: u.avatarUrl ?? '',
          verified: verified.has(id),
          isActive: u.isActive !== false,
          createdAt: u.createdAt,
          plan: sub
            ? { name: sub.packageId?.name ?? sub.planName ?? 'Plan', endDate: sub.endDate, paid: Number(sub.amount ?? 0) > 0, granted: sub.paymentMethod === 'Granted by admin', subscriptionId: String(sub._id) }
            : agency
              ? { name: 'Agency plan', endDate: null, paid: false, granted: false, subscriptionId: null }
              : { name: 'Free', endDate: null, paid: false, granted: false, subscriptionId: null },
          pendingInvoice: inv ? { status: inv.paymentStatus, planName: inv.planName, amount: inv.amount } : null,
          listings: { total: l?.total ?? 0, live: l?.live ?? 0 },
          teamSize: teams.find((t: any) => t._id === id)?.n ?? 0,
          agency: agency ? { _id: String(agency._id), name: agency.companyName || agency.name || agency.email || 'an agency' } : null,
        };
      }),
    };
  }
}

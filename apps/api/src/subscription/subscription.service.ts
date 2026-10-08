import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Subscription,
  SubscriptionDocument,
} from '@rent-ghar/db/schemas/subscription.schema';
import { Package, PackageDocument } from '@rent-ghar/db/schemas/package.schema';
import { Property } from '@rent-ghar/db/schemas/property.schema';
import { CreateSubscriptionDto } from '@rent-ghar/types/subscription';
import { DiscordService, DISCORD_COLORS } from '../notify/discord.service';

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
  ) {}

  /**
   * Live listings allowed without a paid package.
   *
   * Deliberately a constant rather than a Setting lookup: it is read on every
   * "add property" attempt, and one is the number that makes the dashboard
   * usable on day one while still leaving a reason to buy a package.
   */
  static readonly FREE_PROPERTY_LIMIT = 1;

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

    // Check if user already has an active subscription
    const existingSubscription = await this.subscriptionModel
      .findOne({
        userId,
        status: 'active',
        endDate: { $gt: new Date() },
      })
      .exec();

    if (existingSubscription) {
      throw new BadRequestException(
        'You already have an active subscription. Please wait for it to expire or cancel it before purchasing a new one.',
      );
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
     * A purchase arrives as "pending" and an admin activates it, so this alert
     * is the only thing standing between an agent paying and somebody
     * noticing. The link goes straight to the subscriptions screen.
     */
    this.discord.send({
      title: '💳 Package purchased — needs activating',
      description: `${packageDoc.name} · ${DiscordService.money(packageDoc.price)}`,
      url: '/dashboard/subscriptions',
      color: DISCORD_COLORS.money,
      fields: [
        { name: 'Listings included', value: String(packageDoc.propertyLimit ?? '—') },
        { name: 'Duration', value: packageDoc.duration ? `${packageDoc.duration} days` : '—' },
        { name: 'Buyer id', value: `\`${userId}\``, inline: false },
        { name: 'Subscription id', value: `\`${saved._id.toString()}\``, inline: false },
      ],
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
        userId,
        status: 'active',
        endDate: { $gt: new Date() },
      })
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

    this.discord.send({
      title: '✅ Payment verified — plan active',
      description: `${saved.invoiceNumber ?? ''} · ${saved.planName ?? 'Plan'} · ${DiscordService.money(saved.amount)}`,
      url: '/dashboard/subscriptions',
      color: DISCORD_COLORS.approved,
      fields: [
        { name: 'Listings', value: String(saved.planPropertyLimit ?? '—') },
        { name: 'Active until', value: endDate.toLocaleDateString('en-PK') },
      ],
    });

    return saved;
  }

  async cancel(id: string, userId: string): Promise<SubscriptionDocument> {
    const subscription = await this.subscriptionModel.findById(id).exec();

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    // Verify user owns this subscription
    if (subscription.userId.toString() !== userId) {
      throw new ForbiddenException('You can only cancel your own subscriptions');
    }

    if (subscription.status === 'cancelled') {
      throw new BadRequestException('Subscription is already cancelled');
    }

    subscription.status = 'cancelled';
    return subscription.save();
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
      fields: [
        { name: 'Paid via', value: saved.paymentMethod || '—' },
        { name: 'Reference', value: saved.paymentNote || '—' },
        { name: 'Screenshot', value: this.discord.link(screenshot), inline: false },
        { name: 'Buyer id', value: `\`${userId}\``, inline: false },
      ],
    });

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
      color: DISCORD_COLORS.report,
      fields: [
        { name: 'Reason', value: saved.rejectionReason || '—', inline: false },
        { name: 'Reviewed by', value: `\`${adminId}\``, inline: false },
      ],
    });

    return saved;
  }

  /**
   * The plan this account is actually on, paid or not.
   *
   * canCreateProperty() answers "may I add one more?"; this answers "what do I
   * have?", which is what the My Subscription screen needs. Without it that
   * screen said "No active subscription — buy a package to start publishing"
   * to every new agent, while the API was perfectly willing to publish their
   * first listing. Same free-tier rule in both places, read from one method.
   */
  async getEffectivePlan(userId: string): Promise<{
    tier: 'free' | 'paid';
    name: string;
    propertyLimit: number;
    used: number;
    remaining: number;
    canCreate: boolean;
    subscription: SubscriptionDocument | null;
  }> {
    const subscription = await this.findActiveSubscription(userId);

    if (!subscription) {
      const propertyLimit = SubscriptionService.FREE_PROPERTY_LIMIT;
      const used = await this.propertyModel.countDocuments({
        owner: userId,
        status: { $in: ['pending', 'approved'] },
      });

      return {
        tier: 'free',
        name: 'Free',
        propertyLimit,
        used,
        remaining: Math.max(0, propertyLimit - used),
        canCreate: used < propertyLimit,
        subscription: null,
      };
    }

    const packageDoc = subscription.packageId as any;
    const propertyLimit = Number(packageDoc?.propertyLimit ?? 0);
    const used = Number(subscription.propertiesUsed ?? 0);

    return {
      tier: 'paid',
      name: packageDoc?.name ?? 'Subscription',
      propertyLimit,
      used,
      remaining: Math.max(0, propertyLimit - used),
      canCreate: used < propertyLimit,
      subscription,
    };
  }

  async canCreateProperty(userId: string): Promise<{
    canCreate: boolean;
    subscription?: SubscriptionDocument;
    message?: string;
  }> {
    console.log('Checking subscription for userId:', userId);
    const subscription = await this.findActiveSubscription(userId);
    console.log('Subscription found:', subscription ? subscription._id : 'null');

    if (!subscription) {
      /*
       * Everyone starts on the Free plan.
       *
       * This used to refuse outright — a brand-new agent signed up, went to
       * add their first property and was told to buy a package before they had
       * seen the dashboard do anything. Rather than writing a subscription row
       * at sign-up (which would need a migration for every existing account,
       * and would go stale), the entitlement simply falls back to a free tier
       * when there is no paid one. Existing users get it too, with no backfill.
       */
      const freeLimit = SubscriptionService.FREE_PROPERTY_LIMIT;
      const used = await this.propertyModel.countDocuments({
        owner: userId,
        status: { $in: ['pending', 'approved'] },
      });

      if (used >= freeLimit) {
        return {
          canCreate: false,
          message:
            `The Free plan allows ${freeLimit} live ${freeLimit === 1 ? 'listing' : 'listings'} at a time. ` +
            'Choose a package to list more, or remove one of your current listings.',
        };
      }

      return { canCreate: true };
    }

    const packageDoc = subscription.packageId as any;

    if (!packageDoc) {
      return {
        canCreate: false,
        subscription,
        message: 'Associated package not found.',
      };
    }

    if (subscription.propertiesUsed >= packageDoc.propertyLimit) {
      return {
        canCreate: false,
        subscription,
        message: `Property limit (${packageDoc.propertyLimit}) reached for your current package.`,
      };
    }

    return {
      canCreate: true,
      subscription,
    };
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

  async syncPropertyUsage(userId: string, actualCount: number): Promise<void> {
    const subscription = await this.findActiveSubscription(userId);
    if (subscription) {
      if (subscription.propertiesUsed !== actualCount) {
        console.log(`Syncing property usage for user ${userId}. correct: ${actualCount}, current: ${subscription.propertiesUsed}`);
        subscription.propertiesUsed = actualCount;
        await subscription.save();
      }
    }
  }
}

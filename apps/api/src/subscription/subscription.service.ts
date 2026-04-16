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
import { CreateSubscriptionDto } from '@rent-ghar/types/subscription';

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(Package.name)
    private packageModel: Model<PackageDocument>,
  ) {}

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

    // Create subscription with pending status
    const subscription = new this.subscriptionModel({
      userId,
      packageId: dto.packageId,
      status: 'pending',
      paymentStatus: 'pending',
    });

    return subscription.save();
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

    return subscription.save();
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

  async canCreateProperty(userId: string): Promise<{
    canCreate: boolean;
    subscription?: SubscriptionDocument;
    message?: string;
  }> {
    console.log('Checking subscription for userId:', userId);
    const subscription = await this.findActiveSubscription(userId);
    console.log('Subscription found:', subscription ? subscription._id : 'null');

    if (!subscription) {
      return {
        canCreate: false,
        message: 'No active subscription found. Please purchase a package to list properties.',
      };
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

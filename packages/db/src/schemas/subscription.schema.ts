import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SubscriptionDocument = Subscription & Document;

@Schema({ timestamps: true })
export class Subscription {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Package', required: true })
  packageId: Types.ObjectId;

  @Prop({
    required: true,
    enum: ['pending', 'active', 'expired', 'cancelled'],
    default: 'pending',
  })
  status: 'pending' | 'active' | 'expired' | 'cancelled';

  @Prop()
  startDate?: Date;

  @Prop()
  endDate?: Date;

  @Prop({ default: 0 })
  propertiesUsed: number; // Track listing count

  /**
   * The payment's own life, separate from the subscription's.
   *
   * 'pending'   — bought, nothing sent yet (the checkout page is waiting)
   * 'submitted' — the agent has paid and uploaded the proof; admin's turn
   * 'completed' — admin verified it; the subscription is active
   * 'failed'    — admin could not verify it (see rejectionReason)
   *
   * 'submitted' is what turns this from a guess into a queue: before it, an
   * admin had no way to tell "someone clicked buy" from "someone has paid".
   */
  @Prop({
    required: true,
    enum: ['pending', 'submitted', 'completed', 'failed'],
    default: 'pending',
  })
  paymentStatus: 'pending' | 'submitted' | 'completed' | 'failed';

  @Prop()
  paymentMethod?: string; // Which of the admin's accounts was used

  @Prop()
  transactionId?: string;

  /* ── The invoice half ── */

  /** Human reference both sides can quote: INV-7KQ2M41. */
  @Prop({ index: true })
  invoiceNumber?: string;

  /**
   * Price at the time of purchase, with the plan's name and terms.
   *
   * Snapshotted on purpose: the admin may edit or delete the package later,
   * and an invoice that silently changes its own amount is not an invoice.
   */
  @Prop({ default: 0 })
  amount?: number;

  @Prop({ default: '' })
  planName?: string;

  @Prop({ default: 0 })
  planPropertyLimit?: number;

  @Prop({ default: 0 })
  planDurationDays?: number;

  /** The payment screenshot, uploaded through the media library. */
  @Prop()
  paymentScreenshotUrl?: string;

  /** Transaction id, sender number, or whatever the agent typed. */
  @Prop({ default: '' })
  paymentNote?: string;

  /** Why the admin could not verify it — shown to the agent so they can fix it. */
  @Prop({ default: '' })
  rejectionReason?: string;

  @Prop()
  submittedAt?: Date;

  @Prop()
  reviewedAt?: Date;
}

export const SubscriptionSchema =
  SchemaFactory.createForClass(Subscription);

// The admin's payment queue: submitted first, newest first.
SubscriptionSchema.index({ paymentStatus: 1, createdAt: -1 });

// "What am I on right now?" — the entitlement lookup on every property create.
SubscriptionSchema.index({ userId: 1, status: 1, endDate: -1 });

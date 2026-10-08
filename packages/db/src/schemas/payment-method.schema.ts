import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * Where an agent sends the money.
 *
 * There is no card gateway here, and for this market that is the right call:
 * agents pay by JazzCash, Easypaisa or a bank transfer and then send a
 * screenshot. So the accounts live in the database, the admin edits them from
 * the dashboard, and the checkout page simply lists whatever is active —
 * changing a bank account must never need a deploy.
 */

export const PAYMENT_METHOD_TYPES = [
  'jazzcash',
  'easypaisa',
  'bank',
  'other',
] as const;

export type PaymentMethodType = (typeof PAYMENT_METHOD_TYPES)[number];

export type PaymentMethodDocument = PaymentMethod & Document;

@Schema({ timestamps: true })
export class PaymentMethod {
  /** What the agent sees: "JazzCash", "Meezan Bank". */
  @Prop({ required: true, trim: true })
  label: string;

  @Prop({ required: true, enum: PAYMENT_METHOD_TYPES, default: 'other' })
  type: PaymentMethodType;

  /** The mobile number or IBAN / account number to send to. */
  @Prop({ required: true, trim: true })
  accountNumber: string;

  /** The name the account is registered in — people check this before sending. */
  @Prop({ default: '', trim: true })
  accountTitle: string;

  /** Anything else: branch, "send screenshot to this WhatsApp", a deadline. */
  @Prop({ default: '', trim: true })
  instructions: string;

  /** Switched off rather than deleted, so old invoices still make sense. */
  @Prop({ default: true, index: true })
  isActive: boolean;

  @Prop({ default: 0 })
  order: number;
}

export const PaymentMethodSchema = SchemaFactory.createForClass(PaymentMethod);

// The checkout list: active ones, in the admin's chosen order.
PaymentMethodSchema.index({ isActive: 1, order: 1 });

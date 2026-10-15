import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * A construction-materials shop order.
 *
 * The collection started as cement-only ("cement orders"), and it keeps its
 * name so every existing order stays where it is. It now holds orders for any
 * material the site sells — cement, steel, bricks, sand, bajri, wood, doors,
 * tiles — priced on the server from the live rate, never from the browser.
 *
 * Fields added later are optional, so documents written before them still
 * load: old orders simply have no order number, no item type and no history.
 */

export type CementOrderDocument = CementOrder & Document;

export const ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

@Schema({ _id: false })
export class CementOrderItem {
  /** cement | steel | bricks | sand | bajri | wood | door | tile */
  @Prop()
  type?: string;

  @Prop({ required: true })
  brand: string;

  @Prop({ required: true })
  productId: string;

  @Prop()
  title?: string;

  /** "50 kg bag", "Per ton", "Per 1000"… */
  @Prop()
  unit?: string;

  @Prop()
  city?: string;

  @Prop()
  weightKg?: number;

  /** Unit price at the moment the order was placed. */
  @Prop({ required: true })
  price: number;

  @Prop({ required: true })
  quantity: number;

  @Prop()
  image?: string;

  /** The product page, for the admin's "open product" link. */
  @Prop()
  href?: string;
}
export const CementOrderItemSchema = SchemaFactory.createForClass(CementOrderItem);

@Schema({ _id: false })
export class OrderStatusChange {
  @Prop({ required: true })
  status: string;

  @Prop({ required: true, default: () => new Date() })
  at: Date;

  /** Admin's user id, or "customer" / "system". */
  @Prop()
  by?: string;

  @Prop()
  note?: string;
}
export const OrderStatusChangeSchema = SchemaFactory.createForClass(OrderStatusChange);

@Schema({
  timestamps: true,
  toJSON: { virtuals: true },
})
export class CementOrder {
  /** Human-friendly reference, e.g. PD-261015-4821. Missing on old orders. */
  @Prop({ index: true, sparse: true, unique: true })
  orderNumber?: string;

  @Prop({ required: true, trim: true })
  customerName: string;

  @Prop({ trim: true, default: '' })
  customerEmail?: string;

  /** Signed-in buyer's id; empty for guest orders. */
  @Prop({ default: '' })
  userId?: string;

  @Prop({ required: true, trim: true })
  customerPhone: string;

  @Prop({ trim: true })
  customerCity?: string;

  @Prop({ required: true, trim: true })
  address: string;

  @Prop({ trim: true })
  deliveryInstruction?: string;

  @Prop({ type: [CementOrderItemSchema], required: true })
  items: CementOrderItem[];

  @Prop({ required: true })
  subTotal: number;

  @Prop({ required: true })
  deliveryCharges: number;

  @Prop({ required: true })
  total: number;

  @Prop({ enum: ORDER_STATUSES, default: 'PENDING', index: true })
  status: string;

  @Prop({ required: true, default: 'cod' })
  paymentMethod: string;

  @Prop({ enum: ['unpaid', 'paid', 'refunded'], default: 'unpaid' })
  paymentStatus?: string;

  /** Internal note, never shown to the customer. */
  @Prop({ trim: true, default: '' })
  adminNote?: string;

  @Prop({ type: [OrderStatusChangeSchema], default: [] })
  statusHistory?: OrderStatusChange[];
}

export const CementOrderSchema = SchemaFactory.createForClass(CementOrder);
CementOrderSchema.index({ createdAt: -1 });
CementOrderSchema.index({ customerPhone: 1 });

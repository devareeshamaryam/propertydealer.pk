import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type CementOrderDocument = CementOrder & Document;

@Schema({ _id: false })
export class CementOrderItem {
  @Prop({ required: true })
  brand: string;

  @Prop({ required: true })
  productId: string;

  @Prop({ required: true })
  city: string;

  @Prop({ required: true })
  weightKg: number;

  @Prop({ required: true })
  price: number;

  @Prop({ required: true })
  quantity: number;

  @Prop()
  image?: string;
}
export const CementOrderItemSchema = SchemaFactory.createForClass(CementOrderItem);

@Schema({
  timestamps: true,
  toJSON: { virtuals: true },
})
export class CementOrder {
  @Prop({ required: true, trim: true })
  customerName: string;

  @Prop({ required: true, trim: true })
  customerEmail: string;

  @Prop({ required: true })
  userId: string;

  @Prop({ required: true, trim: true })
  customerPhone: string;

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

  @Prop({ enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED'], default: 'PENDING' })
  status: string;

  @Prop({ required: true, default: 'cod' })
  paymentMethod: string;
}

export const CementOrderSchema = SchemaFactory.createForClass(CementOrder);
CementOrderSchema.index({ createdAt: -1 });

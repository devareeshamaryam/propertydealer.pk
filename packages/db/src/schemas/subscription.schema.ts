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

  @Prop({
    required: true,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
  })
  paymentStatus: 'pending' | 'completed' | 'failed';

  @Prop()
  paymentMethod?: string; // For future payment integration

  @Prop()
  transactionId?: string;
}

export const SubscriptionSchema =
  SchemaFactory.createForClass(Subscription);

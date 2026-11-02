import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/**
 * "Find a property for me": a visitor tells us what they want and how to
 * reach them, and the team looks for it. Kept in the admin panel
 * (Dashboard → Property requests) and announced on Discord.
 */
export type PropertyRequestDocument = HydratedDocument<PropertyRequest>;

@Schema({ timestamps: true, collection: 'propertyrequests' })
export class PropertyRequest {
  @Prop({ type: String, required: true, trim: true, maxlength: 80 })
  name: string;

  /** Normalised to 03XXXXXXXXX. */
  @Prop({ type: String, required: true, index: true })
  phone: string;

  @Prop({ type: Boolean, default: true })
  whatsapp: boolean;

  @Prop({ type: String, enum: ['sale', 'rent'], default: 'sale' })
  purpose: string;

  /** house, plot, flat, commercial, shop, office, farmhouse, any. */
  @Prop({ type: String, default: 'any' })
  type: string;

  @Prop({ type: String, default: '' })
  city: string;

  /** Areas or societies, as written or picked. */
  @Prop({ type: String, default: '' })
  areas: string;

  @Prop({ type: Number, default: null })
  minPrice: number | null;

  @Prop({ type: Number, default: null })
  maxPrice: number | null;

  /** Size in marla (1 kanal = 20). */
  @Prop({ type: Number, default: null })
  minMarla: number | null;

  @Prop({ type: Number, default: null })
  maxMarla: number | null;

  @Prop({ type: Number, default: null })
  beds: number | null;

  /** asap, 1month, 3months, exploring. */
  @Prop({ type: String, default: '' })
  timeline: string;

  @Prop({ type: String, default: '', maxlength: 1000 })
  notes: string;

  /** Signed in when they asked. */
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  userId: Types.ObjectId | null;

  /** new → contacted → found / closed. */
  @Prop({ type: String, enum: ['new', 'contacted', 'found', 'closed'], default: 'new', index: true })
  status: string;

  @Prop({ type: String, default: '', maxlength: 1000 })
  adminNote: string;

  /** Where it came from: the page, the assistant… */
  @Prop({ type: String, default: 'page' })
  source: string;

  @Prop({ type: String, default: '' })
  ip: string;
}

export const PropertyRequestSchema = SchemaFactory.createForClass(PropertyRequest);
PropertyRequestSchema.index({ createdAt: -1 });

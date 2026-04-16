import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { City } from './city.schema';
import { Types } from 'mongoose';
import { Document } from 'mongoose';

export type AreaDocument = Area & Document;

@Schema({ timestamps: true })
export class Area {
  @Prop({ required: true, lowercase: true, trim: true })
  name: string;

  @Prop({ required: true, lowercase: true, trim: true })
  areaSlug: string;

  @Prop({ type: Types.ObjectId, ref: 'City', required: true, index: true })
  city: Types.ObjectId | City;

  @Prop({ trim: true })
  metaTitle?: string;

  @Prop({ trim: true })
  metaDescription?: string;

  @Prop({ trim: true })
  canonicalUrl?: string;

  @Prop({ trim: true })
  description?: string; // Rich Text (general)

  // Rent-specific SEO & content
  @Prop({ trim: true })
  rentMetaTitle?: string;

  @Prop({ trim: true })
  rentMetaDescription?: string;

  @Prop({ trim: true })
  rentContent?: string; // Rich Text for rent pages

  // Sale-specific SEO & content
  @Prop({ trim: true })
  saleMetaTitle?: string;

  @Prop({ trim: true })
  saleMetaDescription?: string;

  @Prop({ trim: true })
  saleContent?: string; // Rich Text for sale pages

  // Properties are optional - an area can exist without properties initially
  // Properties will reference the area, not the other way around
}

export const AreaSchema = SchemaFactory.createForClass(Area);

// Create compound index to ensure area names are unique per city
AreaSchema.index({ name: 1, city: 1 }, { unique: true });
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

  // 🆕 Size-specific SEO content (2 Marla, 3 Marla, 5 Marla, 10 Marla, 1 Kanal)
  @Prop({
    type: [{
      size: {
        type: String,
        enum: ['2marla', '3marla', '5marla', '10marla', '1kanal'],
        required: true,
      },
      purpose: { type: String, enum: ['rent', 'sale', 'all'], required: true },
      metaTitle: String,
      metaDescription: String,
      content: String,
    }],
    default: [],
  })
  sizeContents?: {
    size: '2marla' | '3marla' | '5marla' | '10marla' | '1kanal';
    purpose: 'rent' | 'sale' | 'all';
    metaTitle?: string;
    metaDescription?: string;
    content?: string;
  }[];

  // Properties are optional - an area can exist without properties initially
  // Properties will reference the area, not the other way around
}

export const AreaSchema = SchemaFactory.createForClass(Area);

// Create compound index to ensure area names are unique per city
AreaSchema.index({ name: 1, city: 1 }, { unique: true });
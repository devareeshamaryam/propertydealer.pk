 import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
export type CityDocument = City & Document;

@Schema({ timestamps: true })
export class City {
  @Prop({ required: true, nameCase: true, trim: true })
  name: string;

  @Prop({ required: false, lowercase: true, trim: true })
  areaSlug?: string;

  @Prop({ required: false, lowercase: true, trim: true })
  state?: string;

  @Prop({ required: false, lowercase: true, trim: true })
  country?: string;

  @Prop({ trim: true })
  metaTitle?: string;

  @Prop({ trim: true })
  metaDescription?: string;

  @Prop({ trim: true })
  canonicalUrl?: string;

  @Prop({ trim: true })
  rentMetaTitle?: string;

  @Prop({ trim: true })
  rentMetaDescription?: string;

  @Prop({ trim: true })
  saleMetaTitle?: string;

  @Prop({ trim: true })
  saleMetaDescription?: string;

  @Prop({ trim: true })
  description?: string; // Rich Text

  @Prop({ trim: true })
  rentContent?: string; // Rich Text for Rent

  @Prop({ trim: true })
  saleContent?: string; // Rich Text for Sale

  @Prop({ trim: true })
  buyContent?: string; // Rich Text for Buy

  @Prop({
    type: [{
      propertyType: { type: String, required: true },
      purpose: { type: String, enum: ['rent', 'sale', 'all'], required: true },
      metaTitle: String,
      metaDescription: String,
      content: String,
    }],
    default: [],
  })
  typeContents?: {
    propertyType: string;
    purpose: 'rent' | 'sale' | 'all';
    metaTitle?: string;
    metaDescription?: string;
    content?: string;
  }[];

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

  @Prop({ trim: true })
  thumbnail?: string; // City Image URL
}

export const CitySchema = SchemaFactory.createForClass(City);

// Create unique index on name only - city names must be unique globally
CitySchema.index({ name: 1 }, { unique: true });
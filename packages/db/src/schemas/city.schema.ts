import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
export type CityDocument = City & Document;

@Schema({ timestamps: true })
export class City {
  @Prop({ required: true, nameCase: true, trim: true })
  name: string;

  @Prop({ required: false, lowercase: true , trim: true})
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
      content: String
    }],
    default: []
  })
  typeContents?: {
    propertyType: string;
    purpose: 'rent' | 'sale' | 'all';
    metaTitle?: string;
    metaDescription?: string;
    content?: string;
  }[];

  @Prop({ trim: true })
  thumbnail?: string; // City Image URL

  // Areas are optional - a city can exist without areas initially
  // Areas will reference the city, not the other way around
}

export const CitySchema = SchemaFactory.createForClass(City);

// Create unique index on name only - city names must be unique globally
CitySchema.index({ name: 1 }, { unique: true });
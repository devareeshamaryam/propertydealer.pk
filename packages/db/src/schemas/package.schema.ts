import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PackageDocument = Package & Document;

@Schema({ timestamps: true })
export class Package {
  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  price: number; // PKR

  @Prop({ required: true })
  duration: number; // Duration in days

  @Prop({ required: true })
  propertyLimit: number; // Max properties allowed

  @Prop({ default: 0 })
  featuredListings: number; // Number of featured listings

  @Prop({ default: 5 })
  photosPerProperty: number; // Max photos per property

  @Prop({ default: true })
  isActive: boolean; // Whether package can be purchased

  @Prop({ type: [String], default: [] })
  features: string[]; // Additional features list
}

export const PackageSchema = SchemaFactory.createForClass(Package);

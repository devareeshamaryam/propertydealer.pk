 import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CementRateDocument = CementRate & Document;

@Schema({
  timestamps: true,
  toJSON: { virtuals: true },
})
export class CementRate {
  @Prop({ required: true, trim: true })
  brand: string;

  @Prop({ unique: true, lowercase: true, index: true })
  slug: string;

  @Prop({ trim: true })
  title: string;

  @Prop({ required: true })
  price: number;

  @Prop({ default: 0 })
  change: number;

  @Prop({ required: true, trim: true })
  city: string;

  @Prop({ default: 50 })
  weightKg: number;

  @Prop({ enum: ['OPC Cement', 'SRC Cement', 'White Cement', 'Sulphate Resistant'], default: 'OPC Cement' })
  category: string;

  @Prop({ trim: true })
  image?: string;         // main/first image

  @Prop({ type: [String], default: [] })
  images: string[];       // ✅ additional images array

  @Prop({ type: String })
  description?: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const CementRateSchema = SchemaFactory.createForClass(CementRate);

CementRateSchema.pre('save', function () {
  if (this.isModified('brand') || !this.slug) {
    this.slug = this.brand
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  if (!this.title) {
    this.title = `${this.brand} — ${this.weightKg} Kg Bag`;
  }
});

CementRateSchema.index({ city: 1, category: 1 });
CementRateSchema.index({ isActive: 1, createdAt: -1 });
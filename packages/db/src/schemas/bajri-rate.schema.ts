import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BajriRateDocument = BajriRate & Document;

@Schema({
  timestamps: true,
  toJSON: { virtuals: true },
})
export class BajriRate {
  @Prop({ required: true, trim: true })
  brand: string;

  @Prop({ lowercase: true, index: true })
  slug: string;

  @Prop({ trim: true })
  title: string;

  @Prop({ required: true })
  price: number;

  @Prop({ default: 0 })
  change: number;

  @Prop({ required: true, trim: true })
  city: string;

  @Prop({ default: 'Per Cubic Foot' })
  unit: string;

  @Prop({ trim: true })
  category?: string;

  @Prop({ trim: true })
  image?: string;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ type: String })
  description?: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const BajriRateSchema = SchemaFactory.createForClass(BajriRate);

BajriRateSchema.pre('save', function () {
  if (this.isModified('brand') || !this.slug) {
    this.slug = this.brand
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  if (!this.title) {
    this.title = `${this.brand} — ${this.unit}`;
  }
});

BajriRateSchema.index({ city: 1, category: 1 });
BajriRateSchema.index({ isActive: 1, createdAt: -1 });

 import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TileCategoryDocument = TileCategory & Document;

@Schema({ timestamps: true })
export class TileCategory {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  slug: string;

  @Prop({ trim: true })
  image: string;

  @Prop({ default: 0 })
  order: number;

  @Prop({ default: true })
  isActive: boolean;

  @Prop([
    {
      name: { type: String, required: true },
      slug: { type: String, required: true },
    },
  ])
  subcategories: { name: string; slug: string }[];
}

export const TileCategorySchema = SchemaFactory.createForClass(TileCategory);

// ✅ pre('validate') + null check
TileCategorySchema.pre('validate', function (next) {
  if (this.name && !this.slug) {
    this.slug = (this.name as string)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  next();
});
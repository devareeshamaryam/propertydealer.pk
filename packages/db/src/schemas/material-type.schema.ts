import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MaterialTypeDocument = MaterialType & Document;

/**
 * A construction material the admin adds from the dashboard (Marble, Glass,
 * Paint…) — next to the eight built in. Its rates live in the material-rate
 * collection with `materialType` = this slug, and it gets everything the
 * built-in ones have: /today-<slug>-rate-in-pakistan, a page per product, a
 * place in the menu, the footer, the shop and the sitemap.
 */
@Schema({ timestamps: true, collection: 'materialtypes' })
export class MaterialType {
  /** "Marble" — the material's name. */
  @Prop({ required: true, trim: true })
  name: string;

  /** "marble" — in the address /today-marble-rate-in-pakistan. Never changes once set. */
  @Prop({ required: true, trim: true, lowercase: true, unique: true, index: true })
  slug: string;

  /** The unit a new rate starts with: "Per sq ft", "Per bag"… */
  @Prop({ trim: true, default: 'Per unit' })
  unit: string;

  /** One or two lines shown under the page heading. */
  @Prop({ trim: true, default: '' })
  description: string;

  /** The page's text (HTML), below the rates. */
  @Prop({ default: '' })
  content: string;

  @Prop({ trim: true, default: '' })
  metaTitle: string;

  @Prop({ trim: true, default: '' })
  metaDescription: string;

  @Prop({ trim: true, default: '' })
  image: string;

  /** Position in menus, after the built-in materials. */
  @Prop({ default: 0 })
  order: number;

  @Prop({ default: true, index: true })
  isActive: boolean;
}

export const MaterialTypeSchema = SchemaFactory.createForClass(MaterialType);

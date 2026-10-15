import { Schema, SchemaFactory, Prop } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * Site-wide settings, edited from the admin panel (Settings → General and
 * Settings → Appearance): brand colours, logo, hero, contact details, social
 * links, SEO defaults, analytics, homepage sections and the shop.
 *
 * One document, keyed "site". The fields are not declared one by one here —
 * the API keeps the list (with each field's type, limits and default) in
 * SiteSettingsService, validates everything it stores against it, and fills
 * in defaults when reading. `strict: false` lets that list grow without a
 * schema change, and keeps any value saved by an earlier version readable.
 */

export const SITE_FONTS = ['geist', 'inter', 'poppins', 'roboto', 'open-sans'] as const;
export type SiteFont = (typeof SITE_FONTS)[number];

export type SiteSettingDocument = SiteSetting & Document;

@Schema({ timestamps: true, collection: 'site_settings', strict: false })
export class SiteSetting {
  @Prop({ required: true, unique: true, default: 'site' })
  key: string;
}

export const SiteSettingSchema = SchemaFactory.createForClass(SiteSetting);

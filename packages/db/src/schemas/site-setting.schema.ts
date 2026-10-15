import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * The site's look, set from the admin panel (Settings → Appearance).
 *
 * One document, keyed "site". Every colour, the corner radius, the font and
 * the logo used to be hard-coded in CSS and components, so changing the brand
 * colour meant a code change and a deploy. The web app reads this once per
 * render of the root layout (cached, and revalidated when it is saved) and
 * turns it into CSS variables on <html>, so the whole site — public pages and
 * dashboard alike — follows whatever is saved here.
 *
 * Empty strings mean "use the built-in default".
 */

export const SITE_FONTS = ['geist', 'inter', 'poppins', 'roboto', 'open-sans'] as const;
export type SiteFont = (typeof SITE_FONTS)[number];

export type SiteSettingDocument = SiteSetting & Document;

@Schema({ timestamps: true, collection: 'site_settings' })
export class SiteSetting {
  @Prop({ required: true, unique: true, default: 'site' })
  key: string;

  /** Buttons, links, active tabs, focus rings — "#rrggbb". */
  @Prop({ default: '' })
  primaryColor: string;

  /** The dark brand colour: homepage search band and footer. */
  @Prop({ default: '' })
  darkColor: string;

  /** Base corner radius in px (cards, buttons, inputs). */
  @Prop({ default: 8 })
  radius: number;

  @Prop({ default: 'geist', enum: SITE_FONTS })
  font: SiteFont;

  /** Header logo image; empty shows the built-in mark + site name. */
  @Prop({ default: '' })
  logoUrl: string;

  /** Header logo height in px. */
  @Prop({ default: 32 })
  logoHeight: number;

  /** Footer logo (sits on the dark colour); empty uses the header logo. */
  @Prop({ default: '' })
  footerLogoUrl: string;

  @Prop({ default: '' })
  faviconUrl: string;

  /** Homepage search band. */
  @Prop({ default: '' })
  heroTitle: string;

  @Prop({ default: '' })
  heroSubtitle: string;
}

export const SiteSettingSchema = SchemaFactory.createForClass(SiteSetting);

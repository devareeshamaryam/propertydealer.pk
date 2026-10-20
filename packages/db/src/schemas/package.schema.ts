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

  /* ── Benefits the site actually enforces (all off unless set) ── */

  /** "Verified" badge on the agent's profile, listings and listing cards. */
  @Prop({ default: false })
  verifiedBadge: boolean;

  /** Agent accounts the owner can create under their agency (0 = none). */
  @Prop({ default: 0 })
  teamMembers: number;

  /** Facebook, Instagram, YouTube, TikTok, LinkedIn and website links on the profile. */
  @Prop({ default: false })
  socialLinks: boolean;

  /** Cover photo and agency branding on the profile page. */
  @Prop({ default: false })
  brandedProfile: boolean;

  /** New listings go live at once instead of waiting for review. */
  @Prop({ default: false })
  autoPublish: boolean;

  /** Shown in "Verified agencies" on the homepage and at the top of the agents list. */
  @Prop({ default: false })
  spotlight: boolean;

  /** Marked "Most popular" on the pricing cards. */
  @Prop({ default: false })
  highlight: boolean;

  /**
   * A public agent profile page (/agents/<name>-<id>) with a share link, and
   * the links to it from the account's listings. Off: no page, no link.
   */
  @Prop({ default: true })
  profilePage: boolean;
}

export const PackageSchema = SchemaFactory.createForClass(Package);

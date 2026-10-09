import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'
import { Area } from './area.schema'
// import { City } from './city.schema'

@Schema({ timestamps: true })
export class Property extends Document {
  @Prop({ required: true, enum: ['rent', 'sale'], index: true })
  listingType: 'rent' | 'sale'

  @Prop({ required: true, enum: ['house', 'apartment', 'flat', 'commercial', 'land', 'shop', 'office', 'factory', 'other', 'hotel', 'restaurant', 'plot'], index: true })
  propertyType: 'house' | 'apartment' | 'flat' | 'commercial' | 'land' | 'shop' | 'office' | 'factory' | 'other' | 'hotel' | 'restaurant' | 'plot'

  // @Prop({ required: true })
  // city: string

  @Prop({ required: true, unique: true, index: true })
  slug: string

  @Prop({ required: true })
  title: string

  @Prop({ required: true })
  location: string

  @Prop({ required: true })
  bedrooms: number

  @Prop({ required: true })
  bathrooms: number

  @Prop({ required: true })
  areaSize: number // sq ft - property size

  @Prop({ required: true })
  price: number // PKR

  @Prop({ type: Number, default: 0 })
  marla?: number

  @Prop({ type: Number, default: 0 })
  kanal?: number

  @Prop({ required: true })
  description: string

  @Prop({ required: true })
  contactNumber: string

  @Prop({ type: String })
  whatsappNumber?: string

  @Prop({ type: [String], default: [] })
  features: string[]
  
  // Relations 
  @Prop({ type: Types.ObjectId, ref: 'Area', required: false, index: true })
  area?: Types.ObjectId | Area | null;

  // @Prop({ type: Types.ObjectId, ref: 'City', required: true, index: true, default: null })
  // city: Types.ObjectId | City | null;

  @Prop({ type: String }) // Cloudinary/S3 URL
  mainPhotoUrl?: string

  @Prop({ type: [String], default: [] })
  additionalPhotosUrls: string[]

  /**
   * One short walkthrough clip, shown as the last slide of the gallery.
   *
   * A URL, not an upload: the video goes into the media library first (which
   * enforces the size and length limits), and the listing stores the link.
   */
  @Prop({ type: String })
  videoUrl?: string

  /** Poster frame for the video, so the gallery has a tile before it plays. */
  @Prop({ type: String })
  videoPosterUrl?: string

  /*
   * What the listing brain thought (listing-brain.service.ts).
   *
   * Stored rather than recomputed so the admin can see WHY a listing is in the
   * queue, and so a pattern across one agent is visible later. Listings created
   * before the brain existed simply have 0 and an empty list.
   */
  @Prop({ type: Number, default: 0, index: true })
  moderationScore?: number

  @Prop({ type: [String], default: [] })
  moderationReasons?: string[]

  /** "rules" or "rules+ai" — which pass produced the score. */
  @Prop({ type: String })
  moderationSource?: string

  /** True when the brain published it without a human looking. */
  @Prop({ type: Boolean, default: false })
  autoPublished?: boolean

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  owner: Types.ObjectId

  @Prop({ type: Types.ObjectId, ref: 'Subscription', required: false })
  subscriptionId?: Types.ObjectId

  @Prop({ default: false })
  isFeatured: boolean

  @Prop({ default: 'pending', index: true, enum: ['pending', 'approved', 'rejected', 'draft'] })
  status: 'pending' | 'approved' | 'rejected' | 'draft'

  /**
   * Has it gone? Separate from `status`, which is moderation.
   *
   * A sold house is not a rejected listing: it was fine, it is simply off the
   * market. Keeping the two apart means an agent can mark their own listing
   * sold without touching the approval state, and the approval queue does not
   * fill up with houses that were never in question.
   *
   * Rows written before this field existed have neither value, which reads as
   * 'available' everywhere — nothing already on the site changes.
   */
  @Prop({ enum: ['available', 'sold', 'rented'], default: 'available', index: true })
  availability?: 'available' | 'sold' | 'rented'

  /**
   * When it was marked sold or rented — the clock for the 15-day grace period.
   *
   * For those fifteen days the listing stays on the site wearing a "Sold" or
   * "Rented" badge with the phone number hidden: it is social proof, and a
   * buyer who saw it yesterday is not left staring at a 404. After that it
   * drops out of search, the city and area pages and the agent's profile,
   * while the URL itself keeps answering — the page is ranked, and deleting
   * or redirecting it would throw that away.
   *
   * Computed at query time rather than flipped by a cron job, so marking a
   * listing available again brings it straight back with no second job to run.
   */
  @Prop({ type: Date })
  availabilityChangedAt?: Date

  // Optional source tag (e.g. 'manual', 'api', 'n8n') so admin can see automated vs manual drafts
  @Prop({ type: String, default: 'manual' })
  source?: string

  @Prop({ type: Number })
  latitude?: number

  @Prop({ type: Number })
  longitude?: number

  /*
   * Listing performance counters.
   *
   * Written by PropertyCountersService, which buffers events in memory and
   * flushes them as one bulk $inc every few seconds — a busy listing would
   * otherwise be a write hot-spot. Existing documents simply have no field
   * yet; everything that reads them treats a missing value as 0.
   */

  /** Detail-page opens. Once per visitor per session. */
  @Prop({ type: Number, default: 0 })
  views?: number

  /** Times the listing's card was actually scrolled into view in a feed. */
  @Prop({ type: Number, default: 0 })
  impressions?: number

  /** Taps on "Call". The number that tells an agent a listing is working. */
  @Prop({ type: Number, default: 0 })
  phoneClicks?: number

  /** Taps on "WhatsApp". */
  @Prop({ type: Number, default: 0 })
  whatsappClicks?: number
}

export const PropertySchema = SchemaFactory.createForClass(Property)

// Search Optimization: Text index for title and location
PropertySchema.index({ title: 'text', location: 'text' });

// Compound index for common listing queries
PropertySchema.index({ status: 1, listingType: 1, propertyType: 1 });

/*
 * 🚀 PERF: indexes for the dashboard list query.
 *
 * The admin list is `find({ status? }).sort({ createdAt: -1 })` and an agent's
 * list is `find({ owner }).sort({ createdAt: -1 })`. `owner` had no index at
 * all and `createdAt` was never indexed, so both did a full collection scan
 * followed by an in-memory sort — which MongoDB aborts outright once the sort
 * exceeds 32MB. These three cover every shape the dashboard issues.
 */

// An agent's own listings, newest first.
PropertySchema.index({ owner: 1, createdAt: -1 });

// Admin list filtered by status tab, newest first.
PropertySchema.index({ status: 1, createdAt: -1 });

// Unfiltered admin list (and any plain newest-first sort).
PropertySchema.index({ createdAt: -1 });

// Area-scoped dashboard and public queries, newest first.
PropertySchema.index({ area: 1, createdAt: -1 });

// Every public list now also asks "is this still on the market, or did it sell
// more than fifteen days ago?" — see the availability fields above.
PropertySchema.index({ availability: 1, availabilityChangedAt: -1 });
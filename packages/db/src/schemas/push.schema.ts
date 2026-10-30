import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Schema as MSchema, Types } from "mongoose";

/*
 * Browser push notifications — the site's own (VAPID web push), no Firebase
 * or OneSignal. Five collections:
 *
 *   pushsubscribers  one row per browser/device that allowed notifications
 *   pushcampaigns    the admin's manual pushes
 *   pushjobs         automatic pushes waiting for quiet hours to end
 *   pushstats        daily totals per notification type, for the reports
 *   pushsettings     one document: settings, templates and the VAPID keys
 */

export type PushSubStatus = "active" | "expired" | "invalid" | "unsubscribed";

/**
 * One browser that allowed notifications. A person can have several (phone
 * and laptop); a device can have no account (guests get campaigns and the
 * "new in your area" alerts). What the device has been looking at is kept
 * here too, so the alerts are about that person's search, signed in or not.
 */
@Schema({ timestamps: true, collection: "pushsubscribers" })
export class PushSubscriber {
  @Prop({ required: true, unique: true })
  endpoint: string;

  @Prop({ type: { p256dh: String, auth: String }, required: true, _id: false })
  keys: { p256dh: string; auth: string };

  @Prop({ type: Types.ObjectId, ref: "User", default: null, index: true })
  userId: Types.ObjectId | null;

  /** USER, AGENT or ADMIN at the last check-in. */
  @Prop({ type: String, default: null })
  role: string | null;

  /** On a paid plan at the last check-in (campaign targeting). */
  @Prop({ default: false })
  paid: boolean;

  /** The owner switched off "News & offers": campaigns skip this device. */
  @Prop({ default: false })
  promoOff: boolean;

  /** The owner switched off "New listings for you". */
  @Prop({ default: false })
  alertsOff: boolean;

  @Prop({ type: Types.ObjectId, default: null })
  cityId: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  city: string | null;

  /**
   * What this device has been browsing, most recent first: areas or
   * societies with the purpose and type looked at. Drives "new in your area".
   */
  @Prop({
    // `type` is written as { type: String }: a bare `type: String` here would make Mongoose read the whole object as a string.
    type: [{ areaId: { type: Types.ObjectId }, area: { type: String }, cityId: { type: Types.ObjectId }, purpose: { type: String }, type: { type: String }, at: { type: Date }, _id: false }],
    default: [],
  })
  interests: { areaId?: Types.ObjectId; area?: string; cityId?: Types.ObjectId; purpose?: string; type?: string; at?: Date }[];

  /** Listings opened on this device (last 30) — for "a listing you viewed is now cheaper". */
  @Prop({ type: [Types.ObjectId], default: [] })
  viewed: Types.ObjectId[];

  @Prop({ default: "Other" })
  browser: string;

  @Prop({ default: "Other" })
  os: string;

  @Prop({ enum: ["mobile", "tablet", "desktop"], default: "desktop" })
  device: "mobile" | "tablet" | "desktop";

  @Prop({ type: String, default: null })
  lang: string | null;

  /** Where it was allowed: prompt, post, contact, review, settings… */
  @Prop({ default: "prompt" })
  source: string;

  @Prop({ enum: ["active", "expired", "invalid", "unsubscribed"], default: "active" })
  status: PushSubStatus;

  @Prop({ default: 0 }) sentCount: number;
  @Prop({ default: 0 }) clickCount: number;
  @Prop({ default: 0 }) failCount: number;
  /** "New in your area" sent on this day (YYYY-MM-DD), so it goes once a day at most. */
  @Prop({ type: String, default: null }) alertDay: string | null;
  @Prop({ default: () => new Date() }) lastSeenAt: Date;
  @Prop({ type: Date, default: null }) lastSentAt: Date | null;
  @Prop({ type: Date, default: null }) lastClickAt: Date | null;
  @Prop({ type: Date, default: null }) endedAt: Date | null;
}
export type PushSubscriberDocument = PushSubscriber & Document;
export const PushSubscriberSchema = SchemaFactory.createForClass(PushSubscriber);
PushSubscriberSchema.index({ userId: 1, status: 1 });
PushSubscriberSchema.index({ status: 1, _id: 1 });
PushSubscriberSchema.index({ status: 1, cityId: 1, _id: 1 });
PushSubscriberSchema.index({ status: 1, "interests.areaId": 1 });
PushSubscriberSchema.index({ viewed: 1, status: 1 });
PushSubscriberSchema.index({ createdAt: -1 });

export type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "cancelled" | "failed";

export interface PushAudience {
  /** everyone · signed-in · guests · agents · paid agents · free agents · buyers · admins · picked people */
  who: "all" | "users" | "guests" | "agents" | "paid" | "free" | "buyers" | "admins" | "specific";
  cityIds?: string[];
  /** Devices that have been looking at these areas / societies. */
  areaIds?: string[];
  /** Devices that have been looking at rent, or at sale. */
  purpose?: "" | "rent" | "sale";
  devices?: string[];
  browsers?: string[];
  os?: string[];
  userIds?: string[];
  /** Only devices seen within N days (0 = any). */
  activeWithinDays?: number;
}

/** A manual push from Dashboard → Push notifications. Sent in batches in the background, resumable. */
@Schema({ timestamps: true, collection: "pushcampaigns" })
export class PushCampaign {
  @Prop({ default: "" }) name: string;
  @Prop({ required: true, maxlength: 120 }) title: string;
  @Prop({ default: "", maxlength: 400 }) body: string;
  @Prop({ default: "/" }) url: string;
  @Prop({ type: String, default: null }) icon: string | null;
  @Prop({ type: String, default: null }) image: string | null;
  @Prop({ type: [{ title: String, url: String, _id: false }], default: [] }) actions: { title: string; url: string }[];
  @Prop({ default: false }) requireInteraction: boolean;
  @Prop({ default: 24 }) ttlHours: number;
  @Prop({ enum: ["very-low", "low", "normal", "high"], default: "normal" }) urgency: "very-low" | "low" | "normal" | "high";
  @Prop({ type: MSchema.Types.Mixed, default: { who: "all" } }) audience: PushAudience;
  @Prop({ enum: ["draft", "scheduled", "sending", "sent", "cancelled", "failed"], default: "draft" }) status: CampaignStatus;
  @Prop({ type: Date, default: null }) sendAt: Date | null;
  @Prop({ type: Date, default: null }) startedAt: Date | null;
  @Prop({ type: Date, default: null }) finishedAt: Date | null;
  @Prop({ type: Date, default: null }) heartbeatAt: Date | null;
  @Prop({ type: String, default: null }) lockedBy: string | null;
  @Prop({ type: Types.ObjectId, default: null }) cursor: Types.ObjectId | null;
  @Prop({
    type: { targeted: Number, sent: Number, failed: Number, removed: Number, delivered: Number, clicked: Number, closed: Number },
    default: () => ({ targeted: 0, sent: 0, failed: 0, removed: 0, delivered: 0, clicked: 0, closed: 0 }),
    _id: false,
  })
  stats: { targeted: number; sent: number; failed: number; removed: number; delivered: number; clicked: number; closed: number };
  @Prop({ type: String, default: null }) error: string | null;
  @Prop({ type: Types.ObjectId, ref: "User", default: null }) createdBy: Types.ObjectId | null;
}
export type PushCampaignDocument = PushCampaign & Document;
export const PushCampaignSchema = SchemaFactory.createForClass(PushCampaign);
PushCampaignSchema.index({ createdAt: -1 });
PushCampaignSchema.index({ status: 1, sendAt: 1 });

/** An automatic push held back by quiet hours, sent when they end. */
@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: "pushjobs" })
export class PushJob {
  @Prop({ type: Types.ObjectId, required: true }) userId: Types.ObjectId;
  @Prop({ required: true }) type: string;
  @Prop({ type: MSchema.Types.Mixed, default: {} }) vars: Record<string, unknown>;
  @Prop({ type: String, default: null }) url: string | null;
  @Prop({ type: String, default: null }) image: string | null;
  @Prop({ type: String, default: null }) icon: string | null;
  @Prop({ type: String, default: null }) tag: string | null;
  @Prop({ required: true }) sendAt: Date;
  @Prop({ type: Date, default: null }) lockedUntil: Date | null;
}
export type PushJobDocument = PushJob & Document;
export const PushJobSchema = SchemaFactory.createForClass(PushJob);
PushJobSchema.index({ sendAt: 1 });

/** Daily totals per notification type ("listing_approved", "campaign"…). */
@Schema({ collection: "pushstats" })
export class PushStat {
  @Prop({ required: true }) day: string;
  @Prop({ required: true }) type: string;
  @Prop({ default: 0 }) sent: number;
  @Prop({ default: 0 }) failed: number;
  @Prop({ default: 0 }) delivered: number;
  @Prop({ default: 0 }) clicked: number;
  @Prop({ default: 0 }) closed: number;
  @Prop({ default: 0 }) subscribed: number;
  @Prop({ default: 0 }) unsubscribed: number;
}
export type PushStatDocument = PushStat & Document;
export const PushStatSchema = SchemaFactory.createForClass(PushStat);
PushStatSchema.index({ day: 1, type: 1 }, { unique: true });

/** The single settings document (key "push"). */
@Schema({ timestamps: true, collection: "pushsettings" })
export class PushSetting {
  @Prop({ required: true, unique: true }) key: string;
  /** Admin settings and templates (see apps/api/src/push/push.config.ts). */
  @Prop({ type: MSchema.Types.Mixed, default: {} }) config: Record<string, unknown>;
  /** Made on first start when the server has no VAPID_* env keys — never change them. */
  @Prop({ type: String, default: null }) vapidPublicKey: string | null;
  @Prop({ type: String, default: null, select: false }) vapidPrivateKey: string | null;
}
export type PushSettingDocument = PushSetting & Document;
export const PushSettingSchema = SchemaFactory.createForClass(PushSetting);

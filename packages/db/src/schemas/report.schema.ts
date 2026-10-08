import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

/**
 * A report filed by a visitor against a listing or an agent.
 *
 * Property fraud in Pakistan is mostly social: the same plot sold twice, a
 * "file" that does not exist, a dealer who takes a token and disappears. The
 * people who find out first are the buyers who called, and until now they had
 * no way to tell anybody. One report is a complaint; three against the same
 * agent is a pattern — which is why these are stored rather than emailed.
 */

export const REPORT_REASONS = [
  "Scam or fraud",
  "Property already sold or rented",
  "Wrong or fake photos",
  "Price is not real (bait)",
  "Agent is not reachable",
  "Duplicate listing",
  "Wrong location or details",
  "Agent asked for advance payment",
  "Rude or abusive behaviour",
  "Offensive or illegal content",
  "Something else",
] as const;

export type ReportDocument = Report & Document;

@Schema({ timestamps: true })
export class Report {
  /** What is being reported. */
  @Prop({ required: true, enum: ["listing", "agent"], index: true })
  type: "listing" | "agent";

  /** Who filed it. Reporting requires an account, so this is always set. */
  @Prop({ type: Types.ObjectId, ref: "User", required: true, index: true })
  reporter: Types.ObjectId;

  /** The listing, when type is "listing". */
  @Prop({ type: Types.ObjectId, ref: "Property", index: true })
  property?: Types.ObjectId;

  /** The agent — set for an agent report, and also for a listing report so
   * every complaint about one dealer can be counted together. */
  @Prop({ type: Types.ObjectId, ref: "User", index: true })
  reportedUser?: Types.ObjectId;

  @Prop({ required: true, trim: true })
  reason: string;

  /** What the reporter typed, if anything. */
  @Prop({ default: "", trim: true })
  message: string;

  @Prop({
    default: "open",
    enum: ["open", "reviewed", "dismissed"],
    index: true,
  })
  status: "open" | "reviewed" | "dismissed";

  /** What the admin did about it, for the next admin who looks. */
  @Prop({ default: "", trim: true })
  adminNote: string;

  @Prop({ type: Types.ObjectId, ref: "User" })
  handledBy?: Types.ObjectId;
}

export const ReportSchema = SchemaFactory.createForClass(Report);

// The admin queue: open ones first, newest first.
ReportSchema.index({ status: 1, createdAt: -1 });

// "How many complaints does this agent have?" and the same for a listing.
ReportSchema.index({ reportedUser: 1, status: 1 });
ReportSchema.index({ property: 1, status: 1 });

/*
 * One report per person per thing.
 *
 * Without this, a dispute between two dealers becomes fifty reports and the
 * queue is useless. A partial index so agent reports (no property) and listing
 * reports do not collide on a null key.
 */
ReportSchema.index(
  { reporter: 1, property: 1 },
  { unique: true, partialFilterExpression: { property: { $exists: true } } },
);
ReportSchema.index(
  { reporter: 1, reportedUser: 1, type: 1 },
  { unique: true, partialFilterExpression: { type: "agent" } },
);

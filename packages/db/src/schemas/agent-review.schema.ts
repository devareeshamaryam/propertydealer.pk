import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

/**
 * A signed-in visitor's review of an agent or agency.
 *
 * Reviews belong to the agent, not to a listing: a listing is sold, rented or
 * expires within weeks and its reviews would go with it, while a dealer's
 * record is what the next buyer wants to know. (Zillow, Realtor.com and Bayut
 * all do it this way; the listing page shows the agent's rating and links to
 * the reviews.) A review may still say which listing it was about.
 */

/** How the reviewer dealt with the agent — shown on the review. */
export const REVIEW_RELATIONS = ["bought", "sold", "rented", "let", "enquired"] as const;
export type ReviewRelation = (typeof REVIEW_RELATIONS)[number];

export type AgentReviewDocument = AgentReview & Document;

@Schema({ timestamps: true })
export class AgentReview {
  /** The agent or agency reviewed. */
  @Prop({ type: Types.ObjectId, ref: "User", required: true, index: true })
  agent: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "User", required: true, index: true })
  reviewer: Types.ObjectId;

  @Prop({ required: true, min: 1, max: 5 })
  rating: number;

  @Prop({ default: "", trim: true })
  text: string;

  @Prop({ enum: REVIEW_RELATIONS, default: "enquired" })
  relation: ReviewRelation;

  /** The listing it was about, when the reviewer came from one. */
  @Prop({ type: Types.ObjectId, ref: "Property" })
  property?: Types.ObjectId;

  /**
   * published: on the page. pending: the review brain held it for an admin
   * (abuse, a phone number or link, spam) — only its writer sees it. hidden:
   * an admin took it down. Pending and hidden count for nothing in the rating.
   */
  @Prop({ enum: ["published", "pending", "hidden"], default: "published", index: true })
  status: "published" | "pending" | "hidden";

  /** Why the review brain held it, for the admin. */
  @Prop({ type: [String], default: [] })
  holdReasons: string[];

  /** The agent asked the admins to look at it. */
  @Prop({ default: false, index: true })
  flagged: boolean;

  @Prop({ default: "", trim: true })
  flagReason: string;

  /** The agent's one public answer. */
  @Prop({ type: { text: String, at: Date }, default: undefined, _id: false })
  reply?: { text: string; at: Date };
}

export const AgentReviewSchema = SchemaFactory.createForClass(AgentReview);

// One review per person per agent — they edit it instead of adding another.
AgentReviewSchema.index({ agent: 1, reviewer: 1 }, { unique: true });
// The agent's page: their published reviews, newest first.
AgentReviewSchema.index({ agent: 1, status: 1, createdAt: -1 });

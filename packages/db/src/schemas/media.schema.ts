import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

/**
 * Media — the WordPress-style media library.
 *
 * Every upload is recorded here so it can be browsed, searched, re-used,
 * captioned and deleted from one place. Previously uploads were written
 * straight to disk with a random UUID name and never recorded, which is why
 * there was no alt text, no owner and no way to tell one agent's photos from
 * another's.
 *
 * `folder` groups uploads by purpose for the library filter. `uploadedBy`
 * scopes the library: an agent sees only their own uploads, an admin sees
 * everything.
 */

export const MEDIA_FOLDERS = [
  "general",
  "properties",
  "blog",
  "pages",
  "rates",
  "cities",
  "areas",
  "tile-categories",
  "packages",
  "branding",
] as const;

export type MediaFolder = (typeof MEDIA_FOLDERS)[number];

export type MediaDocument = Media & Document;

@Schema({ timestamps: true, toJSON: { virtuals: true } })
export class Media {
  /** Public URL of the full-size image. */
  @Prop({ required: true })
  url: string;

  /** Public URL of the 480px thumbnail used by the grid. */
  @Prop({ required: true })
  thumbUrl: string;

  /** Storage key — what StorageService needs to delete the file. */
  @Prop({ required: true, index: true })
  key: string;

  @Prop({ default: "image/webp" })
  mime: string;

  @Prop({ default: 0 })
  width: number;

  @Prop({ default: 0 })
  height: number;

  @Prop({ default: 0 })
  sizeBytes: number;

  /** The file name the user uploaded, kept for search and the detail panel. */
  @Prop({ default: "", trim: true })
  originalName: string;

  @Prop({ default: "", trim: true })
  title: string;

  /** Alt text — read by Google and by screen readers. */
  @Prop({ default: "", trim: true })
  alt: string;

  @Prop({ default: "", trim: true })
  caption: string;

  /** Where `alt` came from, so the UI can show an "AI" badge and offer a rewrite. */
  @Prop({ default: "auto", enum: ["ai", "user", "auto"] })
  altSource: "ai" | "user" | "auto";

  @Prop({ default: "skipped", enum: ["pending", "done", "failed", "skipped"] })
  aiStatus: "pending" | "done" | "failed" | "skipped";

  /** 16px blur-up data URL, so a grid tile has something to show immediately. */
  @Prop({ default: "" })
  placeholder: string;

  /** Dominant colour, used as the tile background while the image loads. */
  @Prop({ default: "" })
  color: string;

  @Prop({ default: "general", enum: MEDIA_FOLDERS, index: true })
  folder: string;

  @Prop({ type: Types.ObjectId, ref: "User", required: true, index: true })
  uploadedBy: Types.ObjectId;

  /**
   * True for rows created by the backfill script from files that were already
   * on disk before the library existed. Those keep their original URL — the
   * site is live and ranked, so no existing image path ever changes.
   */
  @Prop({ default: false })
  imported: boolean;
}

export const MediaSchema = SchemaFactory.createForClass(Media);

// The library's own query: newest first, optionally scoped to one uploader.
MediaSchema.index({ uploadedBy: 1, createdAt: -1 });
MediaSchema.index({ folder: 1, createdAt: -1 });
MediaSchema.index({ createdAt: -1 });

// Search by file name / title / alt from the library's search box.
MediaSchema.index({ originalName: "text", title: "text", alt: "text" });

// Lets the backfill and the "is this already in the library?" check be cheap.
MediaSchema.index({ url: 1 });

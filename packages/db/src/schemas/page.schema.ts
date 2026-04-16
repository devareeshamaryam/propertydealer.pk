import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import slugify from 'slug';

@Schema({ timestamps: true})
export class Page {
    @Prop({ required: true, trim: true })
    title: string;

    @Prop({ required: true, unique: true, lowercase: true, index: true })
    slug: string;

    @Prop({ trim: true })
    excerpt?: string;

    @Prop({ required: true })
    content: string;

    @Prop({ enum: ['DRAFT', 'PUBLISHED'], default: 'DRAFT' })
    status: string;

    @Prop({ default: 0 })
    views: number;

    // SEO fields
    @Prop({ trim: true })
    metaTitle?: string;

    @Prop({ trim: true, maxlength: 160 })
    metaDescription?: string;

    @Prop()
    canonicalUrl?: string;

    @Prop()
    featuredImage?: string;

    @Prop({ type: [{ type: String }], default: [] })
    keywords?: string[];
}

export type PageDocument = Page & Document;
export const PageSchema = SchemaFactory.createForClass(Page);

// Auto-generate slug from title (before save)
PageSchema.pre('save', async function () {
  // Generate slug if:
  // 1. Title is modified, OR
  // 2. Slug is not set (for new documents)
  if (this.isModified('title') || !this.slug) {
    if (this.title) {
      const generatedSlug = slugify(this.title, { lower: true });
      // Ensure slug is not empty
      if (generatedSlug && generatedSlug.trim()) {
        this.slug = generatedSlug;
      } else {
        // Fallback: create slug from title manually if slugify fails
        this.slug = this.title
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') || `page-${Date.now()}`;
      }
    }
  }
  // Ensure slug is always set (required field)
  if (!this.slug) {
    this.slug = `page-${Date.now()}`;
  }
});

// Indexes for performance + SEO-related queries
PageSchema.index({ status: 1, createdAt: -1 });
PageSchema.index({ 'metaTitle': 'text', title: 'text', excerpt: 'text' });
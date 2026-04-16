import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import slugify from 'slug'; // npm install slug

export type BlogDocument = Blog & Document;

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
   
  },
})
export class Blog {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ unique: true, lowercase: true, index: true })
  slug: string;                    // ← SEO king: /blog/my-awesome-post (auto-generated)

  @Prop({ required: true })
  content: string;                 // markdown / HTML / JSON from editor

  @Prop({ trim: true })
  excerpt?: string;                // meta description fallback (150-160 chars)

  @Prop()
  featuredImage?: string;          // URL to Cloudinary / S3 / etc.

  @Prop({ type: [{ type: String }], index: true })
  tags: string[];                  // helps with internal search + SEO

  @Prop({ enum: ['draft', 'published'], default: 'draft' })
  status: string;

  @Prop({ default: 0 })
  views: number;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  author: Types.ObjectId;

  // SEO fields
  @Prop({ trim: true })
  metaTitle?: string;              // override default title if needed

  @Prop({ trim: true, maxlength: 160 })
  metaDescription?: string;

  @Prop()
  canonicalUrl?: string;           // for duplicate content prevention


  @Prop({
    type: [{ type: Types.ObjectId, ref: 'Category' }],
    default: [],
  })
  categories: Types.ObjectId[];   // ← array of category IDs
}

export const BlogSchema = SchemaFactory.createForClass(Blog);

// Auto-generate slug from title (before save)
BlogSchema.pre('save', async function () {
  // Generate slug if:
  // 1. Title is modified, OR
  // 2. Slug is not set (for new documents)
  if (this.isModified('title') || !this.slug) {
    if (this.title) {
      this.slug = slugify(this.title, { lower: true });
    }
  }
});
// Indexes for performance + SEO-related queries
BlogSchema.index({ status: 1, createdAt: -1 });     // latest published
BlogSchema.index({ 'metaTitle': 'text', title: 'text', excerpt: 'text' }); // text search
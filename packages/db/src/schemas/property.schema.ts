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

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  owner: Types.ObjectId

  @Prop({ type: Types.ObjectId, ref: 'Subscription', required: false })
  subscriptionId?: Types.ObjectId

  @Prop({ default: false })
  isFeatured: boolean

  @Prop({ default: 'pending', index: true })
  status: 'pending' | 'approved' | 'rejected'

  @Prop({ type: Number })
  latitude?: number

  @Prop({ type: Number })
  longitude?: number
}

export const PropertySchema = SchemaFactory.createForClass(Property)

// Search Optimization: Text index for title and location
PropertySchema.index({ title: 'text', location: 'text' });

// Compound index for common listing queries
PropertySchema.index({ status: 1, listingType: 1, propertyType: 1 });
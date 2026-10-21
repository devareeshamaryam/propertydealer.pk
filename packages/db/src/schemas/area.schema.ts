 import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { City } from './city.schema';
import { Types } from 'mongoose';
import { Document } from 'mongoose';

export type AreaDocument = Area & Document;

/** A society guide — the admin's write-up shown on /societies/<city>/<slug>. A phase may carry a short one too. */
export interface SocietyGuide {
  /** Shown on the site only once published. */
  published?: boolean;
  /** Featured image: the guide's cover and the society's card. */
  image?: string;
  gallery?: string[];
  /** One line under the name ("Gated community on Raiwind Road"). */
  tagline?: string;
  /** The main write-up (HTML). */
  overview?: string;
  developer?: string;
  /** Who approved it — LDA, RDA, CDA, TMA… */
  approvedBy?: string;
  approval?: 'approved' | 'in-process' | 'not-approved' | '';
  totalArea?: string;
  launched?: string;
  possession?: string;
  plotSizes?: string;
  /** Where it is ("Main Raiwind Road, 5 km from Thokar Niaz Baig"). */
  address?: string;
  /** What is nearby — hospitals, schools, motorway access… */
  nearby?: string[];
  amenities?: string[];
  /** Payment plan / booking details (HTML). */
  paymentPlan?: string;
  phone?: string;
  website?: string;
  faqs?: { q: string; a: string }[];
  metaTitle?: string;
  metaDescription?: string;
}

@Schema({ timestamps: true })
export class Area {
  @Prop({ required: true, lowercase: true, trim: true })
  name: string;

  @Prop({ required: true, lowercase: true, trim: true })
  areaSlug: string;

  @Prop({ type: Types.ObjectId, ref: 'City', required: true, index: true })
  city: Types.ObjectId | City;

  @Prop({ trim: true })
  metaTitle?: string;

  @Prop({ trim: true })
  metaDescription?: string;

  @Prop({ trim: true })
  canonicalUrl?: string;

  @Prop({ trim: true })
  description?: string; // Rich Text (general)

  // Rent-specific SEO & content
  @Prop({ trim: true })
  rentMetaTitle?: string;

  @Prop({ trim: true })
  rentMetaDescription?: string;

  @Prop({ trim: true })
  rentContent?: string; // Rich Text for rent pages

  // Sale-specific SEO & content
  @Prop({ trim: true })
  saleMetaTitle?: string;

  @Prop({ trim: true })
  saleMetaDescription?: string;

  @Prop({ trim: true })
  saleContent?: string; // Rich Text for sale pages

  // 🆕 Size-specific SEO content (2 Marla, 3 Marla, 5 Marla, 10 Marla, 1 Kanal)
  @Prop({
    type: [{
      size: {
        type: String,
        enum: ['2marla', '3marla', '5marla', '10marla', '1kanal'],
        required: true,
      },
      purpose: { type: String, enum: ['rent', 'sale', 'all'], required: true },
      metaTitle: String,
      metaDescription: String,
      content: String,
    }],
    default: [],
  })
  sizeContents?: {
    size: '2marla' | '3marla' | '5marla' | '10marla' | '1kanal';
    purpose: 'rent' | 'sale' | 'all';
    metaTitle?: string;
    metaDescription?: string;
    content?: string;
  }[];

  // ── Map & housekeeping (all optional; existing areas are unchanged without them) ──

  /** Where the area is — its centre — for the map's labels. */
  @Prop() lat?: number;
  @Prop() lng?: number;

  /** A duplicate folded into another area: its URL stays, showing that area. */
  @Prop({ type: Types.ObjectId, ref: 'Area', default: undefined })
  mergedInto?: Types.ObjectId;
  @Prop({ trim: true, lowercase: true }) mergedIntoSlug?: string;

  /** Kept (its URL works) but not offered in dropdowns or on the map — e.g. "7.5 marla" saved as an area. */
  @Prop() hidden?: boolean;

  /** Where an added area came from ("osm" = OpenStreetMap import) and its id there. */
  @Prop({ trim: true }) source?: string;
  @Prop({ trim: true }) sourceId?: string;

  // ── Societies (all optional: an area without them is an ordinary locality) ──

  /**
   * What the place is. A locality or mohalla ("area", the default when
   * unset), a housing society with its own guide page, or one phase / block /
   * sector of a society. Every kind keeps its listing pages as they are.
   */
  @Prop({ enum: ['area', 'society', 'phase'], default: undefined }) kind?: 'area' | 'society' | 'phase';

  /** A phase's society. A society's listing pages include its phases' listings. */
  @Prop({ type: Types.ObjectId, ref: 'Area', default: undefined, index: true }) parent?: Types.ObjectId;

  /** Order of a phase within its society (Phase 1, Phase 2…). */
  @Prop() order?: number;

  /** A society's guide page (/societies/<city>/<slug>), written in the dashboard. */
  @Prop({ type: Object, default: undefined })
  guide?: SocietyGuide;

  // Properties are optional - an area can exist without properties initially
  // Properties will reference the area, not the other way around
}

export const AreaSchema = SchemaFactory.createForClass(Area);

// Create compound index to ensure area names are unique per city
AreaSchema.index({ name: 1, city: 1 }, { unique: true });
// A city's areas (dropdowns, location panel): the unique index above starts with
// name, so it cannot serve "all areas of this city".
AreaSchema.index({ city: 1, name: 1 });

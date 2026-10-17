import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/*
 * A housing society's map: the official master plan laid over the satellite
 * map, its blocks and landmarks, and the page that presents it
 * (/emap/<city>/<slug>).
 *
 * Positions are [lat, lng] pairs throughout — the order Leaflet uses.
 */

export type SocietyMapDocument = SocietyMap & Document;

/** A point on the uploaded image (source pixels) matched to a place on the ground. */
@Schema({ _id: false })
export class ControlPoint {
  @Prop({ required: true }) px: number;
  @Prop({ required: true }) py: number;
  @Prop({ required: true }) lat: number;
  @Prop({ required: true }) lng: number;
}
const ControlPointSchema = SchemaFactory.createForClass(ControlPoint);

@Schema({ _id: false })
export class LayerTiles {
  @Prop({ default: 'none', enum: ['none', 'queued', 'processing', 'ready', 'failed'] })
  status: 'none' | 'queued' | 'processing' | 'ready' | 'failed';

  /** Bumped on every run; part of the tile URL, so a re-run is never served from cache. */
  @Prop({ default: 0 }) version: number;
  @Prop({ default: 0 }) progress: number;
  @Prop() minZoom?: number;
  @Prop() maxZoom?: number;
  /** [south, west, north, east] */
  @Prop({ type: [Number], default: undefined }) bounds?: number[];
  /** `/uploads/…/{z}/{x}/{y}.webp` */
  @Prop() url?: string;
  @Prop() count?: number;
  @Prop() error?: string;
  @Prop() generatedAt?: Date;
}
const LayerTilesSchema = SchemaFactory.createForClass(LayerTiles);

/** One uploaded map image — the master plan, or one phase of it. */
@Schema({ _id: true })
export class MapLayer {
  _id: Types.ObjectId;

  @Prop({ trim: true, default: 'Master plan' }) name: string;
  /** Storage key of the original upload (never public). */
  @Prop() sourceKey: string;
  @Prop() width: number;
  @Prop() height: number;
  /** A smaller copy for the dashboard's alignment tool. */
  @Prop() previewUrl: string;
  @Prop() previewWidth: number;
  @Prop() previewHeight: number;
  /** A small card image for the public pages. */
  @Prop() thumbUrl?: string;
  /** A watermarked JPEG visitors may download, when the map allows it. */
  @Prop() downloadUrl?: string;

  @Prop({ type: [ControlPointSchema], default: [] }) controlPoints: ControlPoint[];
  /** Image corners on the ground, worked out from the control points: tl, tr, br, bl. */
  @Prop({ type: [[Number]], default: undefined }) corners?: number[][];

  @Prop({ default: 0.85, min: 0, max: 1 }) opacity: number;
  @Prop({ default: true }) visible: boolean;
  @Prop({ default: 0 }) order: number;

  @Prop({ type: LayerTilesSchema, default: () => ({}) }) tiles: LayerTiles;
}
const MapLayerSchema = SchemaFactory.createForClass(MapLayer);

@Schema({ _id: true })
export class MapBlock {
  _id: Types.ObjectId;
  @Prop({ required: true, trim: true }) name: string;
  @Prop({ trim: true, lowercase: true }) slug: string;
  /** Outline, [lat, lng] pairs. */
  @Prop({ type: [[Number]], default: [] }) polygon: number[][];
  @Prop({ default: '' }) color: string;
}
const MapBlockSchema = SchemaFactory.createForClass(MapBlock);

export const POI_KINDS = [
  'gate', 'mosque', 'school', 'hospital', 'park', 'commercial', 'office', 'graveyard', 'grid', 'landmark',
  'utility', 'parking', 'bank', 'fuel', 'police', 'restaurant',
] as const;

@Schema({ _id: true })
export class MapPoi {
  _id: Types.ObjectId;
  @Prop({ required: true, trim: true }) name: string;
  @Prop({ enum: POI_KINDS, default: 'landmark' }) kind: string;
  @Prop({ required: true }) lat: number;
  @Prop({ required: true }) lng: number;
}
const MapPoiSchema = SchemaFactory.createForClass(MapPoi);

@Schema({ _id: false })
export class MapFaq {
  @Prop({ trim: true }) q: string;
  @Prop({ trim: true }) a: string;
}
const MapFaqSchema = SchemaFactory.createForClass(MapFaq);

@Schema({ timestamps: true })
export class SocietyMap {
  @Prop({ required: true, trim: true }) name: string;
  /** URL segment: /emap/<citySlug>/<slug>. Usually the area's slug. */
  @Prop({ required: true, trim: true, lowercase: true }) slug: string;

  @Prop({ type: Types.ObjectId, ref: 'City', required: true }) city: Types.ObjectId;
  @Prop({ required: true, trim: true, lowercase: true }) citySlug: string;
  @Prop({ trim: true }) cityName: string;

  /** The area whose listings belong to this society. */
  @Prop({ type: Types.ObjectId, ref: 'Area', default: null }) area: Types.ObjectId | null;
  @Prop({ trim: true, lowercase: true }) areaSlug?: string;

  @Prop({ default: 'draft', enum: ['draft', 'published'] }) status: 'draft' | 'published';

  @Prop({ type: Object, default: null }) center: { lat: number; lng: number } | null;
  @Prop({ default: 15 }) zoom: number;

  @Prop({ type: [[Number]], default: [] }) boundary: number[][];
  /** Everything the map covers, for "which societies are in view". */
  @Prop({ type: Object, default: null })
  bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number } | null;

  @Prop({ type: [MapLayerSchema], default: [] }) layers: MapLayer[];
  @Prop({ type: [MapBlockSchema], default: [] }) blocks: MapBlock[];
  @Prop({ type: [MapPoiSchema], default: [] }) pois: MapPoi[];

  @Prop({ type: Object, default: () => ({}) })
  info: {
    developer?: string;
    approval?: string;
    totalArea?: string;
    launched?: string;
    possession?: string;
    plotSizes?: string;
    amenities?: string[];
  };

  @Prop({ type: Object, default: () => ({}) })
  seo: { metaTitle?: string; metaDescription?: string; intro?: string; content?: string };
  @Prop({ type: [MapFaqSchema], default: [] }) faqs: MapFaq[];

  @Prop({ type: Object, default: () => ({ enabled: false }) })
  sponsor: { enabled: boolean; name?: string; tagline?: string; phone?: string; whatsapp?: string; logoUrl?: string; link?: string };

  @Prop({ default: false }) downloadEnabled: boolean;

  /**
   * Where the map's data comes from: drawn in the dashboard ('manual'), an
   * authority's GIS ('official-gis'), an approved layout plan ('authority'),
   * or the society's outline from OpenStreetMap ('osm').
   */
  @Prop({ default: 'manual' }) source: string;

  /** The development authority's record of the scheme, as published on its website. */
  @Prop({ type: Object, default: null })
  official: {
    authority: string;
    /** approved · technically-approved · regularised · illegal */
    status: string;
    stage?: string;
    date?: string;
    approvedArea?: string;
    residentialPlots?: number;
    commercialPlots?: number;
    blocks?: string;
    mauza?: string;
    listName?: string;
    listUrl?: string;
    checkedAt?: string;
  } | null;

  /** Official documents shown on the page: the approved layout plan, the scheme boundary. */
  @Prop({ type: [Object], default: [] })
  documents: { title: string; kind: string; url: string; sourceUrl?: string; source?: string; width?: number; height?: number }[];

  /** Plots on record for this map (societyplots), for the page and the plot finder. */
  @Prop({ default: 0 }) plotCount: number;
}

export const SocietyMapSchema = SchemaFactory.createForClass(SocietyMap);

SocietyMapSchema.index({ citySlug: 1, slug: 1 }, { unique: true });
SocietyMapSchema.index({ status: 1, citySlug: 1, name: 1 });
SocietyMapSchema.index({ area: 1 });
SocietyMapSchema.index({ status: 1, 'bbox.minLat': 1, 'bbox.maxLat': 1 });

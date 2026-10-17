import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/*
 * One plot of a society map, from the society's own GIS: its number, sector,
 * land use, size and outline. Powers the plot finder ("Sector L, plot 215")
 * and "tap a plot to see what it is" on /emap/<city>/<society>.
 */

export type SocietyPlotDocument = SocietyPlot & Document;

@Schema({ timestamps: false, collection: 'societyplots' })
export class SocietyPlot {
  @Prop({ type: Types.ObjectId, ref: 'SocietyMap', default: null }) map: Types.ObjectId | null;
  @Prop({ required: true, lowercase: true, trim: true }) citySlug: string;
  @Prop({ required: true, lowercase: true, trim: true }) mapSlug: string;
  /** Plot number as printed on the plan ("215", "12-A"). */
  @Prop({ trim: true, default: '' }) no: string;
  /** Full address where the GIS has one ("6/L/215"). */
  @Prop({ trim: true, default: '' }) house: string;
  @Prop({ trim: true, default: '' }) sector: string;
  /** Normalised for search: lower case, no spaces or dashes. */
  @Prop({ index: true }) noKey: string;
  @Prop() sectorKey: string;
  @Prop({ trim: true, default: '' }) use: string;
  /** residential · commercial · park · mosque · school · hospital · utility · parking · graveyard · apartments */
  @Prop({ default: 'residential' }) kind: string;
  @Prop({ default: false }) corner: boolean;
  @Prop({ default: 0 }) sqft: number;
  @Prop({ type: Object, required: true }) loc: { type: 'Point'; coordinates: [number, number] };
  /** Outline as [lng, lat] pairs. */
  @Prop({ type: [[Number]], default: [] }) ring: number[][];
}

export const SocietyPlotSchema = SchemaFactory.createForClass(SocietyPlot);
SocietyPlotSchema.index({ loc: '2dsphere' });
SocietyPlotSchema.index({ citySlug: 1, mapSlug: 1, noKey: 1 });
SocietyPlotSchema.index({ citySlug: 1, mapSlug: 1, sectorKey: 1, noKey: 1 });

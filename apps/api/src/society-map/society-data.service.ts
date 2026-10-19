import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as fs from 'fs/promises';
import * as zlib from 'zlib';
import { promisify } from 'util';
import { SocietyMap, SocietyMapDocument } from '@rent-ghar/db/schemas/society-map.schema';
import { SocietyPlot, SocietyPlotDocument } from '@rent-ghar/db/schemas/society-plot.schema';
import { StorageService } from '@rent-ghar/storage/storage.service';
import { RedisCacheService } from '../redis-cache/redis-cache.service';
import { RevalidateService } from '../revalidate/revalidate.service';

/*
 * The data behind every society map that is not drawn by hand:
 *
 *   - Plots (societyplots) from a society's own GIS — the plot finder and
 *     "tap a plot to see what it is".
 *   - The one-time removal of the society pages that had no map of their own.
 *
 * Both run from SocietyMapSetup on start.
 */

const TAG = 'society-maps';
const gunzip = promisify(zlib.gunzip);

const slugify = (s: string) =>
  String(s ?? '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** "12-A", "12 a", "12a" → "12a" — what people type and what the plan prints compare equal. */
export const plotKey = (s: unknown) => String(s ?? '').toLowerCase().replace(/[\s\-_/.#]+/g, '').replace(/^0+(?=\d)/, '');

const inRing = (lng: number, lat: number, ring: number[][]) => {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi! > lat !== yj! > lat && lng < ((xj! - xi!) * (lat - yi!)) / (yj! - yi!) + xi!) c = !c;
  }
  return c;
};

type PlotOut = {
  id: string;
  no: string;
  house: string;
  sector: string;
  use: string;
  kind: string;
  corner: boolean;
  sqft: number;
  lat: number;
  lng: number;
  /** [lat, lng] pairs, Leaflet's order. */
  ring: number[][];
  citySlug: string;
  mapSlug: string;
};

@Injectable()
export class SocietyDataService {
  private readonly logger = new Logger(SocietyDataService.name);

  constructor(
    @InjectModel(SocietyPlot.name) private readonly plots: Model<SocietyPlotDocument>,
    @InjectModel(SocietyMap.name) private readonly maps: Model<SocietyMapDocument>,
    private readonly storage: StorageService,
    private readonly cache: RedisCacheService,
    private readonly revalidate: RevalidateService,
  ) {}

  private static out(p: any): PlotOut {
    return {
      id: String(p._id),
      no: p.no,
      house: p.house,
      sector: p.sector,
      use: p.use,
      kind: p.kind,
      corner: !!p.corner,
      sqft: p.sqft,
      lat: p.loc.coordinates[1],
      lng: p.loc.coordinates[0],
      ring: (p.ring ?? []).map(([x, y]: number[]) => [y, x]),
      citySlug: p.citySlug,
      mapSlug: p.mapSlug,
    };
  }

  /* ───────────────────────────── Plot finder ───────────────────────────── */

  /**
   * "L 215", "215 L", "Sector L plot 215", "6/L/215", "215" — the plots that
   * match, in one society (or a whole city when no society is given).
   */
  async findPlots(citySlug: string, mapSlug: string | undefined, q: string) {
    const city = slugify(citySlug);
    const map = mapSlug ? slugify(mapSlug) : '';
    const text = String(q ?? '').toLowerCase().trim().slice(0, 60);
    if (!city || !text) return [];
    const key = this.cache.buildKey('society-plots:find', [city, map, text]);
    return this.cache.wrap(key, async () => {
      const scope: Record<string, unknown> = { citySlug: city, ...(map ? { mapSlug: map } : {}) };
      const select = 'no house sector use kind corner sqft loc ring citySlug mapSlug';

      // A full address, as the GIS writes it.
      if (text.includes('/')) {
        const rows = await this.plots.find({ ...scope, house: new RegExp(`^${text.replace(/[^a-z0-9/]/g, '').replace(/\//g, '\\s*/\\s*')}$`, 'i') }).select(select).limit(20).lean().exec();
        if (rows.length) return rows.map(SocietyDataService.out);
      }

      const words = text
        .replace(/\b(plot|plots|no|number|house|sector|sec|block|blk|phase|ph)\b/g, ' ')
        .split(/[\s,#:]+/)
        .map(plotKey)
        .filter(Boolean)
        .slice(0, 3);
      if (!words.length) return [];

      const or: Record<string, unknown>[] = [];
      if (words.length >= 2) {
        // Either order: "L 215" or "215 L".
        for (const [s, n] of [[words[0], words[1]], [words[1], words[0]]]) or.push({ sectorKey: s, noKey: n });
        // "Sector 4 C 12": sector made of two words.
        if (words.length === 3) or.push({ sectorKey: `${words[0]}${words[1]}`, noKey: words[2] }, { sectorKey: words[0], noKey: `${words[1]}${words[2]}` });
      } else {
        or.push({ noKey: words[0] });
      }
      const rows = await this.plots.find({ ...scope, $or: or }).select(select).limit(30).lean().exec();
      return rows.map(SocietyDataService.out);
    }, { ttl: 3600, tags: [TAG] });
  }

  /**
   * Plots inside a map box — drawn as coloured outlines with their numbers,
   * the way society maps are read on site. Only at street level (the box must
   * be small), compact: [id, no, sector, kind, ring as [lat, lng] pairs].
   */
  async plotsInView(box: { minLat: number; maxLat: number; minLng: number; maxLng: number }) {
    if (box.maxLat - box.minLat > 0.03 || box.maxLng - box.minLng > 0.04) return { plots: [], tooWide: true };
    const r = (n: number) => Math.round(n * 400) / 400;
    const key = this.cache.buildKey('society-plots:view', [r(box.minLat), r(box.maxLat), r(box.minLng), r(box.maxLng)]);
    return this.cache.wrap(key, async () => {
      const rows = await this.plots
        .find({
          loc: {
            $geoWithin: {
              $geometry: {
                type: 'Polygon',
                coordinates: [[
                  [box.minLng, box.minLat],
                  [box.maxLng, box.minLat],
                  [box.maxLng, box.maxLat],
                  [box.minLng, box.maxLat],
                  [box.minLng, box.minLat],
                ]],
              },
            },
          },
        })
        .select('no sector kind ring')
        .limit(3000)
        .lean()
        .exec();
      return {
        plots: rows.map((p: any) => [
          String(p._id),
          p.no,
          p.sector,
          p.kind,
          (p.ring ?? []).map((pt: number[]) => [Math.round((pt[1] ?? 0) * 1e6) / 1e6, Math.round((pt[0] ?? 0) * 1e6) / 1e6]),
        ]),
        tooWide: false,
        truncated: rows.length >= 3000,
      };
    }, { ttl: 3600, tags: [TAG] });
  }

  /** The plot under a point on the map — what a tap shows. */
  async plotAt(lat: number, lng: number): Promise<PlotOut | null> {
    const near = await this.plots
      .find({ loc: { $near: { $geometry: { type: 'Point', coordinates: [lng, lat] }, $maxDistance: 80 } } })
      .select('no house sector use kind corner sqft loc ring citySlug mapSlug')
      .limit(12)
      .lean()
      .exec();
    const hit = near.find((p: any) => (p.ring?.length ?? 0) > 2 && inRing(lng, lat, p.ring));
    return hit ? SocietyDataService.out(hit) : null;
  }

  /* ───────────────────────────── Imports ───────────────────────────── */

  /**
   * data/society-plots/<name>.ndjson.gz — one plot per line:
   * { m: mapSlug, n, h, s, u, k, c, la, lo, q: sqft, r: [x0, y0, dx, dy, …] micro-degrees }.
   * Replaces the plots of the maps it covers.
   */
  async importPlots(file: string, citySlug: string) {
    const city = slugify(citySlug);
    const raw = (await gunzip(await fs.readFile(file))).toString('utf8');
    const rows = raw.split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const slugs = [...new Set(rows.map((r) => String(r.m)))];
    const maps = await this.maps.find({ citySlug: city, slug: { $in: slugs } }).select('_id slug').lean().exec();
    const idOf = new Map(maps.map((m: any) => [m.slug, m._id]));

    await this.plots.deleteMany({ citySlug: city, mapSlug: { $in: slugs } }).exec();
    let batch: any[] = [];
    let n = 0;
    const flush = async () => {
      if (!batch.length) return;
      await this.plots.collection.insertMany(batch, { ordered: false });
      n += batch.length;
      batch = [];
    };
    for (const r of rows) {
      const flat: number[] = r.r ?? [];
      const ring: number[][] = [];
      let x = flat[0]!;
      let y = flat[1]!;
      if (Number.isFinite(x) && Number.isFinite(y)) {
        ring.push([x / 1e6, y / 1e6]);
        for (let i = 2; i + 1 < flat.length; i += 2) {
          x += flat[i]!;
          y += flat[i + 1]!;
          ring.push([x / 1e6, y / 1e6]);
        }
        ring.push(ring[0]!);
      }
      batch.push({
        map: idOf.get(r.m) ?? null,
        citySlug: city,
        mapSlug: r.m,
        no: String(r.n ?? ''),
        house: String(r.h ?? ''),
        sector: String(r.s ?? ''),
        noKey: plotKey(r.n),
        sectorKey: plotKey(r.s),
        use: String(r.u ?? ''),
        kind: String(r.k ?? 'residential'),
        corner: !!r.c,
        sqft: Number(r.q) || 0,
        loc: { type: 'Point', coordinates: [Number(r.lo), Number(r.la)] },
        ring,
      });
      if (batch.length >= 2000) await flush();
    }
    await flush();
    await this.plots.syncIndexes().catch(() => undefined);

    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.m, (counts.get(r.m) ?? 0) + 1);
    for (const [slug, c] of counts) await this.maps.updateOne({ citySlug: city, slug }, { $set: { plotCount: c } }).exec();
    await this.bust(slugs.map((slug) => ({ citySlug: city, slug })));
    return { plots: n, maps: Object.fromEntries(counts) };
  }

  /**
   * Plot counts (and each plot's map) from the plots themselves. Idempotent;
   * run at the end of every start-up, because the plots can be imported by
   * one API process while another is still creating the maps they belong to.
   */
  async syncPlotCounts() {
    const groups = await this.plots.aggregate([{ $group: { _id: { c: '$citySlug', m: '$mapSlug' }, n: { $sum: 1 } } }]).exec();
    let fixed = 0;
    for (const g of groups as any[]) {
      const doc: any = await this.maps.findOne({ citySlug: g._id.c, slug: g._id.m }).select('_id plotCount').lean().exec();
      if (!doc) continue;
      if (doc.plotCount !== g.n) {
        await this.maps.updateOne({ _id: doc._id }, { $set: { plotCount: g.n } }).exec();
        fixed++;
      }
      await this.plots.updateMany({ citySlug: g._id.c, mapSlug: g._id.m, map: { $ne: doc._id } }, { $set: { map: doc._id } }).exec();
    }
    if (fixed) await this.bust([]);
    return { maps: groups.length, fixed };
  }

  /**
   * Removes the society pages that had no map of their own — an OpenStreetMap
   * outline or a development authority's record, imported automatically —
   * with their stored files. Kept: every map with an image on it (DHA's
   * phases, anything aligned in the dashboard) and every map made by hand.
   */
  async removeUnmapped() {
    const rows: any[] = await this.maps
      .find({ source: { $in: ['osm', 'lda'] }, 'layers.0': { $exists: false } })
      .select('_id citySlug slug documents')
      .lean()
      .exec();
    let files = 0;
    for (const m of rows) {
      for (const d of m.documents ?? []) {
        for (const url of [d.url, d.thumbUrl]) {
          const key = url ? String(url).split('/society-maps/')[1] : '';
          if (key && (await this.storage.deleteFile(`society-maps/${key}`).catch(() => false))) files++;
        }
      }
    }
    const ids = rows.map((m) => m._id);
    const r = ids.length ? await this.maps.deleteMany({ _id: { $in: ids } }).exec() : { deletedCount: 0 };
    await this.bust(rows.map((m) => ({ citySlug: m.citySlug, slug: m.slug })));
    return { removed: r.deletedCount, files };
  }

  private async bust(addresses: { citySlug: string; slug: string }[]) {
    await this.cache.invalidateTags([TAG]).catch(() => undefined);
    if (!addresses.length) return;
    const cities = [...new Set(addresses.map((a) => a.citySlug))];
    void this.revalidate
      .revalidate({ tags: [TAG], paths: ['/emap', ...cities.map((c) => `/emap/${c}`), ...addresses.slice(0, 200).map((a) => `/emap/${a.citySlug}/${a.slug}`)] })
      .catch(() => undefined);
  }
}


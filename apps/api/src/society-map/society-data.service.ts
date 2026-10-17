import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import sharp from 'sharp';
import { createHash } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as zlib from 'zlib';
import { promisify } from 'util';
import { SocietyMap, SocietyMapDocument } from '@rent-ghar/db/schemas/society-map.schema';
import { SocietyPlot, SocietyPlotDocument } from '@rent-ghar/db/schemas/society-plot.schema';
import { City } from '@rent-ghar/db/schemas/city.schema';
import { Area } from '@rent-ghar/db/schemas/area.schema';
import { StorageService } from '@rent-ghar/storage/storage.service';
import { RedisCacheService } from '../redis-cache/redis-cache.service';
import { RevalidateService } from '../revalidate/revalidate.service';

/*
 * The data behind every society map that is not drawn by hand:
 *
 *   - Plots (societyplots) from a society's own GIS — the plot finder and
 *     "tap a plot to see what it is".
 *   - Society records (data/society-data/<city>.json): outlines and blocks
 *     from OpenStreetMap, landmarks, and the development authority's record
 *     of the scheme (approval, area, plots, approved layout plan).
 *
 * Both ship with the code and are put in place by SocietyMapSetup on start.
 * Nothing here overwrites what an admin has written in the dashboard: empty
 * fields are filled, official records are refreshed.
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
    @InjectModel(City.name) private readonly cityModel: Model<City>,
    @InjectModel(Area.name) private readonly areaModel: Model<Area>,
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
   * data/society-data/<city>.json — every society of a city the site knows
   * something real about. Creates a published map for a society that has an
   * outline or an approved plan; fills in what an existing map lacks.
   */
  async applySocieties(file: string) {
    const pkg = JSON.parse(await fs.readFile(file, 'utf8'));
    if (pkg?.format !== 'pd-society-data/1') throw new Error(`${file}: not a society data file`);
    const cities = await this.cityModel.collection.find({}, { projection: { name: 1 } }).toArray();
    const city: any = cities.find((c: any) => slugify(c.name) === pkg.citySlug) ?? cities.find((c: any) => String(c.name).toLowerCase() === String(pkg.cityName).toLowerCase());
    if (!city) return { city: pkg.citySlug, skipped: 'city not on this site' };
    const citySlug = slugify(city.name);
    const areas = await this.areaModel.collection
      .find({ city: { $in: [city._id, String(city._id)] } }, { projection: { areaSlug: 1, mergedInto: 1, hidden: 1, name: 1 } })
      .toArray();
    const areaBySlug = new Map(areas.map((a: any) => [String(a.areaSlug), a]));

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const touched: { citySlug: string; slug: string }[] = [];
    for (const s of pkg.societies ?? []) {
      let area: any = s.areaSlug ? areaBySlug.get(s.areaSlug) : null;
      // A merged duplicate: its records belong to the area it now points to.
      if (area?.mergedInto) area = areas.find((a: any) => String(a._id) === String(area.mergedInto)) ?? null;
      if (area?.hidden) area = null;
      const slug = slugify(area?.areaSlug ?? s.slug);
      if (!slug) { skipped++; continue; }

      const doc: any = await this.maps.findOne({ citySlug, slug }).exec();
      const boundary: number[][] = Array.isArray(s.boundary) ? s.boundary : [];
      const blocks = (s.blocks ?? []).filter((b: any) => b?.name && Array.isArray(b.polygon) && b.polygon.length > 2);
      const pois = (s.pois ?? []).filter((p: any) => p?.name && Number.isFinite(p.lat) && Number.isFinite(p.lng)).slice(0, 300);
      const documents = (s.documents ?? []).filter((d: any) => d?.sourceUrl).map((d: any) => ({ title: d.title, kind: d.kind ?? 'plan', url: '', sourceUrl: d.sourceUrl, source: d.source }));

      if (!doc) {
        // Only a society with something to show gets a page: an outline, blocks or an official plan.
        if (boundary.length < 3 && !blocks.length && !documents.length) { skipped++; continue; }
        const center = s.center ?? SocietyDataService.centre(boundary.length ? boundary : blocks.flatMap((b: any) => b.polygon));
        if (!center) { skipped++; continue; }
        await this.maps.create({
          name: s.name,
          slug,
          city: city._id,
          citySlug,
          cityName: city.name,
          area: area?._id ?? null,
          areaSlug: area?.areaSlug ?? s.areaSlug ?? slug,
          status: 'published',
          center,
          zoom: s.zoom ?? 15,
          boundary,
          bbox: SocietyDataService.bbox([...boundary, ...blocks.flatMap((b: any) => b.polygon)], center),
          blocks: blocks.map((b: any) => ({ name: String(b.name).slice(0, 80), slug: slugify(b.name), polygon: b.polygon, color: '' })),
          pois,
          info: s.info ?? {},
          seo: {},
          faqs: [],
          sponsor: { enabled: false },
          downloadEnabled: true,
          source: s.source ?? 'osm',
          official: s.official ?? null,
          documents,
        } as any);
        created++;
        touched.push({ citySlug, slug });
        continue;
      }

      const set: Record<string, unknown> = {};
      if ((doc.boundary?.length ?? 0) < 3 && boundary.length >= 3) set.boundary = boundary;
      if (!(doc.blocks?.length) && blocks.length) set.blocks = blocks.map((b: any) => ({ name: String(b.name).slice(0, 80), slug: slugify(b.name), polygon: b.polygon, color: '' }));
      if (!(doc.pois?.length) && pois.length) set.pois = pois;
      if (!doc.center && s.center) set.center = s.center;
      if (s.official) set.official = s.official;
      if (documents.length) {
        const have = new Map((doc.documents ?? []).map((d: any) => [d.sourceUrl, d]));
        set.documents = documents.map((d: any) => have.get(d.sourceUrl) ?? d);
      }
      for (const [k, v] of Object.entries(s.info ?? {})) if (v && !doc.info?.[k]) set[`info.${k}`] = v;
      if (!doc.area && area) {
        set.area = area._id;
        set.areaSlug = area.areaSlug;
      }
      if (set.boundary || set.blocks) set.bbox = SocietyDataService.bbox([...((set.boundary as number[][]) ?? doc.boundary ?? []), ...(((set.blocks as any[]) ?? doc.blocks ?? []).flatMap((b: any) => b.polygon))], doc.center ?? s.center);
      if (Object.keys(set).length) {
        await this.maps.updateOne({ _id: doc._id }, { $set: set }).exec();
        updated++;
        touched.push({ citySlug, slug });
      }
    }
    await this.bust(touched);
    return { city: citySlug, created, updated, skipped };
  }

  /**
   * Approved layout plans published by a development authority: fetched once
   * from the authority's site, made web-sized and stored with the map. One at
   * a time, politely; a failure is tried again on a later start.
   * LDA_CACHE_DIR (optional) is a folder of already-downloaded originals.
   */
  async fetchDocuments(max = 1000) {
    const docs = await this.maps
      .find({ documents: { $elemMatch: { url: '', sourceUrl: { $exists: true } } } })
      .select('_id citySlug slug documents')
      .limit(max)
      .exec();
    let done = 0;
    let failed = 0;
    for (const m of docs as any[]) {
      let changed = false;
      for (const d of m.documents) {
        if (d.url || !d.sourceUrl) continue;
        try {
          const original = await this.original(d.sourceUrl);
          const img = sharp(original, { limitInputPixels: 600e6, failOn: 'none' }).rotate();
          const meta = await img.metadata();
          const out = await img
            .resize(3200, 3200, { fit: 'inside', withoutEnlargement: true })
            .flatten({ background: '#ffffff' })
            .jpeg({ quality: 78, mozjpeg: true })
            .toBuffer({ resolveWithObject: true });
          const thumb = await sharp(out.data).resize(640, 420, { fit: 'cover' }).webp({ quality: 70 }).toBuffer();
          const tag = createHash('sha1').update(d.sourceUrl).digest('hex').slice(0, 12);
          const key = `society-maps/${m._id}/docs/${tag}.jpg`;
          await this.storage.putBuffer(key, out.data);
          await this.storage.putBuffer(`society-maps/${m._id}/docs/${tag}-thumb.webp`, thumb);
          d.url = this.storage.getUrl(key);
          d.thumbUrl = this.storage.getUrl(`society-maps/${m._id}/docs/${tag}-thumb.webp`);
          d.width = out.info.width;
          d.height = out.info.height;
          d.originalWidth = meta.width;
          changed = true;
          done++;
        } catch (err: any) {
          failed++;
          this.logger.warn(`Plan for ${m.citySlug}/${m.slug} not fetched: ${err?.message ?? err}`);
        }
        await new Promise((r) => setTimeout(r, 800));
      }
      if (changed) {
        m.markModified('documents');
        await m.save();
        await this.bust([{ citySlug: m.citySlug, slug: m.slug }]);
      }
    }
    return { done, failed, maps: docs.length };
  }

  private async original(url: string): Promise<Buffer> {
    const dir = process.env.LDA_CACHE_DIR;
    if (dir) {
      const name = decodeURIComponent(url.split('/').pop() ?? '').replace(/ /g, '_');
      const files = await fs.readdir(dir).catch(() => [] as string[]);
      const hit = files.find((f) => f.endsWith(`__${name}`));
      if (hit) return fs.readFile(path.join(dir, hit));
    }
    const res = await fetch(encodeURI(decodeURI(url)), { headers: { 'User-Agent': 'PropertyDealer maps (+https://propertydealer.pk)' }, signal: AbortSignal.timeout(180_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1000) throw new Error('empty file');
    return buf;
  }

  private static centre(points: number[][]): { lat: number; lng: number } | null {
    const ok = points.filter((p) => Number.isFinite(p?.[0]) && Number.isFinite(p?.[1]));
    if (!ok.length) return null;
    const lats = ok.map((p) => p[0]!);
    const lngs = ok.map((p) => p[1]!);
    return { lat: (Math.min(...lats) + Math.max(...lats)) / 2, lng: (Math.min(...lngs) + Math.max(...lngs)) / 2 };
  }

  private static bbox(points: number[][], center?: { lat: number; lng: number } | null) {
    const ok = points.filter((p) => Number.isFinite(p?.[0]) && Number.isFinite(p?.[1]));
    if (!ok.length) {
      if (!center) return null;
      const d = 0.01;
      return { minLat: center.lat - d, maxLat: center.lat + d, minLng: center.lng - d, maxLng: center.lng + d };
    }
    const lats = ok.map((p) => p[0]!);
    const lngs = ok.map((p) => p[1]!);
    return { minLat: Math.min(...lats), maxLat: Math.max(...lats), minLng: Math.min(...lngs), maxLng: Math.max(...lngs) };
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


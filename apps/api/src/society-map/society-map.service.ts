import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import sharp from 'sharp';
import { randomBytes } from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { SocietyMap, SocietyMapDocument, POI_KINDS } from '@rent-ghar/db/schemas/society-map.schema';
import { Property } from '@rent-ghar/db/schemas/property.schema';
import { City } from '@rent-ghar/db/schemas/city.schema';
import { Area } from '@rent-ghar/db/schemas/area.schema';
import { StorageService } from '@rent-ghar/storage/storage.service';
import { RedisCacheService } from '../redis-cache/redis-cache.service';
import { RevalidateService } from '../revalidate/revalidate.service';
import { SocietyMapTiler } from './society-map.tiler';
import { cornersOf, fitAffine, residuals } from './geo';

const TAG = 'society-maps';

const slugify = (s: string) =>
  String(s ?? '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const num = (v: unknown, min: number, max: number): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

const str = (v: unknown, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** [[lat, lng], …] inside Pakistan's box, or nothing. */
const ring = (v: unknown, max = 2000): number[][] =>
  Array.isArray(v)
    ? v
        .slice(0, max)
        .map((p) => (Array.isArray(p) ? [num(p[0], 20, 40), num(p[1], 58, 80)] : [null, null]))
        .filter((p): p is number[] => p[0] !== null && p[1] !== null)
    : [];

@Injectable()
export class SocietyMapService {
  constructor(
    @InjectModel(SocietyMap.name) private readonly model: Model<SocietyMapDocument>,
    @InjectModel(Property.name) private readonly propertyModel: Model<Property>,
    @InjectModel(City.name) private readonly cityModel: Model<City>,
    @InjectModel(Area.name) private readonly areaModel: Model<Area>,
    private readonly storage: StorageService,
    private readonly cache: RedisCacheService,
    private readonly revalidate: RevalidateService,
    private readonly tiler: SocietyMapTiler,
  ) {}

  /* ───────────────────────────── Public ───────────────────────────── */

  /** The tile layers a visitor's map draws: ready ones only, no admin internals. */
  private static publicLayers(doc: any) {
    return (doc.layers ?? [])
      .filter((l: any) => l.visible !== false && l.tiles?.status === 'ready')
      .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
      .map((l: any) => ({
        id: String(l._id),
        name: l.name,
        opacity: l.opacity ?? 0.85,
        url: l.tiles.url,
        bounds: l.tiles.bounds,
        minZoom: l.tiles.minZoom,
        maxZoom: l.tiles.maxZoom,
        downloadUrl: doc.downloadEnabled ? l.downloadUrl : undefined,
      }));
  }

  private static thumb(doc: any): string {
    return (doc.layers ?? []).find((l: any) => l.thumbUrl)?.thumbUrl ?? (doc.documents ?? []).find((d: any) => d.thumbUrl)?.thumbUrl ?? '';
  }

  /** What the map shows: an overlaid master plan, an authority's plan beside it, or the outline only. */
  private static kind(doc: any): 'plan' | 'document' | 'outline' {
    if ((doc.layers ?? []).some((l: any) => l.thumbUrl)) return 'plan';
    if ((doc.documents ?? []).some((d: any) => d.url)) return 'document';
    return 'outline';
  }

  /**
   * What the eMap offers visitors: published maps with a real plan on the
   * ground (an aligned master plan or official plot GIS, its tiles ready) —
   * the way emap.pk lists only societies it has a map for. Outline-only and
   * document-only societies are not listed or drawn; their pages still open
   * (unlinked, noindex) so no address breaks. Adding a plan in the dashboard
   * puts a society back on the eMap by itself.
   */
  static readonly ON_MAP = { status: 'published', layers: { $elemMatch: { 'tiles.status': 'ready', visible: { $ne: false } } } };

  private static official(doc: any) {
    const o = doc.official;
    return o?.authority && o?.status ? o : null;
  }

  /** Every published society map (or one city's), for indexes and search. */
  async list(citySlug?: string) {
    const city = citySlug ? slugify(citySlug) : '';
    return this.cache.wrap(this.cache.buildKey('society-maps:list', [city]), async () => {
      const rows = await this.model
        .find({ ...SocietyMapService.ON_MAP, ...(city ? { citySlug: city } : {}) })
        .select('name slug citySlug cityName center zoom layers.thumbUrl documents.thumbUrl documents.url blocks.name seo.intro official.authority official.status plotCount updatedAt')
        .sort({ name: 1 })
        .lean()
        .exec();
      return rows.map((d: any) => ({
        id: String(d._id),
        name: d.name,
        slug: d.slug,
        citySlug: d.citySlug,
        cityName: d.cityName,
        center: d.center,
        zoom: d.zoom,
        thumb: SocietyMapService.thumb(d),
        blocks: (d.blocks ?? []).length,
        intro: d.seo?.intro ?? '',
        kind: SocietyMapService.kind(d),
        official: SocietyMapService.official(d) ? { authority: d.official.authority, status: d.official.status } : null,
        plots: d.plotCount ?? 0,
        updatedAt: d.updatedAt,
      }));
    }, { ttl: 600, tags: [TAG] });
  }

  /** Published maps overlapping a box — so every map on the site shows the society plans in view. */
  async inView(box: { minLat: number; maxLat: number; minLng: number; maxLng: number }, zoom = 14) {
    const r = (n: number) => Math.round(n * 50) / 50;
    // Far out an outline needs few points: lighter, so every society in view fits in one response.
    const detail = zoom >= 15 ? 0 : zoom >= 13 ? 60 : 24;
    const key = this.cache.buildKey('society-maps:view', [r(box.minLat), r(box.maxLat), r(box.minLng), r(box.maxLng), detail]);
    return this.cache.wrap(key, async () => {
      const rows = await this.model
        .find({
          ...SocietyMapService.ON_MAP,
          'bbox.minLat': { $lte: box.maxLat },
          'bbox.maxLat': { $gte: box.minLat },
          'bbox.minLng': { $lte: box.maxLng },
          'bbox.maxLng': { $gte: box.minLng },
        })
        .select('name slug citySlug center boundary layers downloadEnabled')
        // A city like Lahore has hundreds of society maps; 80 left most of them undrawn.
        .limit(600)
        .lean()
        .exec();
      const thin = (pts: number[][]) => {
        if (!detail || pts.length <= detail) return pts;
        const step = pts.length / detail;
        return Array.from({ length: detail }, (_, i) => pts[Math.floor(i * step)]!);
      };
      return rows.map((d: any) => ({
        id: String(d._id),
        name: d.name,
        slug: d.slug,
        citySlug: d.citySlug,
        center: d.center,
        boundary: thin(d.boundary ?? []),
        layers: SocietyMapService.publicLayers({ ...d, downloadEnabled: false }),
      }));
    }, { ttl: 300, tags: [TAG] });
  }

  /**
   * Where things are, for the map's labels. With no city: one entry per city
   * (listings with an exact pin, and how many societies). With a city: one
   * entry per society/area — placed at its published map's centre, or else
   * at the average of its exactly pinned listings, so every label sits where
   * real listings are. Areas nobody has pinned a listing in are left out.
   */
  async places(citySlug?: string) {
    const city = citySlug ? slugify(citySlug) : '';
    return this.cache.wrap(this.cache.buildKey('society-maps:places', [city]), async () => {
      const live = { status: 'approved', availability: { $nin: ['sold', 'rented'] } };
      const [areas, cityRows, counts, pinned, maps] = await Promise.all([
        // Raw collection: part of it stores `city` as a string, which a cast query would skip.
        this.areaModel.collection
          .find({ mergedInto: { $in: [null] }, hidden: { $ne: true } }, { projection: { name: 1, areaSlug: 1, city: 1, lat: 1, lng: 1 } })
          .toArray(),
        this.cityModel.collection.find({}, { projection: { name: 1 } }).toArray(),
        this.propertyModel.aggregate([{ $match: { ...live, area: { $ne: null } } }, { $group: { _id: { $toString: '$area' }, n: { $sum: 1 } } }]).exec(),
        this.propertyModel
          .aggregate([
            { $match: { ...live, area: { $ne: null }, latitude: { $type: 'number', $gte: 20, $lte: 40 }, longitude: { $type: 'number', $gte: 58, $lte: 80 } } },
            { $group: { _id: { $toString: '$area' }, lat: { $avg: '$latitude' }, lng: { $avg: '$longitude' } } },
          ])
          .exec(),
        this.model.find(SocietyMapService.ON_MAP).select('name slug citySlug cityName center area areaSlug').lean().exec(),
      ]);
      const cityName = new Map(cityRows.map((c: any) => [String(c._id), String(c.name)]));
      const count = new Map((counts as any[]).map((r) => [String(r._id), r.n as number]));
      const pin = new Map((pinned as any[]).map((r) => [String(r._id), { lat: r.lat as number, lng: r.lng as number }]));
      const title = (n: string) => String(n).trim().split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

      type Place = { name: string; slug: string; citySlug: string; cityName: string; lat: number; lng: number; listings: number; hasMap: boolean };
      const byKey = new Map<string, Place>();
      for (const a of areas as any[]) {
        const id = String(a._id);
        const cn = cityName.get(String(a.city));
        // The area's own centre (set from the dashboard or the import), else its pinned listings' middle.
        const at = Number.isFinite(a.lat) && Number.isFinite(a.lng) ? { lat: a.lat, lng: a.lng } : pin.get(id);
        // An area without a map earns a label only by having live listings.
        if (!cn || !at || !a.areaSlug || !count.get(id)) continue;
        const cs = slugify(cn);
        byKey.set(`${cs}/${a.areaSlug}`, { name: title(a.name), slug: a.areaSlug, citySlug: cs, cityName: cn, lat: at.lat, lng: at.lng, listings: count.get(id) ?? 0, hasMap: false });
      }
      for (const m of maps as any[]) {
        if (!m.center) continue;
        const key = `${m.citySlug}/${m.slug}`;
        const prev = byKey.get(key) ?? (m.areaSlug ? byKey.get(`${m.citySlug}/${m.areaSlug}`) : undefined);
        if (m.areaSlug && m.areaSlug !== m.slug) byKey.delete(`${m.citySlug}/${m.areaSlug}`);
        byKey.set(key, { name: m.name, slug: m.slug, citySlug: m.citySlug, cityName: m.cityName, lat: m.center.lat, lng: m.center.lng, listings: prev?.listings ?? 0, hasMap: true });
      }
      const all = [...byKey.values()];

      if (city) {
        return all
          .filter((p) => p.citySlug === city)
          .sort((a, b) => Number(b.hasMap) - Number(a.hasMap) || b.listings - a.listings);
      }
      const cities = new Map<string, { name: string; slug: string; lat: number; lng: number; listings: number; societies: number; maps: number; w: number }>();
      for (const p of all) {
        const c = cities.get(p.citySlug) ?? { name: p.cityName, slug: p.citySlug, lat: 0, lng: 0, listings: 0, societies: 0, maps: 0, w: 0 };
        // The pin sits where the city's listings are (each society weighted by its listings).
        const w = Math.max(1, p.listings);
        c.lat = (c.lat * c.w + p.lat * w) / (c.w + w);
        c.lng = (c.lng * c.w + p.lng * w) / (c.w + w);
        c.w += w;
        c.listings += p.listings;
        c.societies++;
        if (p.hasMap) c.maps++;
        cities.set(p.citySlug, c);
      }
      return [...cities.values()].map(({ w: _w, ...c }) => c).sort((a, b) => b.listings - a.listings || b.societies - a.societies);
    }, { ttl: 600, tags: [TAG, 'properties'] });
  }

  /** The published map for an area, found by the area's id or its city + slug. Null when none. */
  async lookup(q: { areaId?: string; city?: string; area?: string }) {
    const key = this.cache.buildKey('society-maps:lookup', [q.areaId ?? '', slugify(q.city ?? ''), slugify(q.area ?? '')]);
    const hit = await this.cache.wrap(key, async () => {
      let filter: Record<string, unknown> | null = null;
      if (q.areaId && Types.ObjectId.isValid(q.areaId)) filter = { area: new Types.ObjectId(q.areaId) };
      else if (q.city && q.area) {
        const c = slugify(q.city);
        const a = slugify(q.area);
        filter = { citySlug: c, $or: [{ areaSlug: a }, { slug: a }] };
      }
      if (!filter) return { found: false };
      const d: any = await this.model.findOne({ ...SocietyMapService.ON_MAP, ...filter }).select('name slug citySlug').lean().exec();
      return d ? { found: true, name: d.name, slug: d.slug, citySlug: d.citySlug, url: `/emap/${d.citySlug}/${d.slug}` } : { found: false };
    }, { ttl: 600, tags: [TAG] });
    return hit.found ? hit : null;
  }

  /** Everything the public page needs. Null when there is no published map at that address. */
  async getPublic(citySlug: string, slug: string) {
    const c = slugify(citySlug);
    const s = slugify(slug);
    const result = await this.cache.wrap(this.cache.buildKey('society-maps:page', [c, s]), async () => {
      const d: any = await this.model.findOne({ citySlug: c, slug: s, status: 'published' }).lean().exec();
      if (!d) return { found: false };

      const [stats, nearby] = await Promise.all([this.listingStats(d.area), this.nearby(d)]);
      return {
        found: true,
        data: {
          id: String(d._id),
          name: d.name,
          slug: d.slug,
          citySlug: d.citySlug,
          cityName: d.cityName,
          areaSlug: d.areaSlug ?? '',
          areaId: d.area ? String(d.area) : '',
          center: d.center,
          zoom: d.zoom ?? 15,
          boundary: d.boundary ?? [],
          layers: SocietyMapService.publicLayers(d),
          blocks: (d.blocks ?? []).map((b: any) => ({ id: String(b._id), name: b.name, slug: b.slug, polygon: b.polygon, color: b.color })),
          pois: (d.pois ?? []).map((p: any) => ({ id: String(p._id), name: p.name, kind: p.kind, lat: p.lat, lng: p.lng })),
          info: d.info ?? {},
          seo: d.seo ?? {},
          faqs: (d.faqs ?? []).filter((f: any) => f.q && f.a),
          sponsor: d.sponsor?.enabled ? d.sponsor : null,
          thumb: SocietyMapService.thumb(d),
          kind: SocietyMapService.kind(d),
          source: d.source ?? 'manual',
          official: SocietyMapService.official(d),
          documents: (d.documents ?? [])
            .filter((x: any) => x.url)
            .map((x: any) => ({ title: x.title, kind: x.kind, url: x.url, thumbUrl: x.thumbUrl ?? '', source: x.source ?? '', sourceUrl: x.sourceUrl ?? '', width: x.width ?? 0, height: x.height ?? 0 })),
          plotCount: d.plotCount ?? 0,
          stats,
          nearby,
          updatedAt: d.updatedAt,
        },
      };
    }, { ttl: 600, tags: [TAG, 'properties'] });
    return result.found ? (result as any).data : null;
  }

  private async listingStats(area: Types.ObjectId | null) {
    const empty = { sale: 0, rent: 0, minPrice: 0, maxPrice: 0 };
    if (!area) return empty;
    const rows = await this.propertyModel
      .aggregate([
        { $match: { area: new Types.ObjectId(String(area)), status: 'approved', availability: { $nin: ['sold', 'rented'] } } },
        { $group: { _id: '$listingType', n: { $sum: 1 }, min: { $min: '$price' }, max: { $max: '$price' } } },
      ])
      .exec();
    const sale = rows.find((r) => r._id === 'sale');
    const rent = rows.find((r) => r._id === 'rent');
    return { sale: sale?.n ?? 0, rent: rent?.n ?? 0, minPrice: sale?.min ?? 0, maxPrice: sale?.max ?? 0 };
  }

  private async nearby(d: any) {
    const rows = await this.model
      .find({ ...SocietyMapService.ON_MAP, citySlug: d.citySlug, _id: { $ne: d._id } })
      .select('name slug citySlug center layers.thumbUrl documents.thumbUrl')
      .limit(400)
      .lean()
      .exec();
    const here = d.center;
    const dist = (x: any) => (here && x.center ? Math.hypot(x.center.lat - here.lat, x.center.lng - here.lng) : 99);
    return rows
      .sort((a, b) => dist(a) - dist(b))
      .slice(0, 8)
      .map((x: any) => ({ name: x.name, slug: x.slug, citySlug: x.citySlug, thumb: SocietyMapService.thumb(x) }));
  }

  /* ───────────────────────────── Admin ───────────────────────────── */

  async adminList() {
    const rows = await this.model
      .find()
      .select('name slug citySlug cityName status layers.name layers.tiles.status layers.tiles.progress layers.thumbUrl documents.url documents.thumbUrl blocks._id source official.authority official.status plotCount updatedAt')
      .sort({ updatedAt: -1 })
      .lean()
      .exec();
    return rows.map((d: any) => ({
      id: String(d._id),
      name: d.name,
      slug: d.slug,
      citySlug: d.citySlug,
      cityName: d.cityName,
      status: d.status,
      thumb: SocietyMapService.thumb(d),
      layers: (d.layers ?? []).map((l: any) => ({ name: l.name, status: l.tiles?.status ?? 'none', progress: l.tiles?.progress ?? 0 })),
      blocks: (d.blocks ?? []).length,
      source: d.source ?? 'manual',
      kind: SocietyMapService.kind(d),
      documents: (d.documents ?? []).length,
      plans: (d.documents ?? []).filter((x: any) => x.url).length,
      official: SocietyMapService.official(d) ? { authority: d.official.authority, status: d.official.status } : null,
      plots: d.plotCount ?? 0,
      updatedAt: d.updatedAt,
    }));
  }

  async adminGet(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Map not found');
    const d: any = await this.model.findById(id).lean().exec();
    if (!d) throw new NotFoundException('Map not found');
    // How well each layer's points agree, in metres on the ground.
    d.layers = (d.layers ?? []).map((l: any) => {
      const t = fitAffine(l.controlPoints ?? []);
      return { ...l, residuals: t ? residuals(t, l.controlPoints) : [] };
    });
    return d;
  }

  async create(body: { name?: string; city?: string; area?: string; slug?: string }) {
    const name = str(body.name, 120);
    if (!name) throw new BadRequestException('Name is required');
    if (!body.city || !Types.ObjectId.isValid(body.city)) throw new BadRequestException('Choose a city');
    const city: any = await this.cityModel.findById(body.city).select('name').lean().exec();
    if (!city) throw new BadRequestException('City not found');

    let area: any = null;
    if (body.area && Types.ObjectId.isValid(body.area)) {
      area = await this.areaModel.findById(body.area).select('name areaSlug city').lean().exec();
      if (!area || String(area.city) !== String(body.city)) throw new BadRequestException('That area is not in this city');
    }

    const slug = slugify(body.slug || area?.areaSlug || name);
    if (!slug) throw new BadRequestException('Slug is required');
    try {
      const doc = await this.model.create({
        name,
        slug,
        city: city._id,
        citySlug: slugify(city.name),
        cityName: city.name,
        area: area?._id ?? null,
        areaSlug: area?.areaSlug ?? '',
        status: 'draft',
      });
      return { id: String(doc._id) };
    } catch (err: any) {
      if (err?.code === 11000) throw new BadRequestException(`A map already uses /emap/${slugify(city.name)}/${slug}`);
      throw err;
    }
  }

  async update(id: string, body: any) {
    const doc = await this.model.findById(id).exec();
    if (!doc) throw new NotFoundException('Map not found');
    const before = { citySlug: doc.citySlug, slug: doc.slug };

    if (body.name !== undefined) doc.name = str(body.name, 120) || doc.name;
    if (body.slug !== undefined) {
      const s = slugify(body.slug);
      if (!s) throw new BadRequestException('Slug cannot be empty');
      doc.slug = s;
    }
    if (body.status === 'draft' || body.status === 'published') doc.status = body.status;
    if (body.area !== undefined) {
      if (body.area && Types.ObjectId.isValid(body.area)) {
        const area: any = await this.areaModel.findById(body.area).select('areaSlug city').lean().exec();
        if (!area || String(area.city) !== String(doc.city)) throw new BadRequestException('That area is not in this city');
        doc.area = area._id;
        doc.areaSlug = area.areaSlug;
      } else {
        doc.area = null;
        doc.areaSlug = '';
      }
    }
    if (body.center !== undefined) {
      const lat = num(body.center?.lat, 20, 40);
      const lng = num(body.center?.lng, 58, 80);
      doc.center = lat !== null && lng !== null ? { lat, lng } : null;
    }
    if (body.zoom !== undefined) doc.zoom = num(body.zoom, 10, 20) ?? 15;
    if (body.boundary !== undefined) doc.boundary = ring(body.boundary);

    if (Array.isArray(body.blocks)) {
      doc.blocks = body.blocks.slice(0, 300).map((b: any) => ({
        ...(b.id && Types.ObjectId.isValid(b.id) ? { _id: new Types.ObjectId(b.id) } : {}),
        name: str(b.name, 60) || 'Block',
        slug: slugify(b.name) || 'block',
        polygon: ring(b.polygon, 500),
        color: /^#[0-9a-f]{6}$/i.test(b.color ?? '') ? b.color : '',
      })) as any;
    }
    if (Array.isArray(body.pois)) {
      doc.pois = body.pois
        .slice(0, 300)
        .map((p: any) => ({
          ...(p.id && Types.ObjectId.isValid(p.id) ? { _id: new Types.ObjectId(p.id) } : {}),
          name: str(p.name, 80),
          kind: (POI_KINDS as readonly string[]).includes(p.kind) ? p.kind : 'landmark',
          lat: num(p.lat, 20, 40),
          lng: num(p.lng, 58, 80),
        }))
        .filter((p: any) => p.name && p.lat !== null && p.lng !== null) as any;
    }
    if (body.info && typeof body.info === 'object') {
      doc.info = {
        developer: str(body.info.developer, 120),
        approval: str(body.info.approval, 160),
        totalArea: str(body.info.totalArea, 80),
        launched: str(body.info.launched, 40),
        possession: str(body.info.possession, 120),
        plotSizes: str(body.info.plotSizes, 200),
        amenities: Array.isArray(body.info.amenities) ? body.info.amenities.map((a: unknown) => str(a, 60)).filter(Boolean).slice(0, 40) : [],
      };
    }
    if (body.seo && typeof body.seo === 'object') {
      doc.seo = {
        metaTitle: str(body.seo.metaTitle, 80),
        metaDescription: str(body.seo.metaDescription, 200),
        intro: str(body.seo.intro, 600),
        content: typeof body.seo.content === 'string' ? body.seo.content.slice(0, 100_000) : '',
      };
    }
    if (Array.isArray(body.faqs)) {
      doc.faqs = body.faqs.slice(0, 30).map((f: any) => ({ q: str(f.q, 200), a: str(f.a, 2000) })).filter((f: any) => f.q && f.a) as any;
    }
    if (body.sponsor && typeof body.sponsor === 'object') {
      doc.sponsor = {
        enabled: !!body.sponsor.enabled,
        name: str(body.sponsor.name, 80),
        tagline: str(body.sponsor.tagline, 120),
        phone: str(body.sponsor.phone, 30),
        whatsapp: str(body.sponsor.whatsapp, 30),
        logoUrl: str(body.sponsor.logoUrl, 500),
        link: str(body.sponsor.link, 500),
      };
    }
    if (body.downloadEnabled !== undefined) doc.downloadEnabled = !!body.downloadEnabled;

    // Layer settings the dashboard owns. Tiles, files and sizes stay the server's.
    if (Array.isArray(body.layers)) {
      for (const patch of body.layers) {
        const layer: any = doc.layers.find((l: any) => String(l._id) === String(patch.id));
        if (!layer) continue;
        if (patch.name !== undefined) layer.name = str(patch.name, 80) || layer.name;
        if (patch.opacity !== undefined) layer.opacity = num(patch.opacity, 0, 1) ?? layer.opacity;
        if (patch.visible !== undefined) layer.visible = !!patch.visible;
        if (patch.order !== undefined) layer.order = num(patch.order, 0, 100) ?? 0;
        if (Array.isArray(patch.controlPoints)) {
          layer.controlPoints = patch.controlPoints
            .slice(0, 40)
            .map((p: any) => ({
              px: num(p.px, 0, layer.width),
              py: num(p.py, 0, layer.height),
              lat: num(p.lat, 20, 40),
              lng: num(p.lng, 58, 80),
            }))
            .filter((p: any) => p.px !== null && p.py !== null && p.lat !== null && p.lng !== null);
          const t = fitAffine(layer.controlPoints);
          layer.corners = t ? cornersOf(t, layer.width, layer.height) : undefined;
        }
      }
    }

    doc.bbox = SocietyMapService.bboxOf(doc);
    if (!doc.center && doc.bbox) {
      doc.center = { lat: (doc.bbox.minLat + doc.bbox.maxLat) / 2, lng: (doc.bbox.minLng + doc.bbox.maxLng) / 2 };
    }

    try {
      await doc.save();
    } catch (err: any) {
      if (err?.code === 11000) throw new BadRequestException(`Another map already uses /emap/${doc.citySlug}/${doc.slug}`);
      throw err;
    }
    this.refresh([before, { citySlug: doc.citySlug, slug: doc.slug }]);
    return this.adminGet(id);
  }

  /** The box covering the boundary, every placed layer and the centre. */
  private static bboxOf(doc: any) {
    const pts: number[][] = [...(doc.boundary ?? [])];
    for (const l of doc.layers ?? []) {
      if (l.tiles?.status === 'ready' && l.tiles.bounds?.length === 4) {
        const [s, w, n, e] = l.tiles.bounds;
        pts.push([s, w], [n, e]);
      } else if (l.corners?.length) pts.push(...l.corners);
    }
    for (const b of doc.blocks ?? []) pts.push(...(b.polygon ?? []));
    if (doc.center) pts.push([doc.center.lat, doc.center.lng]);
    if (!pts.length) return null;
    return {
      minLat: Math.min(...pts.map((p) => p[0]!)),
      maxLat: Math.max(...pts.map((p) => p[0]!)),
      minLng: Math.min(...pts.map((p) => p[1]!)),
      maxLng: Math.max(...pts.map((p) => p[1]!)),
    };
  }

  private refresh(addresses: { citySlug: string; slug: string }[]) {
    const paths = new Set<string>(['/emap']);
    for (const a of addresses) {
      paths.add(`/emap/${a.citySlug}`);
      paths.add(`/emap/${a.citySlug}/${a.slug}`);
    }
    void this.revalidate.revalidate({ tags: [TAG], paths: [...paths] });
  }

  async remove(id: string) {
    const doc: any = await this.model.findByIdAndDelete(id).lean().exec();
    if (!doc) throw new NotFoundException('Map not found');
    await this.tiler.removeFiles(id);
    this.refresh([{ citySlug: doc.citySlug, slug: doc.slug }]);
    return { deleted: true };
  }

  /** A new map image: kept privately in full, with a preview for aligning and a card thumbnail. */
  async addLayer(id: string, file: Express.Multer.File | undefined, name?: string) {
    if (!file?.buffer?.length) throw new BadRequestException('Choose an image');
    return this.addLayerFromBuffer(id, file.buffer, file.originalname, file.mimetype, name);
  }

  /**
   * One of the map's official documents (the LDA approved layout plan, …) as
   * a map image, ready to align with control points — the same image the page
   * already shows, so nothing is downloaded again.
   */
  async addLayerFromDocument(id: string, index: number) {
    const doc: any = await this.model.findById(id).select('documents').lean().exec();
    if (!doc) throw new NotFoundException('Map not found');
    const d = doc.documents?.[index];
    if (!d?.url) throw new BadRequestException('That document has no stored image yet');
    const key = String(d.url).split('/society-maps/')[1];
    const buffer = key ? await this.storage.readBuffer(`society-maps/${key}`) : null;
    if (!buffer?.length) throw new BadRequestException('The stored image could not be read');
    return this.addLayerFromBuffer(id, buffer, `${key}`, 'image/jpeg', String(d.title || 'Approved layout plan').slice(0, 80));
  }

  private async addLayerFromBuffer(id: string, buffer: Buffer, originalname: string, mimetype: string, name?: string) {
    const doc = await this.model.findById(id).exec();
    if (!doc) throw new NotFoundException('Map not found');
    if (doc.layers.length >= 12) throw new BadRequestException('A map can have at most 12 images');

    const file = { originalname, mimetype };
    let input = buffer;
    const isPdf = file.mimetype === 'application/pdf' || /\.pdf$/i.test(file.originalname) || input.subarray(0, 5).toString() === '%PDF-';
    if (isPdf) input = await SocietyMapService.pdfToPng(input);
    let meta: sharp.Metadata;
    try {
      meta = await sharp(input, { limitInputPixels: 400e6 }).metadata();
    } catch {
      throw new BadRequestException('That file is not an image sharp can read. Upload a JPG, PNG, WebP or TIFF (export PDFs to PNG first).');
    }
    if (!meta.width || !meta.height) throw new BadRequestException('Could not read the image size');
    // Photos from phones carry a rotation flag; bake it in so the points line up.
    if (meta.orientation && meta.orientation > 1) {
      input = await sharp(input, { limitInputPixels: 400e6 }).rotate().png().toBuffer();
      meta = await sharp(input, { limitInputPixels: 400e6 }).metadata();
    }

    const layerId = new Types.ObjectId();
    const base = `society-maps/${id}/${layerId}`;
    const tag = randomBytes(6).toString('hex');
    const ext = isPdf ? '.png' : (file.originalname.match(/\.(jpe?g|png|webp|tiff?)$/i)?.[0] ?? '.img').toLowerCase();

    await this.tiler.saveSource(`${base}/source${ext}`, input);
    const preview = await sharp(input, { limitInputPixels: 400e6 })
      .resize(2400, 2400, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
    const thumb = await sharp(input, { limitInputPixels: 400e6 })
      .resize(640, 420, { fit: 'cover' })
      .flatten({ background: '#ffffff' })
      .webp({ quality: 72 })
      .toBuffer();
    const previewKey = `${base}/preview-${tag}.webp`;
    const thumbKey = `${base}/thumb-${tag}.webp`;
    await this.storage.putBuffer(previewKey, preview.data);
    await this.storage.putBuffer(thumbKey, thumb);

    doc.layers.push({
      _id: layerId,
      name: str(name, 80) || (doc.layers.length ? `Map ${doc.layers.length + 1}` : 'Master plan'),
      sourceKey: `${base}/source${ext}`,
      width: meta.width,
      height: meta.height,
      previewUrl: this.storage.getUrl(previewKey),
      previewWidth: preview.info.width,
      previewHeight: preview.info.height,
      thumbUrl: this.storage.getUrl(thumbKey),
      controlPoints: [],
      opacity: 0.85,
      visible: true,
      order: doc.layers.length,
      tiles: { status: 'none', version: 0, progress: 0 },
    } as any);
    await doc.save();
    return this.adminGet(id);
  }

  /**
   * Official master plans are mostly PDFs. The first page is drawn to a PNG
   * about 9000px on its long side with poppler's pdftoppm — on the server:
   * `sudo apt install poppler-utils` (sharp cannot read PDFs itself).
   */
  private static async pdfToPng(pdf: Buffer): Promise<Buffer> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'society-pdf-'));
    try {
      const src = path.join(dir, 'plan.pdf');
      await fs.writeFile(src, pdf);
      try {
        await promisify(execFile)('pdftoppm', ['-png', '-f', '1', '-l', '1', '-scale-to', '9000', '-singlefile', src, path.join(dir, 'page')], { timeout: 180_000 });
      } catch (err: any) {
        if (err?.code === 'ENOENT') {
          throw new BadRequestException('PDF plans need poppler on the server (sudo apt install poppler-utils). Or upload the plan as a PNG/JPG.');
        }
        throw new BadRequestException('That PDF could not be read. Export the plan page as a PNG and upload that.');
      }
      return await fs.readFile(path.join(dir, 'page.png'));
    } finally {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  async removeLayer(id: string, layerId: string) {
    const doc = await this.model.findById(id).exec();
    if (!doc) throw new NotFoundException('Map not found');
    const before = doc.layers.length;
    doc.layers = doc.layers.filter((l: any) => String(l._id) !== layerId) as any;
    if (doc.layers.length === before) throw new NotFoundException('Image not found');
    doc.bbox = SocietyMapService.bboxOf(doc);
    await doc.save();
    await this.tiler.removeFiles(id, layerId);
    this.refresh([{ citySlug: doc.citySlug, slug: doc.slug }]);
    return this.adminGet(id);
  }

  /* ───────────────────────── Moving a map between sites ───────────────────────── */

  /**
   * One file with everything about a map — its fields, and each image with its
   * matching points — so a map prepared on one copy of the site (a laptop, a
   * staging server) can be loaded into another with one upload. Tiles are not
   * included: the receiving site makes its own.
   */
  async exportPackage(id: string) {
    const d: any = await this.model.findById(id).lean().exec();
    if (!d) throw new NotFoundException('Map not found');
    const layers: Record<string, unknown>[] = [];
    for (const l of d.layers ?? []) {
      const src = await this.tiler.readSource(l.sourceKey);
      if (!src) continue;
      layers.push({
        name: l.name,
        opacity: l.opacity,
        visible: l.visible,
        order: l.order,
        width: l.width,
        height: l.height,
        controlPoints: l.controlPoints ?? [],
        image: { ext: (l.sourceKey.match(/\.[a-z]+$/i)?.[0] ?? '.png').toLowerCase(), base64: src.toString('base64') },
      });
    }
    return {
      format: 'pd-society-map/1',
      exportedAt: new Date().toISOString(),
      name: d.name,
      slug: d.slug,
      citySlug: d.citySlug,
      cityName: d.cityName,
      areaSlug: d.areaSlug ?? '',
      status: d.status,
      center: d.center,
      zoom: d.zoom,
      boundary: d.boundary ?? [],
      blocks: (d.blocks ?? []).map((b: any) => ({ name: b.name, polygon: b.polygon, color: b.color })),
      pois: (d.pois ?? []).map((p: any) => ({ name: p.name, kind: p.kind, lat: p.lat, lng: p.lng })),
      info: d.info ?? {},
      seo: d.seo ?? {},
      faqs: d.faqs ?? [],
      sponsor: d.sponsor ?? { enabled: false },
      downloadEnabled: !!d.downloadEnabled,
      layers,
    };
  }

  /**
   * Loads an exported map. The city is found by name and the area by its slug
   * in that city; a map already at the same address is left alone unless
   * `replace` is set (then its images are replaced). Tiles are queued.
   */
  async importPackage(raw: Buffer, replace = false) {
    let pkg: any;
    try {
      pkg = JSON.parse(raw.toString('utf8'));
    } catch {
      throw new BadRequestException('Not a society map file');
    }
    return this.importObject(pkg, async (i) => Buffer.from(String(pkg.layers?.[i]?.image?.base64 ?? ''), 'base64'), replace);
  }

  /**
   * The same, from a folder: map.json plus each layer's image file beside it
   * (data/society-maps/<city>-<slug>/ — how maps ship with the code).
   */
  async importFolder(dir: string, replace = false) {
    const pkg = JSON.parse(await fs.readFile(path.join(dir, 'map.json'), 'utf8'));
    return this.importObject(pkg, (i) => fs.readFile(path.join(dir, String(pkg.layers?.[i]?.file ?? ''))), replace);
  }

  /** Is there a map at this address already? */
  async exists(citySlug: string, slug: string) {
    return !!(await this.model.exists({ citySlug: slugify(citySlug), slug: slugify(slug) }));
  }

  private async importObject(pkg: any, image: (i: number) => Promise<Buffer>, replace: boolean) {
    if (pkg?.format !== 'pd-society-map/1') throw new BadRequestException('Not a society map file');

    const cities = await this.cityModel.collection.find({}, { projection: { name: 1 } }).toArray();
    const city: any = cities.find((c: any) => slugify(c.name) === pkg.citySlug || String(c.name).toLowerCase() === String(pkg.cityName ?? '').toLowerCase());
    if (!city) throw new BadRequestException(`City "${pkg.cityName ?? pkg.citySlug}" is not on this site`);
    const area: any = pkg.areaSlug
      ? await this.areaModel.collection.findOne({ areaSlug: pkg.areaSlug, city: { $in: [city._id, String(city._id)] } })
      : null;

    const slug = slugify(pkg.slug);
    let doc: any = await this.model.findOne({ citySlug: slugify(city.name), slug }).exec();
    if (doc && !replace) return { id: String(doc._id), name: doc.name, skipped: true, reason: 'A map is already at this address' };
    if (!doc) {
      const { id } = await this.create({ name: pkg.name, city: String(city._id), area: area ? String(area._id) : undefined, slug });
      doc = await this.model.findById(id).exec();
    } else {
      for (const l of doc.layers as any[]) await this.tiler.removeFiles(String(doc._id), String(l._id));
      doc.layers = [] as any;
      await doc.save();
    }
    const id = String(doc._id);

    for (const [i, l] of (pkg.layers ?? []).entries()) {
      const buffer = await image(i).catch(() => Buffer.alloc(0));
      if (!buffer.length) continue;
      await this.addLayer(id, { buffer, originalname: `plan${l.image?.ext ?? path.extname(String(l.file ?? '')) ?? '.png'}`, mimetype: 'application/octet-stream' } as Express.Multer.File, l.name);
    }
    const fresh: any = await this.model.findById(id).lean().exec();
    await this.update(id, {
      status: pkg.status === 'published' ? 'published' : 'draft',
      center: pkg.center,
      zoom: pkg.zoom,
      boundary: pkg.boundary,
      blocks: pkg.blocks,
      pois: pkg.pois,
      info: pkg.info,
      seo: pkg.seo,
      faqs: pkg.faqs,
      sponsor: pkg.sponsor,
      downloadEnabled: pkg.downloadEnabled,
      ...(area ? { area: String(area._id) } : {}),
      layers: (fresh.layers ?? []).map((l: any, i: number) => ({
        id: String(l._id),
        opacity: pkg.layers[i]?.opacity,
        visible: pkg.layers[i]?.visible,
        order: pkg.layers[i]?.order,
        controlPoints: pkg.layers[i]?.controlPoints ?? [],
      })),
    });
    const placed: any = await this.model.findById(id).lean().exec();
    let queued = 0;
    for (const l of placed.layers ?? []) {
      if (fitAffine(l.controlPoints ?? [])) {
        await this.tiler.enqueue(id, String(l._id));
        queued++;
      }
    }
    return { id, name: placed.name, url: `/emap/${placed.citySlug}/${placed.slug}`, linkedArea: !!area, tiling: queued };
  }

  async tile(id: string, layerId: string) {
    const doc: any = await this.model.findById(id).lean().exec();
    const layer = doc?.layers?.find((l: any) => String(l._id) === layerId);
    if (!layer) throw new NotFoundException('Image not found');
    if (!fitAffine(layer.controlPoints ?? [])) {
      throw new BadRequestException('Place at least three matching points (spread across the map) first.');
    }
    if (layer.tiles?.status === 'queued' || layer.tiles?.status === 'processing') {
      throw new BadRequestException('This image is already being processed');
    }
    await this.tiler.enqueue(id, layerId);
    return { queued: true };
  }
}

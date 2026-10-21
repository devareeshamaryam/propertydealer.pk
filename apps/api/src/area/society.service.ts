/* eslint-disable prettier/prettier */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';
import { Area, AreaDocument, SocietyGuide } from '@rent-ghar/db/schemas/area.schema';
import { cleanPlaceName } from '../common/place-name';
import { RedisCacheService } from '../redis-cache/redis-cache.service';
import { RevalidateService } from '../revalidate/revalidate.service';

/*
 * Housing societies.
 *
 * A society is an area marked kind "society": its listing pages stay exactly
 * where they were (/properties/sale/<city>/<society>), and it gains a guide
 * page (/societies/<city>/<society>) with what the admin wrote about it. Its
 * phases are areas of the same city marked kind "phase" with `parent` set to
 * the society — they too keep their listing pages, and the society's pages
 * include their listings. Localities and mohallas stay plain areas.
 */

const TAGS = ['areas', 'societies'];
const slugify = (t: string) => String(t ?? '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const both = (id: unknown) => [new Types.ObjectId(String(id)), String(id)];
const text = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
const list = (v: unknown, maxItems: number, maxLen: number) =>
  (Array.isArray(v) ? v : String(v ?? '').split('\n'))
    .map((x) => text(x, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);

/** "5 Marla", "1 Kanal" — how sizes are said in Pakistan. */
export function sizeLabel(marla: number): string {
  if (marla >= 20 && marla % 20 === 0) return `${marla / 20} Kanal`;
  return `${Number(marla.toFixed(1))} Marla`;
}
/** The listing page segment for a size: "5marla", "1kanal". */
const sizeSegment = (marla: number) => (marla >= 20 && marla % 20 === 0 ? `${marla / 20}kanal` : Number.isInteger(marla) ? `${marla}marla` : '');

export interface SocietyCardRow {
  _id: string;
  name: string;
  slug: string;
  citySlug: string;
  cityName: string;
  image: string;
  tagline: string;
  approval: string;
  approvedBy: string;
  phases: number;
  listings: number;
  priceFrom: number;
  lat?: number;
  lng?: number;
}

@Injectable()
export class SocietyService {
  constructor(
    @InjectModel(Area.name) private areaModel: Model<AreaDocument>,
    private readonly cache: RedisCacheService,
    private readonly revalidate: RevalidateService,
  ) {}

  private get areas() {
    return this.areaModel.collection;
  }
  private get db() {
    return this.areaModel.db;
  }

  private async cities(): Promise<{ _id: Types.ObjectId; name: string; slug: string }[]> {
    const rows = await this.db.collection('cities').find({}, { projection: { name: 1 } }).toArray();
    return rows.map((c: any) => ({ _id: c._id, name: String(c.name), slug: slugify(c.name) }));
  }

  private async cityBySlug(slug: string) {
    const want = slugify(slug);
    return (await this.cities()).find((c) => c.slug === want) ?? null;
  }

  /** Live listings per area id (sale / rent), for a set of areas. */
  private async listingCounts(ids: unknown[]) {
    if (!ids.length) return new Map<string, { sale: number; rent: number }>();
    const rows = await this.db
      .collection('properties')
      .aggregate([
        { $match: { status: 'approved', area: { $in: ids.flatMap(both) } } },
        { $group: { _id: { a: { $toString: '$area' }, t: '$listingType' }, n: { $sum: 1 } } },
      ])
      .toArray();
    const out = new Map<string, { sale: number; rent: number }>();
    for (const r of rows as any[]) {
      const c = out.get(r._id.a) ?? { sale: 0, rent: 0 };
      if (r._id.t === 'rent') c.rent += r.n;
      else c.sale += r.n;
      out.set(r._id.a, c);
    }
    return out;
  }

  private async bust(citySlug?: string, slug?: string) {
    await this.cache.invalidateTags(TAGS).catch(() => undefined);
    const paths = ['/societies'];
    if (citySlug) {
      paths.push(`/societies/${citySlug}`, `/properties/sale/${citySlug}`, `/properties/rent/${citySlug}`, `/properties/all/${citySlug}`);
      if (slug) paths.push(`/societies/${citySlug}/${slug}`, `/properties/sale/${citySlug}/${slug}`, `/properties/rent/${citySlug}/${slug}`);
    }
    await this.revalidate.revalidate({ tags: [...TAGS, 'properties'], paths }).catch(() => undefined);
  }

  // ── Public ────────────────────────────────────────────────────────────

  /** Published societies — of one city, or all — with their card details. Most listings first. */
  async listSocieties(citySlug?: string): Promise<SocietyCardRow[]> {
    return this.cache.wrap(
      this.cache.buildKey('societies:list', [citySlug ?? 'all']),
      async () => {
        const cities = await this.cities();
        const city = citySlug ? cities.find((c) => c.slug === slugify(citySlug)) : null;
        if (citySlug && !city) return [];
        const q: Record<string, unknown> = { kind: 'society', 'guide.published': true, mergedInto: { $in: [null] } };
        if (city) q.city = { $in: both(city._id) };
        const rows = await this.areas
          .find(q, { projection: { name: 1, areaSlug: 1, city: 1, lat: 1, lng: 1, 'guide.image': 1, 'guide.tagline': 1, 'guide.approval': 1, 'guide.approvedBy': 1 } })
          .toArray();
        if (!rows.length) return [];
        const phases = await this.areas
          .find({ parent: { $in: rows.flatMap((r) => both(r._id)) }, mergedInto: { $in: [null] } }, { projection: { parent: 1 } })
          .toArray();
        const family = new Map<string, string[]>();
        for (const r of rows) family.set(String(r._id), [String(r._id)]);
        for (const p of phases) family.get(String(p.parent))?.push(String(p._id));
        const allIds = [...family.values()].flat();
        const [counts, prices] = await Promise.all([
          this.listingCounts(allIds),
          this.db
            .collection('properties')
            .aggregate([
              { $match: { status: 'approved', listingType: 'sale', price: { $gt: 0 }, area: { $in: allIds.flatMap(both) } } },
              { $group: { _id: { $toString: '$area' }, min: { $min: '$price' } } },
            ])
            .toArray(),
        ]);
        const minBy = new Map(prices.map((p: any) => [String(p._id), p.min as number]));
        const cityOf = new Map(cities.map((c) => [String(c._id), c]));
        return rows
          .map((r: any) => {
            const ids = family.get(String(r._id)) ?? [];
            const c = cityOf.get(String(r.city));
            const mins = ids.map((i) => minBy.get(i)).filter((v): v is number => !!v);
            return {
              _id: String(r._id),
              name: r.name,
              slug: r.areaSlug || slugify(r.name),
              citySlug: c?.slug ?? '',
              cityName: c?.name ?? '',
              image: r.guide?.image ?? '',
              tagline: r.guide?.tagline ?? '',
              approval: r.guide?.approval ?? '',
              approvedBy: r.guide?.approvedBy ?? '',
              phases: ids.length - 1,
              listings: ids.reduce((n, i) => n + (counts.get(i)?.sale ?? 0) + (counts.get(i)?.rent ?? 0), 0),
              priceFrom: mins.length ? Math.min(...mins) : 0,
              ...(r.lat && r.lng ? { lat: r.lat, lng: r.lng } : {}),
            };
          })
          .filter((s) => s.citySlug)
          .sort((a, b) => b.listings - a.listings || a.name.localeCompare(b.name));
      },
      { ttl: 600, tags: [...TAGS, 'properties'] },
    );
  }

  /** Everything the guide page shows. Null when there is no published society at this address. */
  async societyPage(citySlug: string, slug: string, preview = false) {
    return this.cache.wrap(
      this.cache.buildKey('societies:page', [citySlug, slug, preview ? 'p' : '']),
      async () => {
        const city = await this.cityBySlug(citySlug);
        if (!city) return null;
        const doc: any = await this.areas.findOne({ city: { $in: both(city._id) }, areaSlug: slugify(slug), kind: 'society' });
        if (!doc || (!preview && !doc.guide?.published)) return null;
        const id = String(doc._id);
        const phaseRows = await this.areas
          .find({ parent: { $in: both(id) }, mergedInto: { $in: [null] } }, { projection: { name: 1, areaSlug: 1, order: 1, guide: 1 } })
          .toArray();
        const ids = [id, ...phaseRows.map((p) => String(p._id))];
        const inIds = ids.flatMap(both);
        const props = this.db.collection('properties');
        const [counts, sizes, latestUpdate, maps] = await Promise.all([
          this.listingCounts(ids),
          // Price ranges by type and size — the "House prices in …" tables.
          props
            .aggregate([
              { $match: { status: 'approved', area: { $in: inIds }, price: { $gt: 0 }, marla: { $gt: 0 }, propertyType: { $in: ['house', 'plot', 'flat', 'apartment', 'commercial', 'shop'] } } },
              {
                $group: {
                  _id: { t: { $cond: [{ $in: ['$propertyType', ['flat', 'apartment']] }, 'flat', { $cond: [{ $in: ['$propertyType', ['commercial', 'shop']] }, 'commercial', '$propertyType'] }] }, l: '$listingType', m: { $round: ['$marla', 1] } },
                  min: { $min: '$price' },
                  max: { $max: '$price' },
                  n: { $sum: 1 },
                },
              },
            ])
            .toArray(),
          props.find({ status: 'approved', area: { $in: inIds } }, { projection: { updatedAt: 1 } }).sort({ updatedAt: -1 }).limit(1).toArray(),
          // A published society map on the society or one of its phases.
          this.db
            .collection('societymaps')
            .find({ status: 'published', area: { $in: inIds } }, { projection: { name: 1, slug: 1, citySlug: 1, area: 1, center: 1, layers: { $slice: 1 } } })
            .toArray(),
        ]);

        type Row = { size: string; marla: number; segment: string; min: number; max: number; count: number };
        const prices: Record<string, { sale: Row[]; rent: Row[] }> = {};
        for (const g of sizes as any[]) {
          const t = String(g._id.t);
          const l = g._id.l === 'rent' ? 'rent' : 'sale';
          const m = Number(g._id.m);
          (prices[t] ??= { sale: [], rent: [] })[l].push({ size: sizeLabel(m), marla: m, segment: sizeSegment(m), min: g.min, max: g.max, count: g.n });
        }
        for (const t of Object.values(prices)) for (const k of ['sale', 'rent'] as const) t[k].sort((a, b) => a.marla - b.marla);

        const summary = (t: string, l: 'sale' | 'rent') => {
          const rows = prices[t]?.[l] ?? [];
          if (!rows.length) return null;
          return { min: Math.min(...rows.map((r) => r.min)), max: Math.max(...rows.map((r) => r.max)), count: rows.reduce((n, r) => n + r.count, 0) };
        };

        const total = ids.reduce((acc, i) => ({ sale: acc.sale + (counts.get(i)?.sale ?? 0), rent: acc.rent + (counts.get(i)?.rent ?? 0) }), { sale: 0, rent: 0 });
        const own = maps.find((m: any) => String(m.area) === id) ?? maps[0];

        const phases = phaseRows
          .map((p: any) => ({
            _id: String(p._id),
            name: p.name,
            slug: p.areaSlug || slugify(p.name),
            order: p.order ?? 0,
            image: p.guide?.image ?? '',
            tagline: p.guide?.tagline ?? '',
            overview: p.guide?.overview ?? '',
            sale: counts.get(String(p._id))?.sale ?? 0,
            rent: counts.get(String(p._id))?.rent ?? 0,
            map: (() => {
              const m: any = maps.find((x: any) => String(x.area) === String(p._id));
              return m ? { slug: m.slug, citySlug: m.citySlug } : null;
            })(),
          }))
          .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, undefined, { numeric: true }));

        // Nearby: other published societies of the city, closest first when both have a location.
        const others = (await this.listSocieties(city.slug)).filter((s) => s._id !== id);
        const dist = (s: SocietyCardRow) =>
          doc.lat && doc.lng && s.lat && s.lng ? Math.hypot(doc.lat - s.lat, (doc.lng - s.lng) * Math.cos((doc.lat * Math.PI) / 180)) : Number.POSITIVE_INFINITY;
        const nearby = others.sort((a, b) => dist(a) - dist(b) || b.listings - a.listings).slice(0, 8);

        return {
          _id: id,
          name: doc.name,
          slug: doc.areaSlug || slugify(doc.name),
          city: { _id: String(city._id), name: city.name, slug: city.slug },
          lat: doc.lat ?? null,
          lng: doc.lng ?? null,
          guide: (doc.guide ?? {}) as SocietyGuide,
          published: !!doc.guide?.published,
          phases,
          stats: {
            sale: total.sale,
            rent: total.rent,
            house: summary('house', 'sale'),
            plot: summary('plot', 'sale'),
            flat: summary('flat', 'sale'),
            houseRent: summary('house', 'rent'),
          },
          prices,
          map: own
            ? { slug: (own as any).slug, citySlug: (own as any).citySlug, name: (own as any).name, thumb: (own as any).layers?.[0]?.thumbUrl ?? '', center: (own as any).center ?? null }
            : null,
          nearby,
          updatedAt: latestUpdate[0]?.updatedAt ?? doc.updatedAt ?? null,
        };
      },
      { ttl: 600, tags: [...TAGS, 'properties', 'society-maps'] },
    );
  }

  /** For a listing page: the society guide of this area (or of its society, for a phase), when published. */
  async guideFor(citySlug: string, areaSlug: string) {
    const city = await this.cityBySlug(citySlug);
    if (!city) return null;
    const area: any = await this.areas.findOne({ city: { $in: both(city._id) }, areaSlug: slugify(areaSlug) }, { projection: { name: 1, areaSlug: 1, kind: 1, parent: 1, guide: 1 } });
    if (!area) return null;
    const society: any = area.kind === 'society' ? area : area.kind === 'phase' && area.parent ? await this.areas.findOne({ _id: new Types.ObjectId(String(area.parent)) }, { projection: { name: 1, areaSlug: 1, kind: 1, guide: 1 } }) : null;
    if (!society || society.kind !== 'society') return null;
    const phases = await this.areas
      .find({ parent: { $in: both(society._id) }, mergedInto: { $in: [null] } }, { projection: { name: 1, areaSlug: 1, order: 1 } })
      .toArray();
    return {
      name: society.name,
      slug: society.areaSlug,
      citySlug: city.slug,
      url: society.guide?.published ? `/societies/${city.slug}/${society.areaSlug}` : null,
      image: society.guide?.image ?? '',
      tagline: society.guide?.tagline ?? '',
      isPhase: area.kind === 'phase',
      phases: phases
        .map((p: any) => ({ name: p.name, slug: p.areaSlug, order: p.order ?? 0 }))
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, undefined, { numeric: true })),
    };
  }

  // ── Dashboard ─────────────────────────────────────────────────────────

  /** Every society, with its city, phases, listings and whether its guide is live. */
  async adminList() {
    const [rows, cities] = await Promise.all([
      this.areas.find({ kind: 'society' }, { projection: { name: 1, areaSlug: 1, city: 1, 'guide.published': 1, 'guide.image': 1, updatedAt: 1 } }).toArray(),
      this.cities(),
    ]);
    const phases = await this.areas.find({ parent: { $in: rows.flatMap((r) => both(r._id)) } }, { projection: { parent: 1 } }).toArray();
    const counts = await this.listingCounts([...rows.map((r) => String(r._id)), ...phases.map((p) => String(p._id))]);
    const cityOf = new Map(cities.map((c) => [String(c._id), c]));
    return rows
      .map((r: any) => {
        const kids = phases.filter((p) => String(p.parent) === String(r._id)).map((p) => String(p._id));
        const listings = [String(r._id), ...kids].reduce((n, i) => n + (counts.get(i)?.sale ?? 0) + (counts.get(i)?.rent ?? 0), 0);
        const c = cityOf.get(String(r.city));
        return {
          _id: String(r._id),
          name: r.name,
          slug: r.areaSlug,
          cityId: String(r.city),
          cityName: c?.name ?? '',
          citySlug: c?.slug ?? '',
          image: r.guide?.image ?? '',
          published: !!r.guide?.published,
          phases: kids.length,
          listings,
          updatedAt: r.updatedAt,
        };
      })
      .sort((a, b) => a.cityName.localeCompare(b.cityName) || a.name.localeCompare(b.name));
  }

  /** The editor: the society (or the area about to become one), its phases, and the city's other areas to pick phases from. */
  async adminGet(id: string) {
    if (!isValidObjectId(id)) throw new NotFoundException('Society not found');
    const doc: any = await this.areas.findOne({ _id: new Types.ObjectId(id) });
    if (!doc) throw new NotFoundException('Society not found');
    const cities = await this.cities();
    const city = cities.find((c) => String(c._id) === String(doc.city));
    const inCity = await this.areas
      .find({ city: { $in: both(doc.city) }, mergedInto: { $in: [null] }, _id: { $ne: doc._id } }, { projection: { name: 1, areaSlug: 1, kind: 1, parent: 1, order: 1, guide: 1 } })
      .toArray();
    const counts = await this.listingCounts([id, ...inCity.map((a) => String(a._id))]);
    const row = (a: any) => ({
      _id: String(a._id),
      name: a.name,
      slug: a.areaSlug,
      kind: a.kind ?? 'area',
      parent: a.parent ? String(a.parent) : null,
      order: a.order ?? 0,
      listings: (counts.get(String(a._id))?.sale ?? 0) + (counts.get(String(a._id))?.rent ?? 0),
      image: a.guide?.image ?? '',
      tagline: a.guide?.tagline ?? '',
      overview: a.guide?.overview ?? '',
    });
    return {
      _id: id,
      name: doc.name,
      slug: doc.areaSlug,
      kind: doc.kind ?? 'area',
      cityId: String(doc.city),
      cityName: city?.name ?? '',
      citySlug: city?.slug ?? '',
      lat: doc.lat ?? null,
      lng: doc.lng ?? null,
      guide: doc.guide ?? {},
      listings: (counts.get(id)?.sale ?? 0) + (counts.get(id)?.rent ?? 0),
      phases: inCity.filter((a: any) => String(a.parent) === id).map(row).sort((a, b) => a.order - b.order),
      // Areas that could become a phase: not a society themselves, not another society's phase.
      candidates: inCity
        .filter((a: any) => a.kind !== 'society' && (!a.parent || String(a.parent) === id))
        .map(row)
        .sort((a, b) => b.listings - a.listings || a.name.localeCompare(b.name)),
    };
  }

  private cleanGuide(raw: any, prev: SocietyGuide = {}): SocietyGuide {
    const g = raw ?? {};
    const pick = <K extends keyof SocietyGuide>(k: K, v: SocietyGuide[K]) => (g[k] !== undefined ? v : prev[k]);
    const approval = ['approved', 'in-process', 'not-approved'].includes(g.approval) ? g.approval : '';
    return {
      published: pick('published', g.published === true || g.published === 'true'),
      image: pick('image', text(g.image, 500)),
      gallery: pick('gallery', list(g.gallery, 30, 500)),
      tagline: pick('tagline', text(g.tagline, 160)),
      overview: pick('overview', String(g.overview ?? '').slice(0, 100_000)),
      developer: pick('developer', text(g.developer, 160)),
      approvedBy: pick('approvedBy', text(g.approvedBy, 120)),
      approval: pick('approval', approval),
      totalArea: pick('totalArea', text(g.totalArea, 80)),
      launched: pick('launched', text(g.launched, 80)),
      possession: pick('possession', text(g.possession, 120)),
      plotSizes: pick('plotSizes', text(g.plotSizes, 200)),
      address: pick('address', text(g.address, 240)),
      nearby: pick('nearby', list(g.nearby, 30, 160)),
      amenities: pick('amenities', list(g.amenities, 40, 80)),
      paymentPlan: pick('paymentPlan', String(g.paymentPlan ?? '').slice(0, 50_000)),
      phone: pick('phone', text(g.phone, 40)),
      website: pick('website', /^https?:\/\//i.test(text(g.website, 300)) ? text(g.website, 300) : ''),
      faqs: pick(
        'faqs',
        (Array.isArray(g.faqs) ? g.faqs : [])
          .map((f: any) => ({ q: text(f?.q, 300), a: text(f?.a, 3000) }))
          .filter((f: { q: string; a: string }) => f.q && f.a)
          .slice(0, 30),
      ),
      metaTitle: pick('metaTitle', text(g.metaTitle, 120)),
      metaDescription: pick('metaDescription', text(g.metaDescription, 300)),
    };
  }

  /**
   * Save a society: make an area a society (or back into a plain area), write
   * its guide, and set its phases — in the order given. Areas dropped from the
   * phase list become plain areas again; their listings and pages stay.
   */
  async save(id: string, body: { kind?: string; guide?: any; phases?: { id: string; image?: string; tagline?: string; overview?: string }[] }) {
    if (!isValidObjectId(id)) throw new NotFoundException('Society not found');
    const _id = new Types.ObjectId(id);
    const doc: any = await this.areas.findOne({ _id });
    if (!doc) throw new NotFoundException('Society not found');
    if (doc.mergedInto) throw new BadRequestException('This area was merged into another — edit that one instead');
    const now = new Date();

    if (body.kind === 'area') {
      // Back to a plain area: the guide is kept (unpublished) in case it is wanted again.
      await this.areas.updateOne({ _id }, { $unset: { kind: '' }, $set: { 'guide.published': false, updatedAt: now } });
      await this.areas.updateMany({ parent: { $in: both(id) } }, { $unset: { parent: '', kind: '', order: '' }, $set: { updatedAt: now } });
    } else {
      if (doc.kind === 'phase') throw new BadRequestException('This area is a phase of another society — remove it from that society first');
      const guide = this.cleanGuide(body.guide, doc.guide ?? {});
      await this.areas.updateOne({ _id }, { $set: { kind: 'society', guide, updatedAt: now }, $unset: { parent: '' } });

      if (Array.isArray(body.phases)) {
        const wanted = body.phases.filter((p) => isValidObjectId(p?.id) && p.id !== id);
        const rows = await this.areas
          .find({ _id: { $in: wanted.map((p) => new Types.ObjectId(p.id)) }, city: { $in: both(doc.city) } }, { projection: { kind: 1, parent: 1, guide: 1 } })
          .toArray();
        const ok = new Map(rows.filter((r: any) => r.kind !== 'society' && (!r.parent || String(r.parent) === id)).map((r: any) => [String(r._id), r]));
        let order = 0;
        for (const p of wanted) {
          const r: any = ok.get(p.id);
          if (!r) continue;
          const g = { ...(r.guide ?? {}), image: text(p.image, 500), tagline: text(p.tagline, 160), overview: String(p.overview ?? '').slice(0, 20_000) };
          await this.areas.updateOne({ _id: r._id }, { $set: { kind: 'phase', parent: _id, order: order++, guide: g, updatedAt: now } });
        }
        await this.areas.updateMany(
          { parent: { $in: both(id) }, _id: { $nin: [...ok.keys()].map((k) => new Types.ObjectId(k)) } },
          { $unset: { parent: '', kind: '', order: '' }, $set: { updatedAt: now } },
        );
      }
    }
    const city = (await this.cities()).find((c) => String(c._id) === String(doc.city));
    await this.bust(city?.slug, doc.areaSlug);
    return this.adminGet(id);
  }

  /** A new phase for a society, by name — an existing area of the city with that name is reused. */
  async addPhase(id: string, rawName: string) {
    if (!isValidObjectId(id)) throw new NotFoundException('Society not found');
    const doc: any = await this.areas.findOne({ _id: new Types.ObjectId(id) });
    if (!doc) throw new NotFoundException('Society not found');
    const name = cleanPlaceName(rawName, 'area');
    const slug = slugify(name);
    if (!slug) throw new BadRequestException('Enter the phase name in English letters, e.g. "DHA Phase 6"');
    const loose = name.replace(/[^a-z0-9]+/g, '');
    const inCity = await this.areas.find({ city: { $in: both(doc.city) } }, { projection: { name: 1, areaSlug: 1, kind: 1, parent: 1, mergedInto: 1 } }).toArray();
    let hit: any = inCity.find((a: any) => a.areaSlug === slug || String(a.name).toLowerCase().replace(/[^a-z0-9]+/g, '') === loose);
    if (hit?.mergedInto) hit = inCity.find((a: any) => String(a._id) === String(hit.mergedInto)) ?? hit;
    if (hit && (hit.kind === 'society' || (hit.parent && String(hit.parent) !== id))) {
      throw new BadRequestException(`“${hit.name}” already belongs to another society`);
    }
    const order = await this.areas.countDocuments({ parent: { $in: both(id) } });
    const now = new Date();
    if (hit) {
      await this.areas.updateOne({ _id: hit._id }, { $set: { kind: 'phase', parent: new Types.ObjectId(id), order, updatedAt: now }, $unset: { hidden: '' } });
    } else {
      await this.areas.insertOne({
        name,
        areaSlug: slug,
        city: doc.city,
        kind: 'phase',
        parent: new Types.ObjectId(id),
        order,
        source: 'society',
        sizeContents: [],
        createdAt: now,
        updatedAt: now,
      } as any);
    }
    const city = (await this.cities()).find((c) => String(c._id) === String(doc.city));
    await this.bust(city?.slug, doc.areaSlug);
    return this.adminGet(id);
  }
}

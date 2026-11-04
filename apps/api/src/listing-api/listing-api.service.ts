import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Area } from '@rent-ghar/db/schemas/area.schema';
import { City } from '@rent-ghar/db/schemas/city.schema';
import { User } from '@rent-ghar/db/schemas/user.schema';
import { Property } from '@rent-ghar/db/schemas/property.schema';
import { StorageService } from '@rent-ghar/storage/storage.service';
import { PropertyService } from '../property/property.service';
import { AreaService } from '../area/area.service';
import { cleanPlaceName } from '../common/place-name';
import { CreateListingDto, LISTING_TYPES } from './dto/create-listing.dto';

/**
 * The Listing API's work: turns what an automation sends into a listing the
 * way the dashboard would — same area handling (no duplicate areas, merged
 * areas followed, the admin told about new ones on Discord), same sizes
 * (marla/kanal from square feet with the city's marla), same address
 * (title + id), same checks, alerts and cache refresh (PropertyService.create).
 *
 * Listings are owned by the admin (or LISTING_API_OWNER_ID) and tagged
 * source "api". See docs/listing-api.md.
 */

const SITE = (process.env.WEB_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://propertydealer.pk').replace(/\/$/, '');

/** Words people use for a type → the site's type. */
const TYPE_WORDS: Record<string, string> = {
  house: 'house', home: 'house', ghar: 'house', villa: 'house', bungalow: 'house', portion: 'house', 'upper portion': 'house', 'lower portion': 'house', farmhouse: 'house', 'farm house': 'house', room: 'house',
  apartment: 'apartment', flat: 'flat', penthouse: 'apartment', studio: 'apartment',
  plot: 'plot', 'residential plot': 'plot', 'commercial plot': 'plot', 'plot file': 'plot', file: 'plot',
  land: 'land', 'agricultural land': 'land', 'agriculture land': 'land',
  shop: 'shop', office: 'office', commercial: 'commercial', building: 'commercial', plaza: 'commercial', warehouse: 'commercial',
  factory: 'factory', hotel: 'hotel', restaurant: 'restaurant', other: 'other',
};

/** Square feet per unit (marla depends on the city). */
const SQFT = { sqft: 1, sqyd: 9, sqm: 10.7639, acre: 43560 } as const;

/** Short names and common misspellings of cities. */
const CITY_ALIASES: Record<string, string> = {
  lhr: 'lahore', isb: 'islamabad', isl: 'islamabad', khi: 'karachi', rwp: 'rawalpindi', pindi: 'rawalpindi', fsd: 'faisalabad', faislabad: 'faisalabad', faisalbad: 'faisalabad',
  mtn: 'multan', pesh: 'peshawar', grw: 'gujranwala', skt: 'sialkot', 'dg khan': 'dera ghazi khan', 'd.g khan': 'dera ghazi khan', 'ryk': 'rahim yar khan', 'wah cantt': 'wah cant',
};

/** "bahria enclave, islamabad" → "Bahria Enclave, Islamabad" (DHA, LDA… in capitals). */
const placeLabel = (s: string) =>
  s.replace(/[A-Za-z]+/g, (w) => (/^(dha|lda|cda|rda|fda|mda|eme|paf|wapda|pia|cbd|kda|pechs)$/i.test(w) ? w.toUpperCase() : w[0]!.toUpperCase() + w.slice(1)));

const loose = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const words = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length]![b.length]!;
}

/** A Pakistani mobile/landline as entered, trimmed, or null if it can't be a number. */
function phone(v: unknown): string | null {
  const s = String(v ?? '').trim();
  const digits = s.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 13 ? s.replace(/[^\d+]/g, '') : null;
}

/** An address on the public internet (not this server's network), for copying images. */
function publicHttpUrl(u: string): URL | null {
  try {
    const url = new URL(u);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const h = url.hostname.toLowerCase();
    if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || /^(127\.|10\.|192\.168\.|169\.254\.|0\.|::1|\[::1\])/.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h)) return null;
    return url;
  } catch {
    return null;
  }
}

export interface ListingWarnings {
  warnings: string[];
}

@Injectable()
export class ListingApiService {
  private readonly logger = new Logger('ListingApi');

  constructor(
    @InjectModel(Area.name) private readonly areaModel: Model<Area>,
    @InjectModel(City.name) private readonly cityModel: Model<City>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Property.name) private readonly propertyModel: Model<Property>,
    private readonly propertyService: PropertyService,
    private readonly areaService: AreaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  /* ── owner ─────────────────────────────────────────────────────────────── */

  /** Who owns imported listings: LISTING_API_OWNER_ID, else the first admin. */
  async ownerId(): Promise<string> {
    const configured = this.config.get<string>('LISTING_API_OWNER_ID');
    if (configured && Types.ObjectId.isValid(configured)) {
      const found = await this.userModel.findById(configured).select('_id').lean().exec();
      if (found) return String(found._id);
    }
    const admin = await this.userModel.findOne({ role: 'ADMIN' }).sort({ createdAt: 1 }).select('_id').lean().exec();
    if (admin) return String(admin._id);
    throw new InternalServerErrorException('No admin user to own imported listings. Set LISTING_API_OWNER_ID or create an ADMIN user.');
  }

  /* ── reference data ────────────────────────────────────────────────────── */

  getPropertyTypes() {
    return [...LISTING_TYPES];
  }

  async listCities() {
    const [cities, counts] = await Promise.all([
      this.cityModel.find().select('_id name marlaSqft').sort({ name: 1 }).lean().exec(),
      this.areaModel.collection.aggregate([{ $group: { _id: '$city', areas: { $sum: 1 } } }]).toArray(),
    ]);
    const areas = new Map(counts.map((c: any) => [String(c._id), c.areas]));
    return cities.map((c: any) => ({ _id: String(c._id), name: c.name, marlaSqft: Number(c.marlaSqft) || 225, areas: areas.get(String(c._id)) || 0 }));
  }

  /** Areas of a city (by id or name), optionally filtered by words; merged and hidden ones left out. */
  async listAreas(q: { cityId?: string; cityName?: string; q?: string; limit?: number }) {
    const filter: Record<string, unknown> = { mergedInto: { $exists: false } };
    let cityId = q.cityId;
    if (!cityId && q.cityName) cityId = String((await this.findCity(q.cityName))._id);
    if (cityId) {
      if (!Types.ObjectId.isValid(cityId)) throw new BadRequestException('Invalid cityId');
      filter.city = { $in: [new Types.ObjectId(cityId), cityId] };
    }
    if (q.q) filter.name = new RegExp(words(q.q).split(' ').map((w) => `(?=.*${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`).join(''), 'i');
    const rows: any[] = await this.areaModel.collection
      .find(filter, { projection: { name: 1, areaSlug: 1, city: 1, kind: 1, parent: 1, hidden: 1 } })
      .sort({ name: 1 })
      .limit(Math.min(2000, q.limit || 2000))
      .toArray();
    return rows.map((a) => ({ _id: String(a._id), name: a.name, areaSlug: a.areaSlug, city: String(a.city), kind: a.kind || 'area', parent: a.parent ? String(a.parent) : null }));
  }

  /* ── where: city and area ──────────────────────────────────────────────── */

  /** The site's city for a name ("Lahore", "lhr", "Faislabad"), or a clear error with close names. */
  async findCity(raw: string, allowNew = false) {
    const name = words(raw);
    if (!name) throw new BadRequestException('cityName is required (or send an area id).');
    const wanted = CITY_ALIASES[name] || name;
    const cities: any[] = await this.cityModel.find().select('_id name marlaSqft').lean().exec();
    const hit =
      cities.find((c) => loose(c.name) === loose(wanted)) ||
      cities.find((c) => CITY_ALIASES[words(c.name)] === wanted || loose(CITY_ALIASES[words(c.name)]) === loose(wanted)) ||
      cities.find((c) => loose(wanted).length >= 5 && editDistance(loose(c.name), loose(wanted)) <= 1);
    if (hit) return hit;
    if (allowNew) {
      const clean = cleanPlaceName(raw, 'city');
      const created = await this.cityModel.create({ name: clean } as any);
      this.logger.log(`New city from the Listing API: ${clean}`);
      return created.toObject();
    }
    const close = cities
      .map((c) => ({ name: c.name, d: editDistance(loose(c.name), loose(wanted)) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 5)
      .map((c) => c.name);
    throw new BadRequestException({ message: `City "${raw}" is not on the site. Use one of the cities from GET /cities, or send allowNewCity: true to add it.`, closest: close });
  }

  /**
   * The area for a listing, the way the dashboard picks one: an id, or the
   * name — matched to an existing area even when spelled a little
   * differently, following merges, and added (with a Discord note to the
   * admin) only when it really isn't there.
   */
  async resolveArea(dto: CreateListingDto, opts: { create: boolean }) {
    if (dto.area) {
      if (!Types.ObjectId.isValid(dto.area)) throw new BadRequestException('Invalid area id');
      let a: any = await this.areaModel.collection.findOne({ _id: new Types.ObjectId(dto.area) });
      if (!a) throw new BadRequestException('Area not found');
      if (a.mergedInto) a = (await this.areaModel.collection.findOne({ _id: a.mergedInto })) || a;
      const city: any = await this.cityModel.findById(a.city).select('_id name marlaSqft').lean().exec();
      return { id: String(a._id), name: a.name, city, created: false };
    }

    const name = [dto.societyName, dto.subArea].filter(Boolean).join(' ').trim() || String(dto.areaName || '').trim();
    if (!name) throw new BadRequestException('Send the area: `area` (id), or `cityName` + `areaName` (or `societyName` + `subArea`).');
    const city: any = await this.findCity(String(dto.cityName || ''), !!dto.allowNewCity && opts.create);

    // An existing area: same name ignoring spaces/punctuation, or the society's own part ("dha phase 6" = "DHA Phase-6").
    const inCity: any[] = await this.areaModel.collection
      .find({ city: { $in: [city._id, String(city._id)] } }, { projection: { name: 1, mergedInto: 1 } })
      .toArray();
    const target = loose(name);
    let hit: any = inCity.find((a) => loose(a.name) === target) || inCity.find((a) => loose(a.name) === loose(`${name} ${city.name}`) || loose(`${a.name}`) === loose(name.replace(new RegExp(`\\b${city.name}\\b`, 'i'), '')));
    if (hit?.mergedInto) hit = inCity.find((a) => String(a._id) === String(hit.mergedInto)) || (await this.areaModel.collection.findOne({ _id: hit.mergedInto })) || hit;
    if (hit) return { id: String(hit._id), name: hit.name, city, created: false };

    if (!opts.create) return { id: null, name: cleanPlaceName(name, 'area'), city, created: true };
    // Not there: added the same way an agent adds one (the admin gets a Discord note to check it).
    const made = await this.areaService.suggestArea(String(city._id), name, await this.ownerId());
    return { id: String(made._id), name: made.name, city, created: made.created };
  }

  /* ── size ──────────────────────────────────────────────────────────────── */

  /**
   * Square feet + the marla/kanal columns, the way the dashboard stores them:
   * marla = the whole size in marla, kanal = whole kanals only (1 kanal =
   * marla 20, kanal 1; 7 marla = marla 7, kanal 0).
   */
  size(dto: CreateListingDto, cityMarla: number) {
    const marlaSqft = Number(dto.marlaSqft) || cityMarla || 225;
    let sqft = 0;
    if (dto.size && dto.sizeUnit) {
      const unit = dto.sizeUnit;
      sqft = unit === 'marla' ? dto.size * marlaSqft : unit === 'kanal' ? dto.size * 20 * marlaSqft : dto.size * (SQFT as any)[unit];
    } else if (dto.areaSize) {
      sqft = Number(dto.areaSize);
    } else if (dto.marla || dto.kanal) {
      // Old style: "kanal 1 + marla 5" = 25 marla; "marla 20 + kanal 1" = 20 marla.
      const k = Number(dto.kanal) || 0;
      const m = Number(dto.marla) || 0;
      const total = k > 0 && m >= k * 20 - 0.01 ? m : k * 20 + m;
      sqft = total * marlaSqft;
    }
    if (!(sqft > 0)) return null;
    const marla = Number((sqft / marlaSqft).toFixed(2));
    const kanal = Number.isInteger(marla / 20) ? marla / 20 : 0;
    return { areaSize: Math.round(sqft), marla, kanal, marlaSqft };
  }

  /* ── photos ────────────────────────────────────────────────────────────── */

  /** A photo from another site, copied here (so it never breaks or gets blocked). */
  private async importImage(u: string): Promise<string | null> {
    const url = publicHttpUrl(u);
    if (!url) return null;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000), headers: { 'User-Agent': 'PropertyDealer-ListingAPI/2' } });
      if (!res.ok) return null;
      const type = (res.headers.get('content-type') || '').split(';')[0]!.trim().toLowerCase();
      if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'].includes(type)) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      if (!buf.length || buf.length > 10 * 1024 * 1024) return null;
      const ext = type === 'image/png' ? '.png' : type === 'image/webp' ? '.webp' : type === 'image/gif' ? '.gif' : '.jpg';
      const key = await this.storage.upload({ buffer: buf, size: buf.length, mimetype: type, originalname: `import${ext}`, fieldname: 'file' } as Express.Multer.File, `properties/${new Date().getFullYear()}`);
      return this.storage.getUrl(key);
    } catch {
      return null;
    }
  }

  /** Photos: ours as they are; others copied here (unless importImages is false). At most 30. */
  async photos(urls: string[], importImages: boolean, warnings: string[]) {
    const out: string[] = [];
    for (const raw of urls.slice(0, 30)) {
      const u = String(raw || '').trim();
      if (!u) continue;
      const ours = u.startsWith('/uploads/') || u.startsWith(`${SITE}/`) || this.isOurStorage(u);
      if (ours || !importImages) {
        out.push(u);
        continue;
      }
      const copied = await this.importImage(u);
      if (copied) out.push(copied);
      else warnings.push(`Photo skipped (couldn't download a JPEG/PNG/WebP under 10 MB): ${u.slice(0, 120)}`);
    }
    if (urls.length > 30) warnings.push(`Only the first 30 photos were used (${urls.length} sent).`);
    return [...new Set(out)];
  }

  private isOurStorage(u: string): boolean {
    try {
      const probe = this.storage.getUrl('x');
      return probe.startsWith('http') && u.startsWith(probe.slice(0, -1));
    } catch {
      return false;
    }
  }

  async uploadFiles(files: Express.Multer.File[]): Promise<{ key: string; url: string }[]> {
    return Promise.all(
      files.map(async (f) => {
        const key = await this.storage.upload(f, `properties/${new Date().getFullYear()}`);
        return { key, url: this.storage.getUrl(key) };
      }),
    );
  }

  /* ── create ────────────────────────────────────────────────────────────── */

  private normType(t: unknown): string | null {
    const w = words(t);
    if ((LISTING_TYPES as readonly string[]).includes(w)) return w;
    return TYPE_WORDS[w] || null;
  }

  private publicUrl(slug: string) {
    return `${SITE}/properties/${slug}`;
  }

  async findExisting(externalId?: string) {
    if (!externalId) return null;
    return this.propertyModel.findOne({ source: 'api', externalId: String(externalId).trim() }).lean().exec();
  }

  /** Everything a new listing needs, checked, with the reason for each problem. */
  private async prepare(dto: CreateListingDto, photoFiles: string[], opts: { create: boolean }) {
    const warnings: string[] = [];
    const errors: string[] = [];

    const listingType = dto.listingType;
    if (listingType !== 'sale' && listingType !== 'rent') errors.push('listingType must be "sale" or "rent".');
    const propertyType = this.normType(dto.propertyType);
    if (!propertyType) errors.push(`propertyType "${dto.propertyType ?? ''}" is not known. Use one of: ${LISTING_TYPES.join(', ')}.`);
    if (!String(dto.title || '').trim()) errors.push('title is required.');
    if (!(Number(dto.price) > 0)) errors.push('price (PKR, a number above 0) is required.');
    const contact = phone(dto.contactNumber);
    if (!contact) errors.push('contactNumber is required (10–13 digits, e.g. 03001234567).');
    const whatsapp = dto.whatsappNumber ? phone(dto.whatsappNumber) : contact;
    if (dto.whatsappNumber && !whatsapp) warnings.push('whatsappNumber looked wrong; the contact number is used instead.');

    let where: Awaited<ReturnType<ListingApiService['resolveArea']>> | null = null;
    try {
      where = await this.resolveArea(dto, opts);
    } catch (e: any) {
      errors.push(typeof e?.response?.message === 'string' ? e.response.message : e?.message || 'Area not found');
      if (e?.response?.closest) warnings.push(`Closest cities: ${e.response.closest.join(', ')}`);
    }

    const cityMarla = Number(where?.city?.marlaSqft) || 225;
    const size = this.size(dto, cityMarla);
    if (!size) errors.push('Size is required: areaSize (sq ft), or size + sizeUnit (e.g. 10 + "marla"), or marla/kanal.');

    const isLand = propertyType === 'plot' || propertyType === 'land';
    if ((dto.latitude === undefined) !== (dto.longitude === undefined)) warnings.push('Send both latitude and longitude for a map pin; one alone is ignored.');
    if (dto.latitude === undefined && dto.longitude === undefined) warnings.push('No map pin (latitude/longitude): the listing is shown at its area on the map.');

    const urls = [...(dto.mainPhotoUrl ? [dto.mainPhotoUrl] : []), ...photoFiles, ...(dto.additionalPhotosUrls || [])];
    // A dry run checks only: nothing is downloaded or saved.
    const photos = errors.length || !opts.create ? urls : await this.photos(urls, dto.importImages !== false, warnings);
    if (!photos.length && !dto.videoPosterUrl) warnings.push('No photos: listings with photos get far more views.');

    return {
      errors,
      warnings,
      where,
      size,
      fields: errors.length
        ? null
        : {
            listingType: listingType!,
            propertyType: propertyType!,
            area: where!.id!,
            title: String(dto.title).trim(),
            ...(dto.slug ? { slug: dto.slug } : {}),
            location: String(dto.location || '').trim() || placeLabel([where!.name, where!.city?.name].filter(Boolean).join(', ')),
            bedrooms: isLand ? 0 : Number(dto.bedrooms) || 0,
            bathrooms: isLand ? 0 : Number(dto.bathrooms) || 0,
            areaSize: size!.areaSize,
            price: Math.round(Number(dto.price)),
            marla: size!.marla,
            kanal: size!.kanal,
            ...(size!.marlaSqft !== 225 ? { marlaSqft: size!.marlaSqft } : {}),
            description: String(dto.description || '').trim() || String(dto.title).trim(),
            contactNumber: contact!,
            whatsappNumber: whatsapp || contact!,
            features: (dto.features || []).map((f) => String(f).trim()).filter(Boolean).slice(0, 40),
            ...(dto.latitude !== undefined && dto.longitude !== undefined ? { latitude: dto.latitude, longitude: dto.longitude } : {}),
            ...(dto.videoUrl ? { videoUrl: dto.videoUrl, videoPosterUrl: dto.videoPosterUrl || '' } : {}),
          },
      photos,
    };
  }

  async create(dto: CreateListingDto, photoFiles: string[] = []) {
    // Sent before? The same listing — or updated, when asked.
    const existing = await this.findExisting(dto.externalId);
    if (existing) {
      if (dto.upsert && !dto.dryRun) return { ...(await this.update(String(existing._id), dto, photoFiles)), duplicate: true };
      return { success: true, duplicate: true, message: 'Already imported (same externalId) — nothing added.', ...this.summary(existing) };
    }

    const p = await this.prepare(dto, photoFiles, { create: !dto.dryRun });
    if (p.errors.length) throw new BadRequestException({ message: 'The listing could not be added.', errors: p.errors, warnings: p.warnings });

    // The same listing without an externalId (same title, price and area in the last 60 days)?
    const twin: any = await this.propertyModel
      .findOne({
        source: 'api',
        title: p.fields!.title,
        price: p.fields!.price,
        area: p.fields!.area ? { $in: [new Types.ObjectId(p.fields!.area), p.fields!.area] } : undefined,
        createdAt: { $gte: new Date(Date.now() - 60 * 86_400_000) },
      } as any)
      .lean()
      .exec();
    if (twin && !dto.dryRun) return { success: true, duplicate: true, message: 'Looks like a copy of a listing added recently (same title, price and area) — nothing added.', ...this.summary(twin) };

    const mode = (dto.status || this.config.get<string>('LISTING_API_DEFAULT_STATUS') || 'auto') as 'auto' | 'approved' | 'pending' | 'draft';
    if (dto.dryRun) {
      return {
        success: true,
        dryRun: true,
        message: 'Everything checks out — send it again without dryRun to add it.',
        wouldCreate: { ...p.fields, photos: p.photos.length, status: mode, area: p.where ? { name: p.where.name, city: p.where.city?.name, new: p.where.created } : null },
        warnings: p.warnings,
      };
    }

    const [main, ...rest] = p.photos;
    const saved: any = await this.propertyService.create(
      await this.ownerId(),
      p.fields as any,
      main || dto.videoPosterUrl || undefined,
      rest,
      'ADMIN',
      { source: 'api', status: mode === 'auto' ? 'pending' : mode, screen: mode === 'auto' },
    );
    if (dto.externalId) await this.propertyModel.updateOne({ _id: saved._id }, { $set: { externalId: String(dto.externalId).trim() } }).exec();

    const status = saved.status;
    return {
      success: true,
      message:
        status === 'approved'
          ? 'Listing published.'
          : status === 'draft'
            ? 'Saved as a draft (not public).'
            : 'Saved and waiting for the admin to approve it.',
      ...this.summary(saved),
      area: { id: p.where?.id, name: p.where?.name, city: p.where?.city?.name, newArea: !!p.where?.created },
      size: p.size,
      photos: p.photos.length,
      ...(status === 'pending' && saved.moderationReasons?.length ? { heldBecause: saved.moderationReasons } : {}),
      warnings: p.warnings,
    };
  }

  /* ── update, availability, read ───────────────────────────────────────── */

  /** A listing by id, or "ext:<externalId>". */
  async find(ref: string): Promise<any> {
    const r = String(ref || '').trim();
    const doc = r.startsWith('ext:')
      ? await this.findExisting(r.slice(4))
      : Types.ObjectId.isValid(r)
        ? await this.propertyModel.findById(r).lean().exec()
        : await this.propertyModel.findOne({ slug: r }).lean().exec();
    if (!doc) throw new NotFoundException('Listing not found');
    return doc;
  }

  summary(doc: any) {
    return {
      id: String(doc._id),
      externalId: doc.externalId || undefined,
      slug: doc.slug,
      url: this.publicUrl(doc.slug),
      status: doc.status,
      availability: doc.availability || 'available',
      source: doc.source,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async get(ref: string) {
    const doc = await this.find(ref);
    return {
      ...this.summary(doc),
      title: doc.title,
      price: doc.price,
      views: doc.views || 0,
      ...(doc.status === 'pending' && doc.moderationReasons?.length ? { heldBecause: doc.moderationReasons } : {}),
      expiresAt: doc.expiresAt || null,
    };
  }

  /** Change any fields; the rest stay as they are. Photos sent = the new gallery. */
  async update(ref: string, dto: CreateListingDto, photoFiles: string[] = []) {
    const doc: any = await this.find(ref);
    const warnings: string[] = [];
    const locationChanged = !!(dto.area || dto.cityName || dto.areaName || dto.societyName);
    let areaId = String(doc.area || '');
    let cityMarla = Number(doc.marlaSqft) || 225;
    if (locationChanged) {
      const w = await this.resolveArea(dto, { create: true });
      areaId = w.id!;
      cityMarla = Number(w.city?.marlaSqft) || 225;
    }
    const sizeSent = dto.areaSize || (dto.size && dto.sizeUnit) || dto.marla || dto.kanal;
    const size = sizeSent ? this.size(dto, cityMarla) : null;
    const type = dto.propertyType ? this.normType(dto.propertyType) : doc.propertyType;
    if (!type) throw new BadRequestException(`propertyType "${dto.propertyType}" is not known.`);

    const photosSent = dto.mainPhotoUrl || photoFiles.length || dto.additionalPhotosUrls;
    const photos = photosSent
      ? await this.photos([...(dto.mainPhotoUrl ? [dto.mainPhotoUrl] : []), ...photoFiles, ...(dto.additionalPhotosUrls || [])], dto.importImages !== false, warnings)
      : null;

    const merged: any = {
      listingType: dto.listingType || doc.listingType,
      propertyType: type,
      area: areaId,
      title: dto.title?.trim() || doc.title,
      location: dto.location?.trim() || doc.location,
      bedrooms: dto.bedrooms ?? doc.bedrooms,
      bathrooms: dto.bathrooms ?? doc.bathrooms,
      areaSize: size?.areaSize ?? doc.areaSize,
      price: dto.price ? Math.round(dto.price) : doc.price,
      marla: size ? size.marla : doc.marla,
      kanal: size ? size.kanal : doc.kanal,
      marlaSqft: size ? size.marlaSqft : doc.marlaSqft || 225,
      description: dto.description?.trim() || doc.description,
      contactNumber: (dto.contactNumber && phone(dto.contactNumber)) || doc.contactNumber,
      whatsappNumber: (dto.whatsappNumber && phone(dto.whatsappNumber)) || doc.whatsappNumber || doc.contactNumber,
      features: dto.features ?? doc.features ?? [],
      latitude: dto.latitude ?? doc.latitude,
      longitude: dto.longitude ?? doc.longitude,
      ...(dto.videoUrl !== undefined ? { videoUrl: dto.videoUrl, videoPosterUrl: dto.videoPosterUrl || '' } : {}),
      ...(dto.status && dto.status !== 'auto' ? { status: dto.status } : {}),
    };
    const [main, ...rest] = photos || [];
    const saved: any = await this.propertyService.update(String(doc._id), merged, photos ? main : undefined, photos ? rest : undefined, await this.ownerId(), 'ADMIN', !!photos);
    if (dto.availability && dto.availability !== (doc.availability || 'available')) {
      await this.propertyService.setAvailability(String(doc._id), dto.availability, await this.ownerId(), 'ADMIN');
    }
    if (dto.externalId && dto.externalId !== doc.externalId) await this.propertyModel.updateOne({ _id: doc._id }, { $set: { externalId: dto.externalId } }).exec();
    const fresh = await this.propertyModel.findById(doc._id).lean().exec();
    return { success: true, message: 'Listing updated.', ...this.summary(fresh || saved || doc), warnings };
  }

  async setAvailability(ref: string, availability: 'available' | 'sold' | 'rented') {
    const doc: any = await this.find(ref);
    await this.propertyService.setAvailability(String(doc._id), availability, await this.ownerId(), 'ADMIN');
    const fresh = await this.propertyModel.findById(doc._id).lean().exec();
    return { success: true, ...this.summary(fresh || doc) };
  }

  /** Where a name would land — the area it matches, or that it would be added — without saving anything. */
  async previewArea(dto: CreateListingDto) {
    const w = await this.resolveArea(dto, { create: false });
    return { city: { id: String(w.city?._id), name: w.city?.name, marlaSqft: Number(w.city?.marlaSqft) || 225 }, area: w.id ? { id: w.id, name: w.name, existing: true } : { name: w.name, existing: false, note: 'Would be added as a new area (the admin gets a note to check it).' } };
  }
}

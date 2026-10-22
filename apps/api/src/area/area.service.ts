 /* eslint-disable prettier/prettier */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';
import { Area, AreaDocument } from '@rent-ghar/db/schemas/area.schema';
import { CreateAreaDto } from '@rent-ghar/dtos/area/createarea.dto';
import { cleanPlaceName } from '../common/place-name';
import { UpdateAreaDto } from '@rent-ghar/dtos/area/updatearea.dto';
import { RedisCacheService } from '../redis-cache/redis-cache.service';
import { RevalidateService } from '../revalidate/revalidate.service';
import { DISCORD_COLORS, DiscordService } from '../notify/discord.service';

const TAG_AREAS = 'areas';

/**
 * `city` is stored as an ObjectId on some areas and as a plain string on
 * others, and the schema path is Mixed (nothing is cast) — so a lookup by
 * city must name both forms, or it silently misses part of the city.
 */
const cityMatch = (cityId: string) => (isValidObjectId(cityId) ? { $in: [new Types.ObjectId(cityId), String(cityId)] } : String(cityId));
const escapeRe = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const AREA_SEO_FIELDS = ['metaTitle', 'metaDescription', 'description', 'rentMetaTitle', 'rentMetaDescription', 'rentContent', 'saleMetaTitle', 'saleMetaDescription', 'saleContent'];

@Injectable()
export class AreaService {
  constructor(
    @InjectModel(Area.name) private areaModel: Model<AreaDocument>,
    private readonly cache: RedisCacheService,
    private readonly revalidate: RevalidateService,
    private readonly discord: DiscordService,
  ) {}

  private async bustAreaCaches() {
    await this.revalidate.revalidate({ tags: [TAG_AREAS], paths: ['/properties'] });
  }

  async createArea(createAreaDto: CreateAreaDto): Promise<AreaDocument> {
    // Validate city ID
    if (!isValidObjectId(createAreaDto.city)) {
      throw new NotFoundException('Invalid city ID');
    }

    const areaData: any = {
      name: createAreaDto.name,
      city: createAreaDto.city,
    };

    if (createAreaDto.metaTitle) areaData.metaTitle = createAreaDto.metaTitle;
    if (createAreaDto.areaSlug) areaData.areaSlug = createAreaDto.areaSlug;
    if (createAreaDto.metaDescription)
      areaData.metaDescription = createAreaDto.metaDescription;
    if (createAreaDto.canonicalUrl)
      areaData.canonicalUrl = createAreaDto.canonicalUrl;
    if (createAreaDto.description)
      areaData.description = createAreaDto.description;
    if (createAreaDto.rentMetaTitle) areaData.rentMetaTitle = createAreaDto.rentMetaTitle;
    if (createAreaDto.rentMetaDescription) areaData.rentMetaDescription = createAreaDto.rentMetaDescription;
    if (createAreaDto.rentContent) areaData.rentContent = createAreaDto.rentContent;
    if (createAreaDto.saleMetaTitle) areaData.saleMetaTitle = createAreaDto.saleMetaTitle;
    if (createAreaDto.saleMetaDescription) areaData.saleMetaDescription = createAreaDto.saleMetaDescription;
    if (createAreaDto.saleContent) areaData.saleContent = createAreaDto.saleContent;
    if (createAreaDto.sizeContents) areaData.sizeContents = createAreaDto.sizeContents; // 🆕

    const createdArea = new this.areaModel(areaData);
    const saved = await createdArea.save();
    this.bustAreaCaches().catch(() => {});
    return saved;
  }

  /**
   * Names only — id, name, slug, city id — optionally for one city. The full
   * documents carry each area's SEO content (~175 KB for all of them).
   */
  async findAreaNames(cityId?: string): Promise<Array<{ _id: string; name: string; areaSlug?: string; city?: string; kind?: string; parent?: string }>> {
    return this.cache.wrap(
      this.cache.buildKey('areas:names', [cityId ?? 'all']),
      async () => {
        // Merged duplicates and hidden junk entries are not offered for new listings.
        const query: Record<string, unknown> = { mergedInto: { $in: [null] }, hidden: { $ne: true } };
        if (cityId && Types.ObjectId.isValid(cityId)) {
          query.city = { $in: [new Types.ObjectId(cityId), cityId] };
        }
        const rows = await this.areaModel.collection
          .find(query, { projection: { name: 1, areaSlug: 1, city: 1, kind: 1, parent: 1 } })
          .sort({ name: 1 })
          .toArray();
        return rows.map((a: any) => ({
          _id: String(a._id),
          name: a.name,
          areaSlug: a.areaSlug,
          city: a.city ? String(a.city) : undefined,
          ...(a.kind ? { kind: a.kind } : {}),
          ...(a.parent ? { parent: String(a.parent) } : {}),
        }));
      },
      { ttl: 3600, tags: [TAG_AREAS] },
    );
  }

  async findAllAreas(): Promise<AreaDocument[]> {
    return this.cache.wrap(
      this.cache.buildKey('areas:all', []),
      () =>
        this.areaModel
          .find()
          .populate('city', 'name state country')
          .sort({ createdAt: -1 })
          .exec(),
      { ttl: 3600, tags: [TAG_AREAS] },
    );
  }

  async findAreaById(id: string): Promise<AreaDocument> {
    if (!isValidObjectId(id)) {
      throw new NotFoundException('Invalid area ID');
    }
    const area = await this.areaModel
      .findById(id)
      .populate('city', 'name state country')
      .exec();
    if (!area) {
      throw new NotFoundException('Area not found');
    }
    return area as AreaDocument;
  }

  async findAreaByName(name: string, cityId?: string): Promise<AreaDocument> {
    const query: any = { 
      name: { $regex: new RegExp(`^${escapeRe(name.trim())}$`, 'i') } 
    };
    if (cityId) query.city = cityMatch(cityId);

    const area = await this.areaModel
      .findOne(query)
      .populate('city', 'name state country')
      .exec();
    if (!area) {
      throw new NotFoundException(`Area ${name} not found`);
    }
    return area as AreaDocument;
  }

  /**
   * Every area in a city — including the ones whose `city` is stored as a
   * string.
   *
   * `find({ city: cityId })` looks right and is not: Mongoose casts the value
   * to the path's declared ObjectId, and part of this collection holds `city`
   * as a plain 24-character string. MongoDB does not consider those equal, so
   * the cast query skipped them. Measured on 9 Oct 2026: 115 areas came back
   * for Multan while the unfiltered list held 132 — and among the 17 missing
   * was the area a live listing had been saved with, so opening that listing
   * to edit it found an Area dropdown that did not contain its own area.
   *
   * The ids are gathered through the raw collection, where nothing is cast
   * and both stored forms match, then read back through the model so the
   * caller still gets populated documents. `scripts/normalize-owner-ids.ts`
   * repairs the stored types; this keeps the dropdown honest either way.
   */
  async findAreasByCity(cityId: string): Promise<AreaDocument[]> {
    if (!isValidObjectId(cityId)) {
      throw new NotFoundException('Invalid city ID');
    }
    return this.cache.wrap(
      this.cache.buildKey('areas:by-city', [cityId]),
      async () => {
        const matches = await this.areaModel.collection
          .find({
            city: { $in: [new Types.ObjectId(cityId), cityId] },
            // Merged duplicates' listings were moved to the area they joined.
            // Hidden ones stay listed here, so a listing saved with one can still be edited.
            mergedInto: { $in: [null] },
          })
          .project({ _id: 1 })
          .toArray();

        const ids = matches.map((row) => row._id);
        if (ids.length === 0) return [];

        return this.areaModel
          .find({ _id: { $in: ids } })
          .populate('city', 'name state country')
          .sort({ name: 1 })
          .exec();
      },
      { ttl: 3600, tags: [TAG_AREAS] },
    );
  }

  async findAreaBySlug(slug: string, cityId?: string): Promise<AreaDocument> {
    const query: any = { 
      areaSlug: { $regex: new RegExp(`^${escapeRe(slug.trim())}$`, 'i') } 
    };
    if (cityId) query.city = cityMatch(cityId);

    let area = await this.areaModel
      .findOne(query)
      .populate('city', 'name state country')
      .exec();

    // Fallback: If areaSlug is missing in historical DB entries, find dynamically
    if (!area) {
      const fallbackQuery = cityId ? { city: cityMatch(cityId) } : {};
      const allAreas = await this.areaModel.find(fallbackQuery).populate('city', 'name state country').exec();
      const targetSlug = slug.trim().toLowerCase();
      
      area = allAreas.find(a => {
        const generatedSlug = a.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        return generatedSlug === targetSlug;
      }) || null;

      // Lazily update the database if we found a match so it's much faster next time
      if (area && !area.areaSlug) {
        area.areaSlug = targetSlug;
        area.save().catch(e => console.error('Silent error updating areaSlug fallback', e));
      }
    }

    if (!area) {
      throw new NotFoundException(`Area with slug ${slug} not found`);
    }
    // A hidden area (an empty or junk entry) has no page while it has no listings.
    if ((area as any).hidden && !(area as any).mergedInto) {
      const listings = await this.areaModel.db
        .collection('properties')
        .countDocuments({ area: { $in: [area._id, String(area._id)] }, status: 'approved' });
      if (!listings) throw new NotFoundException(`Area with slug ${slug} not found`);
    }
    return area as AreaDocument;
  }

  // 🆕 Helper: find existing area by name within a city, else create it
  async findOrCreateArea(
    name: string,
    cityId: string,
    extra: Partial<CreateAreaDto> = {},
  ): Promise<AreaDocument> {
    if (!isValidObjectId(cityId)) {
      throw new NotFoundException('Invalid city ID');
    }

    const existing = await this.areaModel
      .findOne({
        name: { $regex: new RegExp(`^${escapeRe(name.trim())}$`, 'i') },
        city: cityMatch(cityId),
      })
      .exec();

    if (existing) {
      return existing as AreaDocument;
    }

    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

    const areaData: any = {
      name: name.trim(),
      areaSlug: slug,
      city: cityId,
      ...extra,
    };

    const createdArea = new this.areaModel(areaData);
    const saved = await createdArea.save();
    this.bustAreaCaches().catch(() => {});
    return saved;
  }

  async updateArea(
    id: string,
    updateAreaDto: UpdateAreaDto,
  ): Promise<AreaDocument> {
    if (!isValidObjectId(id)) {
      throw new NotFoundException('Invalid area ID');
    }

    console.log('UpdateArea Input:', JSON.stringify(updateAreaDto, null, 2));

    // Construct update object to avoid overwriting fields with undefined
    const updateData: any = {};
    Object.keys(updateAreaDto).forEach(key => {
      if (updateAreaDto[key] !== undefined) {
        updateData[key] = updateAreaDto[key];
      }
    });

    const area = await this.areaModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate('city', 'name state country').exec();

    if (!area) {
      throw new NotFoundException('Area not found');
    }

    console.log('UpdateArea Success. Updated fields:', {
      rentMetaTitle: area.rentMetaTitle,
      saleMetaTitle: area.saleMetaTitle,
      rentMetaDescription: area.rentMetaDescription,
      saleMetaDescription: area.saleMetaDescription,
      sizeContents: area.sizeContents,
    });

    this.bustAreaCaches().catch(() => {});
    return area;
  }

  /**
   * The dashboard's areas table: every area with its status and how many
   * listings it holds, light (no SEO content), so duplicates and junk entries
   * can be found and cleaned up.
   */
  async adminOverview() {
    const [rows, counts] = await Promise.all([
      this.areaModel.collection
        .find({}, { projection: { name: 1, areaSlug: 1, city: 1, createdAt: 1, mergedInto: 1, mergedIntoSlug: 1, hidden: 1, source: 1 } })
        .toArray(),
      this.areaModel.db
        .collection('properties')
        .aggregate([{ $match: { area: { $nin: [null, ''] } } }, { $group: { _id: { $toString: '$area' }, n: { $sum: 1 } } }])
        .toArray(),
    ]);
    const n = new Map(counts.map((c: any) => [String(c._id), c.n as number]));
    return rows.map((a: any) => ({
      _id: String(a._id),
      name: a.name,
      areaSlug: a.areaSlug,
      city: a.city ? String(a.city) : undefined,
      createdAt: a.createdAt,
      mergedInto: a.mergedInto ? String(a.mergedInto) : undefined,
      mergedIntoSlug: a.mergedIntoSlug || undefined,
      hidden: !!a.hidden,
      source: a.source || undefined,
      listings: n.get(String(a._id)) ?? 0,
    }));
  }

  /**
   * Folds a duplicate into the area it repeats: its listings move to the
   * kept area, the kept area's empty SEO fields are filled from it, and it is
   * marked mergedInto — its URL keeps working, shows the kept area and points
   * its canonical there. Nothing is deleted and no slug changes.
   */
  async mergeArea(id: string, intoId: string) {
    if (!isValidObjectId(id) || !isValidObjectId(intoId) || id === intoId) throw new BadRequestException('Choose two different areas');
    const col = this.areaModel.collection;
    const [dup, keep] = await Promise.all([col.findOne({ _id: new Types.ObjectId(id) }), col.findOne({ _id: new Types.ObjectId(intoId) })]);
    if (!dup || !keep) throw new NotFoundException('Area not found');
    if (keep.mergedInto) throw new BadRequestException(`“${keep.name}” is itself merged — choose the area it was merged into`);
    if (String(dup.city) !== String(keep.city)) throw new BadRequestException('Both areas must be in the same city');

    const fill: Record<string, unknown> = {};
    for (const f of AREA_SEO_FIELDS) if (!keep[f] && dup[f]) fill[f] = dup[f];
    if (Object.keys(fill).length) await col.updateOne({ _id: keep._id }, { $set: fill });

    // Old areas may have no stored slug; their URL is the one generated from the name.
    const keptSlug = keep.areaSlug || String(keep.name).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const ids = [dup._id, String(dup._id)];
    const moved = await this.areaModel.db.collection('properties').updateMany({ area: { $in: ids } }, { $set: { area: keep._id } });
    // Areas merged into this duplicate earlier now point at the kept one too.
    await col.updateMany({ mergedInto: { $in: ids } }, { $set: { mergedInto: keep._id, mergedIntoSlug: keptSlug, updatedAt: new Date() } });
    await col.updateOne({ _id: dup._id }, { $set: { mergedInto: keep._id, mergedIntoSlug: keptSlug, updatedAt: new Date() } });
    await this.revalidate.revalidate({ tags: [TAG_AREAS, 'properties', 'cities', 'society-maps'], paths: ['/properties'] }).catch(() => {});
    return { kept: String(keep._id), keptSlug, moved: moved.modifiedCount };
  }

  /** Undo a merge: the area is offered again (its moved listings stay where they are). */
  async unmergeArea(id: string) {
    if (!isValidObjectId(id)) throw new NotFoundException('Invalid area ID');
    await this.areaModel.collection.updateOne({ _id: new Types.ObjectId(id) }, { $unset: { mergedInto: '', mergedIntoSlug: '' }, $set: { updatedAt: new Date() } });
    await this.revalidate.revalidate({ tags: [TAG_AREAS, 'properties', 'cities'], paths: ['/properties'] }).catch(() => {});
    return { ok: true };
  }

  /** Hidden areas are not offered in pickers or the sitemap; their pages and listings stay as they are. */
  async setAreaHidden(id: string, hidden: boolean) {
    if (!isValidObjectId(id)) throw new NotFoundException('Invalid area ID');
    await this.areaModel.collection.updateOne({ _id: new Types.ObjectId(id) }, hidden ? { $set: { hidden: true, updatedAt: new Date() } } : { $unset: { hidden: '' }, $set: { updatedAt: new Date() } });
    await this.revalidate.revalidate({ tags: [TAG_AREAS, 'cities'], paths: ['/properties'] }).catch(() => {});
    return { ok: true, hidden };
  }

  /**
   * An agent adds the area their listing is in. The same name in the city
   * (any case, spacing or hyphens) is reused — a merged duplicate gives its
   * kept area, a hidden one is shown again — so this never makes a second
   * copy. New areas are marked source 'agent', for the admin's Areas list.
   */
  async suggestArea(cityId: string, rawName: string, userId?: string) {
    if (!isValidObjectId(cityId)) throw new BadRequestException('Choose the city first');
    const city = await this.areaModel.db.collection('cities').findOne({ _id: new Types.ObjectId(cityId) }, { projection: { _id: 1 } });
    if (!city) throw new BadRequestException('City not found');
    const name = cleanPlaceName(rawName, 'area');
    const slug = name.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (!slug) throw new BadRequestException('Enter the area name in English letters');
    const loose = name.replace(/[^a-z0-9]+/g, '');

    const col = this.areaModel.collection;
    const inCity = await col
      .find({ city: { $in: [new Types.ObjectId(cityId), cityId] } }, { projection: { name: 1, areaSlug: 1, mergedInto: 1, hidden: 1 } })
      .toArray();
    let hit: any = inCity.find((a: any) => a.areaSlug === slug || String(a.name).toLowerCase().replace(/[^a-z0-9]+/g, '') === loose);
    if (hit?.mergedInto) hit = (await col.findOne({ _id: hit.mergedInto })) ?? hit;
    if (hit) {
      if (hit.hidden) {
        await col.updateOne({ _id: hit._id }, { $unset: { hidden: '', hiddenReason: '' }, $set: { updatedAt: new Date() } });
        this.bustAreaCaches().catch(() => {});
      }
      return { _id: String(hit._id), name: hit.name, areaSlug: hit.areaSlug, city: cityId, created: false };
    }
    const now = new Date();
    const doc = {
      name,
      areaSlug: slug,
      city: new Types.ObjectId(cityId),
      source: 'agent',
      ...(userId && isValidObjectId(userId) ? { createdBy: new Types.ObjectId(userId) } : {}),
      sizeContents: [],
      createdAt: now,
      updatedAt: now,
    };
    const r = await col.insertOne(doc as any);
    this.bustAreaCaches().catch(() => {});
    // Agents type areas in: the admin checks the spelling, or merges it into the right one.
    const cityDoc: any = await this.areaModel.db.collection('cities').findOne({ _id: new Types.ObjectId(cityId) }, { projection: { name: 1 } }).catch(() => null);
    const citySlug = String(cityDoc?.name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    this.discord.send({
      title: '📍 New area added by an agent',
      description: `**${name}**, ${cityDoc?.name ?? 'city'} — check the spelling, or merge it into an existing area.`,
      url: '/dashboard/area',
      color: DISCORD_COLORS.info,
      category: 'Places',
      who: userId ? [{ label: '🧑‍💼 Added by', id: userId }] : [],
      links: [
        { label: 'Areas', url: '/dashboard/area' },
        ...(citySlug ? [{ label: 'Its page', url: `/properties/sale/${citySlug}/${slug}` }] : []),
      ],
    });
    return { _id: String(r.insertedId), name, areaSlug: slug, city: cityId, created: true };
  }

  async deleteArea(id: string): Promise<void> {
    if (!isValidObjectId(id)) {
      throw new NotFoundException('Invalid area ID');
    }
    // An area with listings is never deleted: its listings would lose their location and its page would 404.
    const listings = await this.areaModel.db.collection('properties').countDocuments({ area: { $in: [new Types.ObjectId(id), id] } });
    if (listings > 0) {
      throw new BadRequestException(`This area has ${listings} listing${listings === 1 ? '' : 's'}. Merge it into the right area instead of deleting it.`);
    }
    const area = await this.areaModel.findByIdAndDelete(id).exec();
    if (!area) {
      throw new NotFoundException('Area not found');
    }
    this.bustAreaCaches().catch(() => {});
  }
}
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { MaterialType, MaterialTypeDocument } from '@rent-ghar/db/schemas/material-type.schema';
import { MaterialRate, MaterialRateDocument } from '@rent-ghar/db/schemas/material-rate.schema';
import { RedisCacheService } from '../redis-cache/redis-cache.service';
import { RevalidateService } from '../revalidate/revalidate.service';

export const TAG_MATERIAL_TYPES = 'material-types';

/**
 * The materials built into the site, each with its own pages and admin
 * screens. A new material may not take one of these addresses.
 */
export const BUILT_IN_MATERIALS = ['cement', 'steel', 'bricks', 'brick', 'sand', 'bajri', 'wood', 'door', 'doors', 'tile', 'tiles', 'material'];

export interface MaterialTypeInput {
  name?: unknown;
  slug?: unknown;
  unit?: unknown;
  description?: unknown;
  content?: unknown;
  metaTitle?: unknown;
  metaDescription?: unknown;
  image?: unknown;
  order?: unknown;
  isActive?: unknown;
}

const text = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
const toSlug = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

/**
 * Materials the admin adds from the dashboard — see MaterialType. Public
 * reads are cached; every change refreshes the menus, the footer and the
 * material's own page (they all read the "material-types" tag).
 */
@Injectable()
export class MaterialTypeService {
  constructor(
    @InjectModel(MaterialType.name) private readonly types: Model<MaterialTypeDocument>,
    @InjectModel(MaterialRate.name) private readonly rates: Model<MaterialRateDocument>,
    private readonly cache: RedisCacheService,
    private readonly revalidate: RevalidateService,
  ) {}

  private static pagePath(slug: string) {
    return `/today-${slug}-rate-in-pakistan`;
  }

  private async bust(slug?: string) {
    await this.cache.invalidateTags([TAG_MATERIAL_TYPES]).catch(() => undefined);
    await this.revalidate
      .revalidate({ tags: [TAG_MATERIAL_TYPES, 'material-rates'], paths: ['/', ...(slug ? [MaterialTypeService.pagePath(slug)] : [])] })
      .catch(() => undefined);
  }

  /** Active materials, in menu order — for the menu, footer, shop and sitemap. */
  async listPublic() {
    return this.cache.wrap(
      this.cache.buildKey('material-types:public', []),
      async () => {
        const rows = await this.types.find({ isActive: true }).sort({ order: 1, name: 1 }).lean().exec();
        return rows.map((t: any) => ({
          _id: String(t._id),
          name: t.name,
          slug: t.slug,
          unit: t.unit,
          description: t.description,
          path: MaterialTypeService.pagePath(t.slug),
          order: t.order,
        }));
      },
      { ttl: 600, tags: [TAG_MATERIAL_TYPES] },
    );
  }

  /** One material's page data (active only), or 404. */
  async getPublic(slug: string) {
    const s = toSlug(String(slug ?? ''));
    const t: any = await this.types.findOne({ slug: s, isActive: true }).lean().exec();
    if (!t) throw new NotFoundException('Material not found');
    return { ...t, _id: String(t._id), path: MaterialTypeService.pagePath(t.slug) };
  }

  async listAdmin() {
    const [rows, counts] = await Promise.all([
      this.types.find().sort({ order: 1, name: 1 }).lean().exec(),
      this.rates.aggregate([{ $group: { _id: '$materialType', n: { $sum: 1 } } }]).exec(),
    ]);
    const n = new Map(counts.map((c: any) => [String(c._id), c.n as number]));
    return rows.map((t: any) => ({ ...t, _id: String(t._id), path: MaterialTypeService.pagePath(t.slug), rates: n.get(t.slug) ?? 0 }));
  }

  private clean(input: MaterialTypeInput, creating: boolean) {
    const out: Record<string, unknown> = {};
    if (creating || input.name !== undefined) {
      const name = text(input.name, 60);
      if (name.length < 2) throw new BadRequestException('Enter the material name, e.g. "Marble"');
      out.name = name;
    }
    if (input.unit !== undefined) out.unit = text(input.unit, 40) || 'Per unit';
    if (input.description !== undefined) out.description = text(input.description, 300);
    if (input.content !== undefined) out.content = String(input.content ?? '').slice(0, 50_000);
    if (input.metaTitle !== undefined) out.metaTitle = text(input.metaTitle, 120);
    if (input.metaDescription !== undefined) out.metaDescription = text(input.metaDescription, 300);
    if (input.image !== undefined) out.image = text(input.image, 500);
    if (input.order !== undefined) out.order = Math.round(Number(input.order) || 0);
    if (input.isActive !== undefined) out.isActive = input.isActive === true || input.isActive === 'true';
    return out;
  }

  async create(input: MaterialTypeInput) {
    const data = this.clean(input, true);
    const slug = toSlug(text(input.slug, 60) || String(data.name));
    if (!slug || slug.length < 2) throw new BadRequestException('The address name must have letters, e.g. "marble"');
    if (BUILT_IN_MATERIALS.includes(slug)) throw new ConflictException(`"${slug}" is already a built-in material — it has its own pages`);
    if (await this.types.exists({ slug })) throw new ConflictException('A material with this address already exists');
    const doc = await this.types.create({ ...data, slug });
    await this.bust(slug);
    return doc.toObject();
  }

  /** The slug (the page address) is fixed once created — the page may already be ranked. */
  async update(id: string, input: MaterialTypeInput) {
    if (!isValidObjectId(id)) throw new NotFoundException('Material not found');
    const doc = await this.types.findByIdAndUpdate(id, { $set: this.clean(input, false) }, { new: true }).lean().exec();
    if (!doc) throw new NotFoundException('Material not found');
    await this.bust((doc as any).slug);
    return doc;
  }

  /** Only a material with no rates can be deleted; one with rates is switched off instead. */
  async remove(id: string) {
    if (!isValidObjectId(id)) throw new NotFoundException('Material not found');
    const doc: any = await this.types.findById(id).lean().exec();
    if (!doc) throw new NotFoundException('Material not found');
    const rates = await this.rates.countDocuments({ materialType: doc.slug });
    if (rates > 0) throw new BadRequestException(`This material has ${rates} rates. Switch it off instead, or delete its rates first.`);
    await this.types.deleteOne({ _id: doc._id });
    await this.bust(doc.slug);
    return { deleted: true };
  }

  /** Is this a material the admin added (any state)? Used to accept its rates. */
  async exists(slug: string) {
    return !!(await this.types.exists({ slug: toSlug(String(slug ?? '')) }));
  }
}

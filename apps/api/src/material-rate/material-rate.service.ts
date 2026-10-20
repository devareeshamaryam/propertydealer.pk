import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { MaterialRate, MaterialRateDocument } from '@rent-ghar/db/schemas/material-rate.schema';
import { CreateMaterialRateDto, UpdateMaterialRateDto } from './dto';
import { RedisCacheService } from '../redis-cache/redis-cache.service';
import { RevalidateService } from '../revalidate/revalidate.service';
import { MaterialTypeService } from '../material-type/material-type.service';

/** The names this collection started with; anything else must be a material the admin added. */
const LEGACY_TYPES = ['Door', 'Wood', 'Sand', 'Tile', 'Bajri', 'Steel', 'Bricks'];

const TAG_RATES = 'material-rates';

@Injectable()
export class MaterialRateService {
  constructor(
    @InjectModel(MaterialRate.name)
    private materialRateModel: Model<MaterialRateDocument>,
    private readonly cache: RedisCacheService,
    private readonly revalidate: RevalidateService,
    private readonly types: MaterialTypeService,
  ) {}

  private async checkType(materialType?: string) {
    if (materialType === undefined) return;
    if (LEGACY_TYPES.includes(materialType)) return;
    if (!(await this.types.exists(materialType))) {
      throw new BadRequestException(`Unknown material "${materialType}" — add it under Dashboard → Materials first`);
    }
  }

  /** A rate of one material by its slug (the product page of a material the admin added). */
  async findBySlugInType(materialType: string, slug: string) {
    return this.cache.wrap(
      this.cache.buildKey('material-rates:type-slug', [materialType, slug]),
      async () => {
        const rate = await this.materialRateModel.findOne({ materialType, slug, isActive: { $ne: false } }).lean().exec();
        if (!rate) throw new NotFoundException(`Material rate not found: ${slug}`);
        return rate;
      },
      { ttl: 60, tags: [TAG_RATES] },
    );
  }

  /**
   * Bust the rate caches and ping all today-{material}-rate pages so they
   * pick up the new prices on the next visit.
   */
  private async bustRateCaches(materialType?: string) {
    // 'material-types': a material appears in the menu with its first product and leaves with its last.
    const tags = [TAG_RATES, 'material-types'];
    const paths: string[] = [];
    if (materialType) {
      // Public pages live at /today-<material>-rate-in-pakistan
      const m = materialType.toLowerCase();
      paths.push(`/today-${m}-rate-in-pakistan`);
    }
    await this.revalidate.revalidate({ tags, paths });
  }

  // 🚀 PERF: .lean() — these rows are returned straight to the caller for
  // display, so there is nothing to gain from hydrating Mongoose documents.
  async findAll(city?: string, materialType?: string, category?: string) {
    return this.cache.wrap(
      this.cache.buildKey('material-rates:public', [city, materialType, category]),
      () => {
        const query: any = { isActive: true };
        if (city) query.city = city;
        if (materialType) query.materialType = materialType;
        if (category) query.category = category;
        return this.materialRateModel.find(query).sort({ createdAt: -1 }).lean().exec();
      },
      { ttl: 60, tags: [TAG_RATES] },
    );
  }

  async findAllAdmin(materialType?: string) {
    const query: any = {};
    if (materialType) query.materialType = materialType;
    return this.materialRateModel.find(query).sort({ createdAt: -1 }).lean().exec();
  }

  async findById(id: string): Promise<MaterialRateDocument> {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid ID');
    const rate = await this.materialRateModel.findById(id).exec();
    if (!rate) throw new NotFoundException('Material rate not found');
    return rate;
  }

  async findBySlug(slug: string): Promise<MaterialRateDocument> {
    return this.cache.wrap(
      this.cache.buildKey('material-rates:slug', [slug]),
      async () => {
        const rate = await this.materialRateModel.findOne({ slug }).exec();
        if (!rate) throw new NotFoundException(`Material rate not found: ${slug}`);
        return rate;
      },
      { ttl: 60, tags: [TAG_RATES] },
    );
  }

  async create(dto: CreateMaterialRateDto): Promise<MaterialRateDocument> {
    await this.checkType(dto.materialType);
    const rate = new this.materialRateModel(dto);
    const saved = await rate.save();
    this.bustRateCaches(saved.materialType).catch(() => {});
    return saved;
  }

  async update(id: string, dto: UpdateMaterialRateDto): Promise<MaterialRateDocument> {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid ID');
    const rate = await this.materialRateModel.findById(id).exec();
    if (!rate) throw new NotFoundException('Material rate not found');
    await this.checkType(dto.materialType);

    Object.assign(rate, dto);
    // Explicitly mark fields to trigger the pre('save') slug regeneration
    if (dto.brand) rate.markModified('brand');

    const saved = await rate.save();
    this.bustRateCaches(saved.materialType).catch(() => {});
    return saved;
  }

  async remove(id: string): Promise<void> {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid ID');
    const rate = await this.materialRateModel.findByIdAndDelete(id).exec();
    if (!rate) throw new NotFoundException('Material rate not found');
    this.bustRateCaches(rate.materialType).catch(() => {});
  }
}

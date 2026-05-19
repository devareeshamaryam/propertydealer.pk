import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { MaterialRate, MaterialRateDocument } from '@rent-ghar/db/schemas/material-rate.schema';
import { CreateMaterialRateDto, UpdateMaterialRateDto } from './dto';
import { RedisCacheService } from '../redis-cache/redis-cache.service';
import { RevalidateService } from '../revalidate/revalidate.service';

const TAG_RATES = 'material-rates';

@Injectable()
export class MaterialRateService {
  constructor(
    @InjectModel(MaterialRate.name)
    private materialRateModel: Model<MaterialRateDocument>,
    private readonly cache: RedisCacheService,
    private readonly revalidate: RevalidateService,
  ) {}

  /**
   * Bust the rate caches and ping all today-{material}-rate pages so they
   * pick up the new prices on the next visit.
   */
  private async bustRateCaches(materialType?: string) {
    const tags = [TAG_RATES];
    const paths: string[] = [];
    if (materialType) {
      // Public pages live at /today-<material>-rate-in-pakistan
      const m = materialType.toLowerCase();
      paths.push(`/today-${m}-rate-in-pakistan`);
    }
    await this.revalidate.revalidate({ tags, paths });
  }

  async findAll(city?: string, materialType?: string, category?: string): Promise<MaterialRateDocument[]> {
    return this.cache.wrap(
      this.cache.buildKey('material-rates:public', [city, materialType, category]),
      () => {
        const query: any = { isActive: true };
        if (city) query.city = city;
        if (materialType) query.materialType = materialType;
        if (category) query.category = category;
        return this.materialRateModel.find(query).sort({ createdAt: -1 }).exec();
      },
      { ttl: 60, tags: [TAG_RATES] },
    );
  }

  async findAllAdmin(materialType?: string): Promise<MaterialRateDocument[]> {
    const query: any = {};
    if (materialType) query.materialType = materialType;
    return this.materialRateModel.find(query).sort({ createdAt: -1 }).exec();
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
    const rate = new this.materialRateModel(dto);
    const saved = await rate.save();
    this.bustRateCaches(saved.materialType).catch(() => {});
    return saved;
  }

  async update(id: string, dto: UpdateMaterialRateDto): Promise<MaterialRateDocument> {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid ID');
    const rate = await this.materialRateModel.findById(id).exec();
    if (!rate) throw new NotFoundException('Material rate not found');

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

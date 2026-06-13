 import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { CementRate, CementRateDocument } from '@rent-ghar/db/schemas/cement-rate.schema';
import { CreateCementRateDto, UpdateCementRateDto } from './dto';
import { RevalidateService } from '../revalidate/revalidate.service'; // ✅ ADD

const TAG_CEMENT_RATES = 'material-rates'; // Next.js server-api mein 'material-rates' tag use hota hai

@Injectable()
export class CementRateService {
  constructor(
    @InjectModel(CementRate.name)
    private cementRateModel: Model<CementRateDocument>,
    private readonly revalidate: RevalidateService, // ✅ ADD
  ) {}

  // ── ✅ Cache bust helper ──────────────────────────────────────────────────
  private async bustCaches(slug?: string) {
    const tags = [TAG_CEMENT_RATES];
    const paths = ['/today-cement-rate-in-pakistan'];
    if (slug) paths.push(`/today-cement-rate-in-pakistan/${slug}`);
    await this.revalidate.revalidate({ tags, paths });
  }

  async findAll(category?: string): Promise<CementRateDocument[]> {
    const query: any = { isActive: true };
    if (category) query.category = category;
    return this.cementRateModel.find(query).sort({ createdAt: -1 }).exec();
  }

  async findAllAdmin(): Promise<CementRateDocument[]> {
    return this.cementRateModel.find().sort({ createdAt: -1 }).exec();
  }

  async findById(id: string): Promise<CementRateDocument> {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid ID');
    const rate = await this.cementRateModel.findById(id).exec();
    if (!rate) throw new NotFoundException('Cement rate not found');
    return rate;
  }

  async findBySlug(slug: string): Promise<CementRateDocument> {
    const rate = await this.cementRateModel.findOne({ slug }).exec();
    if (!rate) throw new NotFoundException(`Cement rate not found: ${slug}`);
    return rate;
  }

  async create(dto: CreateCementRateDto): Promise<CementRateDocument> {
    const rate = new this.cementRateModel(dto);
    const saved = await rate.save();
    this.bustCaches(saved.slug).catch(() => {}); // ✅ ADD
    return saved;
  }

  async update(id: string, dto: UpdateCementRateDto): Promise<CementRateDocument> {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid ID');
    const rate = await this.cementRateModel.findById(id).exec();
    if (!rate) throw new NotFoundException('Cement rate not found');

    Object.assign(rate, dto);
    if (dto.brand) rate.markModified('brand');
    if (dto.category) rate.markModified('category');

    const saved = await rate.save();
    this.bustCaches(saved.slug).catch(() => {}); // ✅ ADD
    return saved;
  }

  async remove(id: string): Promise<void> {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid ID');
    const rate = await this.cementRateModel.findByIdAndDelete(id).exec();
    if (!rate) throw new NotFoundException('Cement rate not found');
    this.bustCaches(rate.slug).catch(() => {}); // ✅ ADD
  }
}
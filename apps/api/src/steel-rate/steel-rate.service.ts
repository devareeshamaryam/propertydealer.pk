 import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { SteelRate, SteelRateDocument } from '@rent-ghar/db/schemas/steel-rate.schema';
import { CreateSteelRateDto, UpdateSteelRateDto } from './dto';
import { RevalidateService } from '../revalidate/revalidate.service'; // ✅ ADD

const TAG = 'steel-rates';

@Injectable()
export class SteelRateService {
  constructor(
    @InjectModel(SteelRate.name)
    private steelRateModel: Model<SteelRateDocument>,
    private readonly revalidate: RevalidateService, // ✅ ADD
  ) {}

  private async bustCaches(slug?: string) {
    const tags = [TAG, 'material-rates'];
    const paths = ['/today-steel-rate-in-pakistan'];
    if (slug) paths.push('/today-steel-rate-in-pakistan/' + slug);
    await this.revalidate.revalidate({ tags, paths });
  }

  async findAll(city?: string, category?: string): Promise<SteelRateDocument[]> {
    const query: any = { isActive: true };
    if (city) query.city = city;
    if (category) query.category = category;
    return this.steelRateModel.find(query).sort({ createdAt: -1 }).exec();
  }

  async findAllAdmin(): Promise<SteelRateDocument[]> {
    return this.steelRateModel.find().sort({ createdAt: -1 }).exec();
  }

  async findById(id: string): Promise<SteelRateDocument> {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid ID');
    const rate = await this.steelRateModel.findById(id).exec();
    if (!rate) throw new NotFoundException('Steel rate not found');
    return rate;
  }

  async findBySlug(slug: string): Promise<SteelRateDocument> {
    let rate = await this.steelRateModel.findOne({ slug }).exec();
    if (!rate && isValidObjectId(slug)) {
      rate = await this.steelRateModel.findById(slug).exec();
    }
    if (!rate) throw new NotFoundException(`Steel rate not found: ${slug}`);
    return rate;
  }

  async create(dto: CreateSteelRateDto): Promise<SteelRateDocument> {
    const rate = new this.steelRateModel(dto);
    const saved = await rate.save();
    this.bustCaches(saved.slug).catch(() => {}); // ✅ ADD
    return saved;
  }

  async update(id: string, dto: UpdateSteelRateDto): Promise<SteelRateDocument> {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid ID');
    const rate = await this.steelRateModel
      .findByIdAndUpdate(id, dto, { new: true, runValidators: true })
      .exec();
    if (!rate) throw new NotFoundException('Steel rate not found');
    this.bustCaches(rate.slug).catch(() => {}); // ✅ ADD
    return rate;
  }

  async remove(id: string): Promise<void> {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid ID');
    const rate = await this.steelRateModel.findByIdAndDelete(id).exec();
    if (!rate) throw new NotFoundException('Steel rate not found');
    this.bustCaches(rate.slug).catch(() => {}); // ✅ ADD
  }
}
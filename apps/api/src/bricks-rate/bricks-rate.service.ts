 import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { BricksRate, BricksRateDocument } from '@rent-ghar/db/schemas/bricks-rate.schema';
import { CreateBricksRateDto, UpdateBricksRateDto } from './dto';
import { RevalidateService } from '../revalidate/revalidate.service'; // ✅ ADD

const TAG = 'bricks-rates';

@Injectable()
export class BricksRateService {
  constructor(
    @InjectModel(BricksRate.name)
    private bricksRateModel: Model<BricksRateDocument>,
    private readonly revalidate: RevalidateService, // ✅ ADD
  ) {}

  private async bustCaches(slug?: string) {
    const tags = [TAG, 'material-rates'];
    const paths = ['/today-bricks-rate-in-pakistan'];
    if (slug) paths.push('/today-bricks-rate-in-pakistan/' + slug);
    await this.revalidate.revalidate({ tags, paths });
  }

  async findAll(city?: string, category?: string): Promise<BricksRateDocument[]> {
    const query: any = { isActive: true };
    if (city) query.city = city;
    if (category) query.category = category;
    return this.bricksRateModel.find(query).sort({ createdAt: -1 }).exec();
  }

  async findAllAdmin(): Promise<BricksRateDocument[]> {
    return this.bricksRateModel.find().sort({ createdAt: -1 }).exec();
  }

  async findById(id: string): Promise<BricksRateDocument> {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid ID');
    const rate = await this.bricksRateModel.findById(id).exec();
    if (!rate) throw new NotFoundException('Bricks rate not found');
    return rate;
  }

  async findBySlug(slug: string): Promise<BricksRateDocument> {
    let rate = await this.bricksRateModel.findOne({ slug }).exec();
    if (!rate && isValidObjectId(slug)) {
      rate = await this.bricksRateModel.findById(slug).exec();
    }
    if (!rate) throw new NotFoundException(`Bricks rate not found: ${slug}`);
    return rate;
  }

  async create(dto: CreateBricksRateDto): Promise<BricksRateDocument> {
    const rate = new this.bricksRateModel(dto);
    const saved = await rate.save();
    this.bustCaches(saved.slug).catch(() => {}); // ✅ ADD
    return saved;
  }

  async update(id: string, dto: UpdateBricksRateDto): Promise<BricksRateDocument> {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid ID');
    const rate = await this.bricksRateModel
      .findByIdAndUpdate(id, dto, { new: true, runValidators: true })
      .exec();
    if (!rate) throw new NotFoundException('Bricks rate not found');
    this.bustCaches(rate.slug).catch(() => {}); // ✅ ADD
    return rate;
  }

  async remove(id: string): Promise<void> {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid ID');
    const rate = await this.bricksRateModel.findByIdAndDelete(id).exec();
    if (!rate) throw new NotFoundException('Bricks rate not found');
    this.bustCaches(rate.slug).catch(() => {}); // ✅ ADD
  }
}
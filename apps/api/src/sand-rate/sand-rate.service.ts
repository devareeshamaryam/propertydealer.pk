 import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { SandRate, SandRateDocument } from '@rent-ghar/db/schemas/sand-rate.schema';
import { CreateSandRateDto, UpdateSandRateDto } from './dto';
import { RevalidateService } from '../revalidate/revalidate.service'; // ✅ ADD

const TAG = 'sand-rates';

@Injectable()
export class SandRateService {
  constructor(
    @InjectModel(SandRate.name)
    private sandRateModel: Model<SandRateDocument>,
    private readonly revalidate: RevalidateService, // ✅ ADD
  ) {}

  private async bustCaches(slug?: string) {
    const tags = [TAG, 'material-rates'];
    const paths = ['/today-sand-rate-in-pakistan'];
    if (slug) paths.push('/today-sand-rate-in-pakistan/' + slug);
    await this.revalidate.revalidate({ tags, paths });
  }

  async findAll(city?: string, category?: string): Promise<SandRateDocument[]> {
    const query: any = { isActive: true };
    if (city) query.city = city;
    if (category) query.category = category;
    return this.sandRateModel.find(query).sort({ createdAt: -1 }).exec();
  }

  async findAllAdmin(): Promise<SandRateDocument[]> {
    return this.sandRateModel.find().sort({ createdAt: -1 }).exec();
  }

  async findById(id: string): Promise<SandRateDocument> {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid ID');
    const rate = await this.sandRateModel.findById(id).exec();
    if (!rate) throw new NotFoundException('Sand rate not found');
    return rate;
  }

  async findBySlug(slug: string): Promise<SandRateDocument> {
    let rate = await this.sandRateModel.findOne({ slug }).exec();
    if (!rate && isValidObjectId(slug)) {
      rate = await this.sandRateModel.findById(slug).exec();
    }
    if (!rate) throw new NotFoundException(`Sand rate not found: ${slug}`);
    return rate;
  }

  async create(dto: CreateSandRateDto): Promise<SandRateDocument> {
    const rate = new this.sandRateModel(dto);
    const saved = await rate.save();
    this.bustCaches(saved.slug).catch(() => {}); // ✅ ADD
    return saved;
  }

  async update(id: string, dto: UpdateSandRateDto): Promise<SandRateDocument> {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid ID');
    const rate = await this.sandRateModel
      .findByIdAndUpdate(id, dto, { new: true, runValidators: true })
      .exec();
    if (!rate) throw new NotFoundException('Sand rate not found');
    this.bustCaches(rate.slug).catch(() => {}); // ✅ ADD
    return rate;
  }

  async remove(id: string): Promise<void> {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid ID');
    const rate = await this.sandRateModel.findByIdAndDelete(id).exec();
    if (!rate) throw new NotFoundException('Sand rate not found');
    this.bustCaches(rate.slug).catch(() => {}); // ✅ ADD
  }
}
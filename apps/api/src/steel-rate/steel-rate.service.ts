import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { SteelRate, SteelRateDocument } from '@rent-ghar/db/schemas/steel-rate.schema';
import { CreateSteelRateDto, UpdateSteelRateDto } from './dto';

@Injectable()
export class SteelRateService {
  constructor(
    @InjectModel(SteelRate.name)
    private steelRateModel: Model<SteelRateDocument>,
  ) {}

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
    const rate = await this.steelRateModel.findOne({ slug }).exec();
    if (!rate) throw new NotFoundException(`Steel rate not found: ${slug}`);
    return rate;
  }

  async create(dto: CreateSteelRateDto): Promise<SteelRateDocument> {
    const rate = new this.steelRateModel(dto);
    return rate.save();
  }

  async update(id: string, dto: UpdateSteelRateDto): Promise<SteelRateDocument> {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid ID');
    const rate = await this.steelRateModel
      .findByIdAndUpdate(id, dto, { new: true, runValidators: true })
      .exec();
    if (!rate) throw new NotFoundException('Steel rate not found');
    return rate;
  }

  async remove(id: string): Promise<void> {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid ID');
    const rate = await this.steelRateModel.findByIdAndDelete(id).exec();
    if (!rate) throw new NotFoundException('Steel rate not found');
  }
}

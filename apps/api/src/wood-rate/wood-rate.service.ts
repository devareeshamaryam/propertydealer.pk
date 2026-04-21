import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { WoodRate, WoodRateDocument } from '@rent-ghar/db/schemas/wood-rate.schema';
import { CreateWoodRateDto, UpdateWoodRateDto } from './dto';

@Injectable()
export class WoodRateService {
  constructor(
    @InjectModel(WoodRate.name)
    private woodRateModel: Model<WoodRateDocument>,
  ) {}

  async findAll(city?: string, category?: string): Promise<WoodRateDocument[]> {
    const query: any = { isActive: true };
    if (city) query.city = city;
    if (category) query.category = category;
    return this.woodRateModel.find(query).sort({ createdAt: -1 }).exec();
  }

  async findAllAdmin(): Promise<WoodRateDocument[]> {
    return this.woodRateModel.find().sort({ createdAt: -1 }).exec();
  }

  async findById(id: string): Promise<WoodRateDocument> {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid ID');
    const rate = await this.woodRateModel.findById(id).exec();
    if (!rate) throw new NotFoundException('Wood rate not found');
    return rate;
  }

  async findBySlug(slug: string): Promise<WoodRateDocument> {
    const rate = await this.woodRateModel.findOne({ slug }).exec();
    if (!rate) throw new NotFoundException(`Wood rate not found: ${slug}`);
    return rate;
  }

  async create(dto: CreateWoodRateDto): Promise<WoodRateDocument> {
    const rate = new this.woodRateModel(dto);
    return rate.save();
  }

  async update(id: string, dto: UpdateWoodRateDto): Promise<WoodRateDocument> {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid ID');
    const rate = await this.woodRateModel
      .findByIdAndUpdate(id, dto, { new: true, runValidators: true })
      .exec();
    if (!rate) throw new NotFoundException('Wood rate not found');
    return rate;
  }

  async remove(id: string): Promise<void> {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid ID');
    const rate = await this.woodRateModel.findByIdAndDelete(id).exec();
    if (!rate) throw new NotFoundException('Wood rate not found');
  }
}

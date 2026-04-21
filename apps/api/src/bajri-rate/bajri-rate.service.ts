import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { BajriRate, BajriRateDocument } from '@rent-ghar/db/schemas/bajri-rate.schema';
import { CreateBajriRateDto, UpdateBajriRateDto } from './dto';

@Injectable()
export class BajriRateService {
  constructor(
    @InjectModel(BajriRate.name)
    private bajriRateModel: Model<BajriRateDocument>,
  ) {}

  async findAll(city?: string, category?: string): Promise<BajriRateDocument[]> {
    const query: any = { isActive: true };
    if (city) query.city = city;
    if (category) query.category = category;
    return this.bajriRateModel.find(query).sort({ createdAt: -1 }).exec();
  }

  async findAllAdmin(): Promise<BajriRateDocument[]> {
    return this.bajriRateModel.find().sort({ createdAt: -1 }).exec();
  }

  async findById(id: string): Promise<BajriRateDocument> {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid ID');
    const rate = await this.bajriRateModel.findById(id).exec();
    if (!rate) throw new NotFoundException('Bajri rate not found');
    return rate;
  }

  async findBySlug(slug: string): Promise<BajriRateDocument> {
    const rate = await this.bajriRateModel.findOne({ slug }).exec();
    if (!rate) throw new NotFoundException(`Bajri rate not found: ${slug}`);
    return rate;
  }

  async create(dto: CreateBajriRateDto): Promise<BajriRateDocument> {
    const rate = new this.bajriRateModel(dto);
    return rate.save();
  }

  async update(id: string, dto: UpdateBajriRateDto): Promise<BajriRateDocument> {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid ID');
    const rate = await this.bajriRateModel
      .findByIdAndUpdate(id, dto, { new: true, runValidators: true })
      .exec();
    if (!rate) throw new NotFoundException('Bajri rate not found');
    return rate;
  }

  async remove(id: string): Promise<void> {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid ID');
    const rate = await this.bajriRateModel.findByIdAndDelete(id).exec();
    if (!rate) throw new NotFoundException('Bajri rate not found');
  }
}

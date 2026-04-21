import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { SandRate, SandRateDocument } from '@rent-ghar/db/schemas/sand-rate.schema';
import { CreateSandRateDto, UpdateSandRateDto } from './dto';

@Injectable()
export class SandRateService {
  constructor(
    @InjectModel(SandRate.name)
    private sandRateModel: Model<SandRateDocument>,
  ) {}

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
    const rate = await this.sandRateModel.findOne({ slug }).exec();
    if (!rate) throw new NotFoundException(`Sand rate not found: ${slug}`);
    return rate;
  }

  async create(dto: CreateSandRateDto): Promise<SandRateDocument> {
    const rate = new this.sandRateModel(dto);
    return rate.save();
  }

  async update(id: string, dto: UpdateSandRateDto): Promise<SandRateDocument> {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid ID');
    const rate = await this.sandRateModel
      .findByIdAndUpdate(id, dto, { new: true, runValidators: true })
      .exec();
    if (!rate) throw new NotFoundException('Sand rate not found');
    return rate;
  }

  async remove(id: string): Promise<void> {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid ID');
    const rate = await this.sandRateModel.findByIdAndDelete(id).exec();
    if (!rate) throw new NotFoundException('Sand rate not found');
  }
}

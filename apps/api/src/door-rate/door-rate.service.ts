import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { DoorRate, DoorRateDocument } from '@rent-ghar/db/schemas/door-rate.schema';
import { CreateDoorRateDto, UpdateDoorRateDto } from './dto';

@Injectable()
export class DoorRateService {
  constructor(
    @InjectModel(DoorRate.name)
    private doorRateModel: Model<DoorRateDocument>,
  ) {}

  async findAll(city?: string, category?: string): Promise<DoorRateDocument[]> {
    const query: any = { isActive: true };
    if (city) query.city = city;
    if (category) query.category = category;
    return this.doorRateModel.find(query).sort({ createdAt: -1 }).exec();
  }

  async findAllAdmin(): Promise<DoorRateDocument[]> {
    return this.doorRateModel.find().sort({ createdAt: -1 }).exec();
  }

  async findById(id: string): Promise<DoorRateDocument> {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid ID');
    const rate = await this.doorRateModel.findById(id).exec();
    if (!rate) throw new NotFoundException('Door rate not found');
    return rate;
  }

  async findBySlug(slug: string): Promise<DoorRateDocument> {
    const rate = await this.doorRateModel.findOne({ slug }).exec();
    if (!rate) throw new NotFoundException(`Door rate not found: ${slug}`);
    return rate;
  }

  async create(dto: CreateDoorRateDto): Promise<DoorRateDocument> {
    const rate = new this.doorRateModel(dto);
    return rate.save();
  }

  async update(id: string, dto: UpdateDoorRateDto): Promise<DoorRateDocument> {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid ID');
    const rate = await this.doorRateModel
      .findByIdAndUpdate(id, dto, { new: true, runValidators: true })
      .exec();
    if (!rate) throw new NotFoundException('Door rate not found');
    return rate;
  }

  async remove(id: string): Promise<void> {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid ID');
    const rate = await this.doorRateModel.findByIdAndDelete(id).exec();
    if (!rate) throw new NotFoundException('Door rate not found');
  }
}

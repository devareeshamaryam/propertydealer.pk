import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { TileRate, TileRateDocument } from '@rent-ghar/db/schemas/tile-rate.schema';
import { CreateTileRateDto, UpdateTileRateDto } from './dto';

@Injectable()
export class TileRateService {
  constructor(
    @InjectModel(TileRate.name)
    private tileRateModel: Model<TileRateDocument>,
  ) {}

  async findAll(city?: string, category?: string): Promise<TileRateDocument[]> {
    const query: any = { isActive: true };
    if (city) query.city = city;
    if (category) query.category = category;
    return this.tileRateModel.find(query).sort({ createdAt: -1 }).exec();
  }

  async findAllAdmin(): Promise<TileRateDocument[]> {
    return this.tileRateModel.find().sort({ createdAt: -1 }).exec();
  }

  async findById(id: string): Promise<TileRateDocument> {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid ID');
    const rate = await this.tileRateModel.findById(id).exec();
    if (!rate) throw new NotFoundException('Tile rate not found');
    return rate;
  }

  async findBySlug(slug: string): Promise<TileRateDocument> {
    const rate = await this.tileRateModel.findOne({ slug }).exec();
    if (!rate) throw new NotFoundException(`Tile rate not found: ${slug}`);
    return rate;
  }

  async create(dto: CreateTileRateDto): Promise<TileRateDocument> {
    const rate = new this.tileRateModel(dto);
    return rate.save();
  }

  async update(id: string, dto: UpdateTileRateDto): Promise<TileRateDocument> {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid ID');
    const rate = await this.tileRateModel
      .findByIdAndUpdate(id, dto, { new: true, runValidators: true })
      .exec();
    if (!rate) throw new NotFoundException('Tile rate not found');
    return rate;
  }

  async remove(id: string): Promise<void> {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid ID');
    const rate = await this.tileRateModel.findByIdAndDelete(id).exec();
    if (!rate) throw new NotFoundException('Tile rate not found');
  }
}

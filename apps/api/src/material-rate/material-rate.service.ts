import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { MaterialRate, MaterialRateDocument } from '@rent-ghar/db/schemas/material-rate.schema';
import { CreateMaterialRateDto, UpdateMaterialRateDto } from './dto';

@Injectable()
export class MaterialRateService {
  constructor(
    @InjectModel(MaterialRate.name)
    private materialRateModel: Model<MaterialRateDocument>,
  ) {}

  async findAll(city?: string, materialType?: string, category?: string): Promise<MaterialRateDocument[]> {
    const query: any = { isActive: true };
    if (city) query.city = city;
    if (materialType) query.materialType = materialType;
    if (category) query.category = category;
    return this.materialRateModel.find(query).sort({ createdAt: -1 }).exec();
  }

  async findAllAdmin(materialType?: string): Promise<MaterialRateDocument[]> {
    const query: any = {};
    if (materialType) query.materialType = materialType;
    return this.materialRateModel.find(query).sort({ createdAt: -1 }).exec();
  }

  async findById(id: string): Promise<MaterialRateDocument> {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid ID');
    const rate = await this.materialRateModel.findById(id).exec();
    if (!rate) throw new NotFoundException('Material rate not found');
    return rate;
  }

  async findBySlug(slug: string): Promise<MaterialRateDocument> {
    const rate = await this.materialRateModel.findOne({ slug }).exec();
    if (!rate) throw new NotFoundException(`Material rate not found: ${slug}`);
    return rate;
  }

  async create(dto: CreateMaterialRateDto): Promise<MaterialRateDocument> {
    const rate = new this.materialRateModel(dto);
    return rate.save();
  }

  async update(id: string, dto: UpdateMaterialRateDto): Promise<MaterialRateDocument> {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid ID');
    const rate = await this.materialRateModel.findById(id).exec();
    if (!rate) throw new NotFoundException('Material rate not found');

    Object.assign(rate, dto);
    // Explicitly mark fields to trigger the pre('save') slug regeneration
    if (dto.brand) rate.markModified('brand');

    return rate.save();
  }

  async remove(id: string): Promise<void> {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid ID');
    const rate = await this.materialRateModel.findByIdAndDelete(id).exec();
    if (!rate) throw new NotFoundException('Material rate not found');
  }
}

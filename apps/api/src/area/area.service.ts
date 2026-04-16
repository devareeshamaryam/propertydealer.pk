/* eslint-disable prettier/prettier */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { Area, AreaDocument } from '@rent-ghar/db/schemas/area.schema';
import { CreateAreaDto } from '@rent-ghar/dtos/area/createarea.dto';
import { UpdateAreaDto } from '@rent-ghar/dtos/area/updatearea.dto';

@Injectable()
export class AreaService {
  constructor(@InjectModel(Area.name) private areaModel: Model<AreaDocument>) {}

  async createArea(createAreaDto: CreateAreaDto): Promise<AreaDocument> {
    // Validate city ID
    if (!isValidObjectId(createAreaDto.city)) {
      throw new NotFoundException('Invalid city ID');
    }

    const areaData: any = {
      name: createAreaDto.name,
      city: createAreaDto.city,
    };

    if (createAreaDto.metaTitle) areaData.metaTitle = createAreaDto.metaTitle;
    if (createAreaDto.areaSlug) areaData.areaSlug = createAreaDto.areaSlug;
    if (createAreaDto.metaDescription)
      areaData.metaDescription = createAreaDto.metaDescription;
    if (createAreaDto.canonicalUrl)
      areaData.canonicalUrl = createAreaDto.canonicalUrl;
    if (createAreaDto.description)
      areaData.description = createAreaDto.description;
    if (createAreaDto.rentMetaTitle) areaData.rentMetaTitle = createAreaDto.rentMetaTitle;
    if (createAreaDto.rentMetaDescription) areaData.rentMetaDescription = createAreaDto.rentMetaDescription;
    if (createAreaDto.rentContent) areaData.rentContent = createAreaDto.rentContent;
    if (createAreaDto.saleMetaTitle) areaData.saleMetaTitle = createAreaDto.saleMetaTitle;
    if (createAreaDto.saleMetaDescription) areaData.saleMetaDescription = createAreaDto.saleMetaDescription;
    if (createAreaDto.saleContent) areaData.saleContent = createAreaDto.saleContent;

    const createdArea = new this.areaModel(areaData);
    return await createdArea.save();
  }

  async findAllAreas(): Promise<AreaDocument[]> {
    return await this.areaModel
      .find()
      .populate('city', 'name state country')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findAreaById(id: string): Promise<AreaDocument> {
    if (!isValidObjectId(id)) {
      throw new NotFoundException('Invalid area ID');
    }
    const area = await this.areaModel
      .findById(id)
      .populate('city', 'name state country')
      .exec();
    if (!area) {
      throw new NotFoundException('Area not found');
    }
    return area as AreaDocument;
  }

  async findAreaByName(name: string, cityId?: string): Promise<AreaDocument> {
    const query: any = { 
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } 
    };
    if (cityId) query.city = cityId;

    const area = await this.areaModel
      .findOne(query)
      .populate('city', 'name state country')
      .exec();
    if (!area) {
      throw new NotFoundException(`Area ${name} not found`);
    }
    return area as AreaDocument;
  }

  async findAreasByCity(cityId: string): Promise<AreaDocument[]> {
    if (!isValidObjectId(cityId)) {
      throw new NotFoundException('Invalid city ID');
    }
    return await this.areaModel
      .find({ city: cityId })
      .populate('city', 'name state country')
      .sort({ name: 1 })
      .exec();
  }

  async findAreaBySlug(slug: string, cityId?: string): Promise<AreaDocument> {
    const query: any = { 
      areaSlug: { $regex: new RegExp(`^${slug.trim()}$`, 'i') } 
    };
    if (cityId) query.city = cityId;

    let area = await this.areaModel
      .findOne(query)
      .populate('city', 'name state country')
      .exec();

    // Fallback: If areaSlug is missing in historical DB entries, find dynamically
    if (!area) {
      const fallbackQuery = cityId ? { city: cityId } : {};
      const allAreas = await this.areaModel.find(fallbackQuery).populate('city', 'name state country').exec();
      const targetSlug = slug.trim().toLowerCase();
      
      area = allAreas.find(a => {
        const generatedSlug = a.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        return generatedSlug === targetSlug;
      }) || null;

      // Lazily update the database if we found a match so it's much faster next time
      if (area && !area.areaSlug) {
        area.areaSlug = targetSlug;
        area.save().catch(e => console.error('Silent error updating areaSlug fallback', e));
      }
    }

    if (!area) {
      throw new NotFoundException(`Area with slug ${slug} not found`);
    }
    return area as AreaDocument;
  }

  async updateArea(
    id: string,
    updateAreaDto: UpdateAreaDto,
  ): Promise<AreaDocument> {
    if (!isValidObjectId(id)) {
      throw new NotFoundException('Invalid area ID');
    }

    console.log('UpdateArea Input:', JSON.stringify(updateAreaDto, null, 2));

    // Construct update object to avoid overwriting fields with undefined
    const updateData: any = {};
    Object.keys(updateAreaDto).forEach(key => {
      if (updateAreaDto[key] !== undefined) {
        updateData[key] = updateAreaDto[key];
      }
    });

    const area = await this.areaModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate('city', 'name state country').exec();

    if (!area) {
      throw new NotFoundException('Area not found');
    }

    console.log('UpdateArea Success. Updated fields:', {
      rentMetaTitle: area.rentMetaTitle,
      saleMetaTitle: area.saleMetaTitle,
      rentMetaDescription: area.rentMetaDescription,
      saleMetaDescription: area.saleMetaDescription
    });

    return area;
  }

  async deleteArea(id: string): Promise<void> {
    if (!isValidObjectId(id)) {
      throw new NotFoundException('Invalid area ID');
    }
    const area = await this.areaModel.findByIdAndDelete(id).exec();
    if (!area) {
      throw new NotFoundException('Area not found');
    }
  }
}

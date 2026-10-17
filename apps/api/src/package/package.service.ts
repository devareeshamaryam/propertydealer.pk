import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Package, PackageDocument } from '@rent-ghar/db/schemas/package.schema';
import { CreatePackageDto, UpdatePackageDto } from '@rent-ghar/types/package';
import { RevalidateService } from '../revalidate/revalidate.service';
import { AgencyService } from '../agency/agency.service';

@Injectable()
export class PackageService {
  constructor(
    @InjectModel(Package.name) private packageModel: Model<PackageDocument>,
    private readonly revalidate: RevalidateService,
    private readonly agency: AgencyService,
  ) {}

  /** Plans show on the homepage and /packages, and decide who is verified. */
  private changed() {
    void this.revalidate.revalidate({ tags: ['packages'], paths: ['/', '/packages'] });
    void this.agency.refreshVerified();
  }

  async create(dto: CreatePackageDto): Promise<PackageDocument> {
    const packageDoc = await new this.packageModel(dto).save();
    this.changed();
    return packageDoc;
  }

  async findAll(): Promise<PackageDocument[]> {
    return this.packageModel.find({ isActive: true }).sort({ price: 1 }).exec();
  }

  async findAllIncludingInactive(): Promise<PackageDocument[]> {
    return this.packageModel.find().sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string): Promise<PackageDocument> {
    const packageDoc = await this.packageModel.findById(id).exec();
    if (!packageDoc) {
      throw new NotFoundException(`Package with ID ${id} not found`);
    }
    return packageDoc;
  }

  async update(id: string, dto: UpdatePackageDto): Promise<PackageDocument> {
    const packageDoc = await this.packageModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!packageDoc) {
      throw new NotFoundException(`Package with ID ${id} not found`);
    }
    this.changed();
    return packageDoc;
  }

  async delete(id: string): Promise<{ success: boolean; message: string }> {
    const result = await this.packageModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Package with ID ${id} not found`);
    }
    this.changed();
    return {
      success: true,
      message: 'Package deleted successfully',
    };
  }
}

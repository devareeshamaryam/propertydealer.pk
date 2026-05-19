import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Area } from '@rent-ghar/db/schemas/area.schema';
import { City } from '@rent-ghar/db/schemas/city.schema';
import { User } from '@rent-ghar/db/schemas/user.schema';
import { PropertyService } from '../property/property.service';
import { CreateListingDto } from './dto/create-listing.dto';

/**
 * ListingApiService
 * -----------------
 * Bridges incoming automation payloads (n8n / external API key callers) to the
 * existing PropertyService. Forces every created listing to `status: 'draft'`
 * and tags `source: 'api'` so that admins can review automation submissions
 * before they go live.
 */
@Injectable()
export class ListingApiService {
  constructor(
    @InjectModel(Area.name) private readonly areaModel: Model<Area>,
    @InjectModel(City.name) private readonly cityModel: Model<City>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly propertyService: PropertyService,
    private readonly configService: ConfigService,
  ) {}

  private toSlug(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Returns the user ID under which API-created drafts are owned. Configurable
   * via `LISTING_API_OWNER_ID`. Falls back to the first ADMIN user in the DB.
   */
  private async resolveAutomationOwnerId(): Promise<string> {
    const configured = this.configService.get<string>('LISTING_API_OWNER_ID');
    if (configured && Types.ObjectId.isValid(configured)) {
      const found = await this.userModel
        .findById(configured)
        .select('_id')
        .lean()
        .exec();
      if (found) return String(found._id);
    }

    const admin = await this.userModel
      .findOne({ role: 'ADMIN' })
      .select('_id')
      .lean()
      .exec();
    if (admin) return String(admin._id);

    throw new InternalServerErrorException(
      'No admin user available to own API-created drafts. Set LISTING_API_OWNER_ID env or create an ADMIN user.',
    );
  }

  /**
   * Resolve the Area ObjectId for a listing.
   * Accepts either an explicit area ObjectId or names that can be looked up /
   * auto-created. Names are stored lowercase to match existing schema.
   */
  private async resolveAreaId(dto: CreateListingDto): Promise<string> {
    if (dto.area) {
      if (!Types.ObjectId.isValid(dto.area)) {
        throw new BadRequestException('Invalid area id');
      }
      const exists = await this.areaModel
        .findById(dto.area)
        .select('_id')
        .lean()
        .exec();
      if (!exists) throw new BadRequestException('Area not found');
      return String(exists._id);
    }

    if (!dto.cityName || !dto.areaName) {
      throw new BadRequestException(
        'Either `area` (ObjectId) or both `cityName` and `areaName` must be provided',
      );
    }

    const cityNameLc = dto.cityName.trim().toLowerCase();
    const areaNameLc = dto.areaName.trim().toLowerCase();

    let city = await this.cityModel.findOne({ name: cityNameLc }).exec();
    if (!city) {
      // Match by case-insensitive regex as a fallback (since city.name has
      // unusual schema flag `nameCase` and may not be lowercased on create).
      city = await this.cityModel
        .findOne({ name: { $regex: `^${cityNameLc}$`, $options: 'i' } })
        .exec();
    }
    if (!city) {
      city = await this.cityModel.create({ name: dto.cityName.trim() } as any);
    }

    let area = await this.areaModel
      .findOne({ name: areaNameLc, city: city._id })
      .exec();
    if (!area) {
      area = await this.areaModel.create({
        name: areaNameLc,
        areaSlug: this.toSlug(dto.areaName),
        city: city._id,
      } as any);
    }
    return String(area._id);
  }

  async createDraftListing(dto: CreateListingDto) {
    const areaId = await this.resolveAreaId(dto);
    const ownerId = await this.resolveAutomationOwnerId();

    // Compose the DTO that PropertyService.create expects. We deliberately
    // reuse the existing service so all server-side invariants (slug
    // generation, etc.) stay in one place.
    const photoUrls = dto.additionalPhotosUrls ?? [];
    const mainPhoto = dto.mainPhotoUrl ?? photoUrls[0];
    const remainingPhotos = dto.mainPhotoUrl
      ? photoUrls
      : photoUrls.slice(1);

    const created = await this.propertyService.create(
      ownerId,
      {
        listingType: dto.listingType,
        propertyType: dto.propertyType as any,
        area: areaId,
        title: dto.title,
        slug: dto.slug,
        location: dto.location,
        bedrooms: dto.bedrooms,
        bathrooms: dto.bathrooms,
        areaSize: dto.areaSize,
        price: dto.price,
        marla: dto.marla,
        kanal: dto.kanal,
        description: dto.description,
        contactNumber: dto.contactNumber,
        whatsappNumber: dto.whatsappNumber,
        features: dto.features,
        latitude: dto.latitude,
        longitude: dto.longitude,
      } as any,
      mainPhoto,
      remainingPhotos,
      'ADMIN', // act as admin to bypass subscription checks for automation
      { source: 'api', status: 'draft' },
    );

    return {
      success: true,
      message: 'Draft listing created. An admin will review and publish it.',
      id: (created as any)._id,
      status: (created as any).status,
      slug: (created as any).slug,
    };
  }

  async listCities() {
    return this.cityModel.find().select('_id name').sort({ name: 1 }).lean().exec();
  }

  async listAreas(cityId?: string) {
    const filter: any = {};
    if (cityId) {
      if (!Types.ObjectId.isValid(cityId)) {
        throw new BadRequestException('Invalid cityId');
      }
      filter.city = cityId;
    }
    return this.areaModel
      .find(filter)
      .select('_id name areaSlug city')
      .sort({ name: 1 })
      .lean()
      .exec();
  }

  getPropertyTypes() {
    return [
      'house',
      'apartment',
      'flat',
      'commercial',
      'land',
      'shop',
      'office',
      'factory',
      'hotel',
      'restaurant',
      'plot',
      'other',
    ];
  }
}

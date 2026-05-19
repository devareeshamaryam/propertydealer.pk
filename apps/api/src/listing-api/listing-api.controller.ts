import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiKeyGuard } from './api-key.guard';
import { ListingApiService } from './listing-api.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { StorageService } from '@rent-ghar/storage/storage.service';
import { PropertyService } from '../property/property.service';

/**
 * ListingApiController
 * --------------------
 * Limited-scope external API for automation tools (e.g. n8n).
 *
 * Auth: every route is protected by `ApiKeyGuard` (header `x-api-key`).
 * Scope: ONLY the endpoints needed to create draft property listings and look
 * up reference data (cities, areas, property types). It does NOT expose
 * delete, status changes, user data, or admin operations.
 *
 * All created listings are forced to `status: 'draft'` and `source: 'api'` —
 * an admin must review and publish them via the dashboard.
 */
@Controller('listing-api')
@UseGuards(ApiKeyGuard)
export class ListingApiController {
  constructor(
    private readonly listingApiService: ListingApiService,
    private readonly storageService: StorageService,
    private readonly propertyService: PropertyService,
  ) {}

  /** Sanity check / API-key validity probe. */
  @Get('health')
  health() {
    return { ok: true, scope: 'listings', status: 'authenticated' };
  }

  /** Reference data: list of property types accepted by the create endpoint. */
  @Get('property-types')
  getPropertyTypes() {
    return { types: this.listingApiService.getPropertyTypes() };
  }

  /** Reference data: cities (for n8n to map to areaId). */
  @Get('cities')
  async listCities() {
    const cities = await this.listingApiService.listCities();
    return { cities };
  }

  /** Reference data: areas, optionally filtered by cityId. */
  @Get('areas')
  async listAreas(@Query('cityId') cityId?: string) {
    const areas = await this.listingApiService.listAreas(cityId);
    return { areas };
  }

  /**
   * Upload a single image and get back a public URL that can be used in the
   * `mainPhotoUrl` / `additionalPhotosUrls` fields of the create endpoint.
   *
   * Field name: `file` (multipart/form-data).
   */
  @Post('uploads')
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file: any) {
    if (!file) throw new BadRequestException('No file uploaded');
    const key = await this.storageService.upload(file, 'properties');
    const url = this.storageService.getUrl(key);
    return { key, url };
  }

  /**
   * Create a draft listing. Admin must review & publish before it goes live.
   */
  @Post('listings')
  async createListing(@Body() dto: CreateListingDto) {
    return this.listingApiService.createDraftListing(dto);
  }

  /**
   * Fetch a single listing's status (so n8n can poll / log results).
   * Returns minimal info — not the full property record.
   */
  @Get('listings/:id')
  async getListing(@Param('id') id: string) {
    const property = await this.propertyService.findPropertyByid(id);
    return {
      id: (property as any)._id,
      slug: (property as any).slug,
      title: (property as any).title,
      status: (property as any).status,
      source: (property as any).source,
      createdAt: (property as any).createdAt,
      updatedAt: (property as any).updatedAt,
    };
  }
}

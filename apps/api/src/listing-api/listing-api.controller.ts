import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
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
   * Upload one or more images and get back public URLs for use in `/listings`.
   *
   * Single file: field name `file` (multipart/form-data).
   * Multiple files: field name `files` (repeat the field for each image).
   */
  @Post('uploads')
  @UseInterceptors(AnyFilesInterceptor())
  async upload(@Req() req: any) {
    const files = (req.files as Express.Multer.File[]) ?? [];
    const normalized = files.filter(
      (f) => f.fieldname === 'file' || f.fieldname === 'files',
    );

    if (normalized.length === 0) {
      throw new BadRequestException(
        'No file uploaded. Use multipart/form-data with field `file` (single) or `files` (multiple).',
      );
    }

    const uploaded = await Promise.all(
      normalized.map(async (file) => {
        const key = await this.storageService.upload(file, 'properties');
        return { key, url: this.storageService.getUrl(key) };
      }),
    );

    if (uploaded.length === 1) {
      return uploaded[0];
    }

    return { files: uploaded };
  }

  /**
   * Create a draft listing. Admin must review & publish before it goes live.
   *
   * Accepts either:
   *  - `application/json` with `mainPhotoUrl` / `additionalPhotosUrls`, or
   *  - `multipart/form-data` with `mainPhoto` / `additionalPhotos` file fields
   *    (same as the dashboard property form).
   */
  @Post('listings')
  @UseInterceptors(AnyFilesInterceptor())
  async createListing(@Req() req: any, @Body() dto: CreateListingDto) {
    const files = (req.files as Express.Multer.File[]) ?? [];
    const mainPhotoFile = files.find((f) => f.fieldname === 'mainPhoto');
    const additionalPhotoFiles = files.filter(
      (f) => f.fieldname === 'additionalPhotos',
    );

    let mainPhotoUrl = dto.mainPhotoUrl;
    let additionalPhotosUrls = [...(dto.additionalPhotosUrls ?? [])];

    if (mainPhotoFile) {
      const key = await this.storageService.upload(mainPhotoFile, 'properties');
      mainPhotoUrl = this.storageService.getUrl(key);
    } else if (req.body?.mainPhotoUrl) {
      mainPhotoUrl = req.body.mainPhotoUrl;
    }

    if (additionalPhotoFiles.length > 0) {
      const uploadedUrls = await Promise.all(
        additionalPhotoFiles.map(async (file) => {
          const key = await this.storageService.upload(file, 'properties');
          return this.storageService.getUrl(key);
        }),
      );
      additionalPhotosUrls = [...additionalPhotosUrls, ...uploadedUrls];
    }

    const bodyAdditional = (req.body?.additionalPhotosUrls ??
      req.body?.['additionalPhotosUrls[]']) as string | string[] | undefined;
    if (bodyAdditional) {
      const bodyUrls = Array.isArray(bodyAdditional)
        ? bodyAdditional
        : [bodyAdditional];
      additionalPhotosUrls = [...additionalPhotosUrls, ...bodyUrls];
    }

    return this.listingApiService.createDraftListing({
      ...dto,
      mainPhotoUrl,
      additionalPhotosUrls:
        additionalPhotosUrls.length > 0 ? additionalPhotosUrls : undefined,
    });
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

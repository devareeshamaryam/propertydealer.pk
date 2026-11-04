import { BadRequestException, Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { ApiKeyGuard } from './api-key.guard';
import { ListingApiService } from './listing-api.service';
import { CreateListingDto, SIZE_UNITS } from './dto/create-listing.dto';

/**
 * /api/listing-api — for automation (n8n, scripts): add listings, update
 * them, mark them sold/rented, and look up cities and areas. Every route
 * needs the API key (x-api-key). Full guide: docs/listing-api.md.
 */
@Controller('listing-api')
@UseGuards(ApiKeyGuard)
export class ListingApiController {
  constructor(private readonly api: ListingApiService) {}

  @Get('health')
  async health() {
    return { ok: true, scope: 'listings', status: 'authenticated', version: 2, owner: await this.api.ownerId().catch(() => null) };
  }

  /** Everything a workflow needs to fill a listing: types, units, statuses, cities. */
  @Get('reference')
  async reference() {
    return {
      listingTypes: ['sale', 'rent'],
      propertyTypes: this.api.getPropertyTypes(),
      sizeUnits: SIZE_UNITS,
      statuses: ['auto', 'approved', 'pending', 'draft'],
      availability: ['available', 'sold', 'rented'],
      cities: await this.api.listCities(),
    };
  }

  @Get('property-types')
  getPropertyTypes() {
    return { types: this.api.getPropertyTypes() };
  }

  @Get('cities')
  async listCities() {
    return { cities: await this.api.listCities() };
  }

  /** ?cityId= or ?cityName=, and optionally ?q=words to filter. */
  @Get('areas')
  async listAreas(@Query('cityId') cityId?: string, @Query('cityName') cityName?: string, @Query('q') q?: string, @Query('limit') limit?: string) {
    return { areas: await this.api.listAreas({ cityId, cityName, q, limit: Number(limit) || undefined }) };
  }

  /** Where cityName + areaName (or societyName + subArea) would land — nothing is saved. */
  @Post('areas/resolve')
  @HttpCode(200)
  async resolveArea(@Body() dto: CreateListingDto) {
    return this.api.previewArea(dto);
  }

  /** Images in (field `file` or `files`), URLs out. */
  @Post('uploads')
  @UseInterceptors(AnyFilesInterceptor())
  async upload(@Req() req: any) {
    const files = ((req.files as Express.Multer.File[]) ?? []).filter((f) => f.fieldname === 'file' || f.fieldname === 'files');
    if (!files.length) throw new BadRequestException('No file uploaded. Use multipart/form-data with field `file` (one) or `files` (several).');
    const done = await this.api.uploadFiles(files);
    return done.length === 1 ? done[0] : { files: done };
  }

  /** Add a listing (JSON with photo URLs, or multipart with mainPhoto / additionalPhotos files). */
  @Post('listings')
  @UseInterceptors(AnyFilesInterceptor())
  async create(@Req() req: any, @Body() dto: CreateListingDto) {
    return this.api.create(dto, await this.files(req));
  }

  /** ?externalId= — find what an earlier run added. */
  @Get('listings')
  async findByExternal(@Query('externalId') externalId?: string) {
    if (!externalId) throw new BadRequestException('Pass ?externalId=');
    return this.api.get(`ext:${externalId}`);
  }

  /** :id = the listing id, its slug, or ext:<your externalId>. */
  @Get('listings/:id')
  async get(@Param('id') id: string) {
    return this.api.get(id);
  }

  /** Change any fields (only what you send); photos sent replace the gallery. */
  @Patch('listings/:id')
  @UseInterceptors(AnyFilesInterceptor())
  async update(@Param('id') id: string, @Req() req: any, @Body() dto: CreateListingDto) {
    return this.api.update(id, dto, await this.files(req));
  }

  /** { "availability": "sold" | "rented" | "available" } */
  @Patch('listings/:id/availability')
  async availability(@Param('id') id: string, @Body('availability') availability?: string) {
    if (!['available', 'sold', 'rented'].includes(String(availability))) throw new BadRequestException('availability must be available, sold or rented');
    return this.api.setAvailability(id, availability as 'available' | 'sold' | 'rented');
  }

  /** Photos uploaded with the request (mainPhoto first, then additionalPhotos), as URLs. */
  private async files(req: any): Promise<string[]> {
    const files = (req.files as Express.Multer.File[]) ?? [];
    const main = files.filter((f) => f.fieldname === 'mainPhoto');
    const more = files.filter((f) => f.fieldname === 'additionalPhotos');
    return (await this.api.uploadFiles([...main, ...more])).map((f) => f.url);
  }
}

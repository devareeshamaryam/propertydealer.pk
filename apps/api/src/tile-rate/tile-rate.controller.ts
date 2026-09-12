import {
  Controller, Get, Post, Put, Delete,
  Param, Query, Request, BadRequestException,
  HttpCode, HttpStatus,
  UseGuards, UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { TileRateService } from './tile-rate.service';
import { CreateTileRateDto, UpdateTileRateDto } from './dto';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { StorageService } from '@rent-ghar/storage/storage.service';
import { ConfigService } from '@nestjs/config';
import { MaterialRateService } from '../material-rate/material-rate.service';

@Controller('tile-rate')
export class TileRateController {
  constructor(
    private readonly tileRateService: TileRateService,
    private readonly storageService: StorageService,
    private readonly materialRates: MaterialRateService,
    private readonly config: ConfigService,
  ) {}


  /**
   * Consolidation switch.
   *
   * The unified `materialrates` collection duplicates this module's schema
   * exactly, plus a `materialType` field. Once the data has been copied over
   * (`npm run migrate:material-rates --workspace=apps/api -- --apply`),
   * setting MATERIAL_RATES_UNIFIED=true makes the public reads below serve
   * from that one collection, so the seven per-material modules can be retired
   * without changing a single public URL. Unset, behaviour is unchanged.
   */
  private get useUnified(): boolean {
    return (
      (this.config.get<string>('MATERIAL_RATES_UNIFIED') ?? '').toLowerCase() === 'true'
    );
  }

  @Get()
  async findAll(
    @Query('city') city?: string,
    @Query('category') category?: string,
  ) {
    if (this.useUnified) {
      return this.materialRates.findAll(city, 'Tile', category);
    }
    return this.tileRateService.findAll(city, category);
  }

  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string) {
    if (this.useUnified) {
      // migrate-material-rates.ts prefixes slugs with the material name.
      return this.materialRates.findBySlug(`tile-${slug}`);
    }
    return this.tileRateService.findBySlug(slug);
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async findAllAdmin() {
    return this.tileRateService.findAllAdmin();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async findOne(@Param('id') id: string) {
    return this.tileRateService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @UseInterceptors(AnyFilesInterceptor())
  @HttpCode(HttpStatus.CREATED)
  async create(@Request() req) {
    try {
      console.log('📝 Creating tile rate...');
      const files: any[] = req.files ?? [];
      const body = req.body;

      if (!body.brand) throw new BadRequestException('Brand is required');
      if (!body.price) throw new BadRequestException('Price is required');
      if (!body.city) throw new BadRequestException('City is required');

      let imageUrl: string | undefined;
      const imageFile = files.find(f => f.fieldname === 'image');
      if (imageFile) {
        const key = await this.storageService.upload(imageFile, 'tile-rates');
        imageUrl = this.storageService.getUrl(key);
      }

      const extraFiles = files.filter(f => f.fieldname === 'images' || f.fieldname === 'images[]');
      const extraUrls: string[] = [];
      for (const file of extraFiles) {
        const key = await this.storageService.upload(file, 'tile-rates');
        extraUrls.push(this.storageService.getUrl(key));
      }

      const dto: CreateTileRateDto = {
        brand:       body.brand,
        price:       Number(body.price),
        change:      body.change ? Number(body.change) : 0,
        city:        body.city,
        unit:        body.unit || 'Per Sq Ft',
        category:    body.category || undefined,
        title:       body.title || undefined,
        description: body.description || undefined,
        isActive:    body.isActive !== undefined ? body.isActive === 'true' || body.isActive === true : true,
        ...(imageUrl             ? { image: imageUrl }    : {}),
        ...(extraUrls.length > 0 ? { images: extraUrls } : {}),
      };

      const result = await this.tileRateService.create(dto);
      console.log('✅ Tile rate created:', result._id);
      return result;
    } catch (error) {
      console.error('❌ Error creating tile rate:', error);
      throw error;
    }
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @UseInterceptors(AnyFilesInterceptor())
  async update(@Param('id') id: string, @Request() req) {
    try {
      const files: any[] = req.files ?? [];
      const body = req.body;

      let imageUrl: string | undefined;
      const imageFile = files.find(f => f.fieldname === 'image');
      if (imageFile) {
        const key = await this.storageService.upload(imageFile, 'tile-rates');
        imageUrl = this.storageService.getUrl(key);
      }

      const extraFiles = files.filter(f => f.fieldname === 'images' || f.fieldname === 'images[]');
      const newExtraUrls: string[] = [];
      for (const file of extraFiles) {
        const key = await this.storageService.upload(file, 'tile-rates');
        newExtraUrls.push(this.storageService.getUrl(key));
      }

      let keptImages: string[] = [];
      if (body.existingImages) {
        keptImages = Array.isArray(body.existingImages)
          ? body.existingImages
          : [body.existingImages];
      }

      const mergedImages = [...keptImages, ...newExtraUrls];

      const dto: UpdateTileRateDto = {
        ...(body.brand       ? { brand: body.brand }               : {}),
        ...(body.price       ? { price: Number(body.price) }       : {}),
        ...(body.change !== undefined ? { change: Number(body.change) } : {}),
        ...(body.city        ? { city: body.city }                 : {}),
        ...(body.unit        ? { unit: body.unit }                 : {}),
        ...(body.category    ? { category: body.category }         : {}),
        ...(body.title       ? { title: body.title }               : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive === 'true' || body.isActive === true } : {}),
        ...(imageUrl         ? { image: imageUrl }                 : {}),
        images: mergedImages,
      };

      return this.tileRateService.update(id, dto);
    } catch (error) {
      console.error('❌ Error updating tile rate:', error);
      throw error;
    }
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    return this.tileRateService.remove(id);
  }
}

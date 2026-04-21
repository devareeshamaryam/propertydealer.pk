import {
  Controller, Get, Post, Put, Delete,
  Param, Query, Request, BadRequestException,
  HttpCode, HttpStatus,
  UseGuards, UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { BajriRateService } from './bajri-rate.service';
import { CreateBajriRateDto, UpdateBajriRateDto } from './dto';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { StorageService } from '@rent-ghar/storage/storage.service';

@Controller('bajri-rate')
export class BajriRateController {
  constructor(
    private readonly bajriRateService: BajriRateService,
    private readonly storageService: StorageService,
  ) {}

  @Get()
  async findAll(
    @Query('city') city?: string,
    @Query('category') category?: string,
  ) {
    return this.bajriRateService.findAll(city, category);
  }

  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string) {
    return this.bajriRateService.findBySlug(slug);
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async findAllAdmin() {
    return this.bajriRateService.findAllAdmin();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async findOne(@Param('id') id: string) {
    return this.bajriRateService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @UseInterceptors(AnyFilesInterceptor())
  @HttpCode(HttpStatus.CREATED)
  async create(@Request() req) {
    try {
      console.log('📝 Creating bajri rate...');
      const files: any[] = req.files ?? [];
      const body = req.body;

      if (!body.brand) throw new BadRequestException('Brand is required');
      if (!body.price) throw new BadRequestException('Price is required');
      if (!body.city) throw new BadRequestException('City is required');

      let imageUrl: string | undefined;
      const imageFile = files.find(f => f.fieldname === 'image');
      if (imageFile) {
        const key = await this.storageService.upload(imageFile, 'bajri-rates');
        imageUrl = this.storageService.getUrl(key);
      }

      const extraFiles = files.filter(f => f.fieldname === 'images' || f.fieldname === 'images[]');
      const extraUrls: string[] = [];
      for (const file of extraFiles) {
        const key = await this.storageService.upload(file, 'bajri-rates');
        extraUrls.push(this.storageService.getUrl(key));
      }

      const dto: CreateBajriRateDto = {
        brand:       body.brand,
        price:       Number(body.price),
        change:      body.change ? Number(body.change) : 0,
        city:        body.city,
        unit:        body.unit || 'Per Cubic Foot',
        category:    body.category || undefined,
        title:       body.title || undefined,
        description: body.description || undefined,
        isActive:    body.isActive !== undefined ? body.isActive === 'true' || body.isActive === true : true,
        ...(imageUrl             ? { image: imageUrl }    : {}),
        ...(extraUrls.length > 0 ? { images: extraUrls } : {}),
      };

      const result = await this.bajriRateService.create(dto);
      console.log('✅ Bajri rate created:', result._id);
      return result;
    } catch (error) {
      console.error('❌ Error creating bajri rate:', error);
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
        const key = await this.storageService.upload(imageFile, 'bajri-rates');
        imageUrl = this.storageService.getUrl(key);
      }

      const extraFiles = files.filter(f => f.fieldname === 'images' || f.fieldname === 'images[]');
      const newExtraUrls: string[] = [];
      for (const file of extraFiles) {
        const key = await this.storageService.upload(file, 'bajri-rates');
        newExtraUrls.push(this.storageService.getUrl(key));
      }

      let keptImages: string[] = [];
      if (body.existingImages) {
        keptImages = Array.isArray(body.existingImages)
          ? body.existingImages
          : [body.existingImages];
      }

      const mergedImages = [...keptImages, ...newExtraUrls];

      const dto: UpdateBajriRateDto = {
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

      return this.bajriRateService.update(id, dto);
    } catch (error) {
      console.error('❌ Error updating bajri rate:', error);
      throw error;
    }
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    return this.bajriRateService.remove(id);
  }
}

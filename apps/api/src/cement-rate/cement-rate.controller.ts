import {
  Controller, Get, Post, Put, Delete,
  Param, Query, Request, BadRequestException,
  HttpCode, HttpStatus,
  UseGuards, UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { CementRateService } from './cement-rate.service';
import { CreateCementRateDto, UpdateCementRateDto } from './dto';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { StorageService } from '@rent-ghar/storage/storage.service';

@Controller('cement-rate')
export class CementRateController {
  constructor(
    private readonly cementRateService: CementRateService,
    private readonly storageService: StorageService,
  ) {}

  // ── Public ──────────────────────────────────────────────────────────────
  @Get()
  async findAll(
    @Query('category') category?: string,
  ) {
    return this.cementRateService.findAll(category);
  }

  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string) {
    return this.cementRateService.findBySlug(slug);
  }

  // ── Admin ───────────────────────────────────────────────────────────────
  @Get('admin/all')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async findAllAdmin() {
    return this.cementRateService.findAllAdmin();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async findOne(@Param('id') id: string) {
    return this.cementRateService.findById(id);
  }

  // ── Create ──────────────────────────────────────────────────────────────
  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @UseInterceptors(AnyFilesInterceptor())
  @HttpCode(HttpStatus.CREATED)
  async create(@Request() req) {
    try {
      console.log('📝 Creating cement rate...');
      const files: any[] = req.files ?? [];
      const body = req.body;
      
      console.log('📦 Request body:', body);
      console.log('📁 Files received:', files.length);

      // Validate required fields
      if (!body.brand) {
        throw new BadRequestException('Brand is required');
      }
      if (!body.price) {
        throw new BadRequestException('Price is required');
      }

      let imageUrl: string | undefined;
      const imageFile = files.find(f => f.fieldname === 'image');
      if (imageFile) {
        console.log('📸 Uploading main image...');
        const key = await this.storageService.upload(imageFile, 'cement-rates');
        imageUrl = this.storageService.getUrl(key);
        console.log('✅ Main image uploaded:', imageUrl);
      }

      const extraFiles = files.filter(f => f.fieldname === 'images' || f.fieldname === 'images[]');
      const extraUrls: string[] = [];
      for (const file of extraFiles) {
        console.log('📸 Uploading additional image...');
        const key = await this.storageService.upload(file, 'cement-rates');
        extraUrls.push(this.storageService.getUrl(key));
      }
      console.log(`✅ Uploaded ${extraUrls.length} additional images`);

      const dto: CreateCementRateDto = {
        brand:       body.brand,
        price:       Number(body.price),
        change:      body.change ? Number(body.change) : 0,
        weightKg:    body.weightKg ? Number(body.weightKg) : 50,
        category:    body.category ?? 'OPC Cement',
        title:       body.title || undefined,
        description: body.description || undefined,
        isActive:    body.isActive !== undefined ? body.isActive === 'true' || body.isActive === true : true,
        ...(imageUrl             ? { image: imageUrl }    : {}),
        ...(extraUrls.length > 0 ? { images: extraUrls } : {}),
      };

      console.log('💾 Saving cement rate to database...');
      const result = await this.cementRateService.create(dto);
      console.log('✅ Cement rate created successfully:', result._id);
      return result;
    } catch (error) {
      console.error('❌ Error creating cement rate:', error);
      throw error;
    }
  }

  // ── Update ──────────────────────────────────────────────────────────────
  @Put(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @UseInterceptors(AnyFilesInterceptor())
  async update(@Param('id') id: string, @Request() req) {
    try {
      console.log(`📝 Updating cement rate ${id}...`);
      const files: any[] = req.files ?? [];
      const body = req.body;

      let imageUrl: string | undefined;
      const imageFile = files.find(f => f.fieldname === 'image');
      if (imageFile) {
        console.log('📸 Uploading new main image...');
        const key = await this.storageService.upload(imageFile, 'cement-rates');
        imageUrl = this.storageService.getUrl(key);
      }

      const extraFiles = files.filter(f => f.fieldname === 'images' || f.fieldname === 'images[]');
      const newExtraUrls: string[] = [];
      for (const file of extraFiles) {
        const key = await this.storageService.upload(file, 'cement-rates');
        newExtraUrls.push(this.storageService.getUrl(key));
      }

      let keptImages: string[] = [];
      if (body.existingImages) {
        keptImages = Array.isArray(body.existingImages)
          ? body.existingImages
          : [body.existingImages];
      }

      const mergedImages = [...keptImages, ...newExtraUrls];

      const dto: UpdateCementRateDto = {
        ...(body.brand       ? { brand: body.brand }               : {}),
        ...(body.price       ? { price: Number(body.price) }       : {}),
        ...(body.change !== undefined ? { change: Number(body.change) } : {}),
        ...(body.weightKg    ? { weightKg: Number(body.weightKg) } : {}),
        ...(body.category    ? { category: body.category }         : {}),
        ...(body.title       ? { title: body.title }               : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.isActive    !== undefined ? { isActive: body.isActive === 'true' || body.isActive === true } : {}),
        ...(imageUrl         ? { image: imageUrl }                 : {}),
        images: mergedImages,
      };

      console.log('💾 Updating cement rate in database...');
      const result = await this.cementRateService.update(id, dto);
      console.log('✅ Cement rate updated successfully');
      return result;
    } catch (error) {
      console.error('❌ Error updating cement rate:', error);
      throw error;
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────
  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    return this.cementRateService.remove(id);
  }
}

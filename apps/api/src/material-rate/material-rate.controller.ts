import {
  Controller, Get, Post, Put, Delete,
  Param, Query, Request, BadRequestException,
  HttpCode, HttpStatus,
  UseGuards, UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { MaterialRateService } from './material-rate.service';
import { CreateMaterialRateDto, UpdateMaterialRateDto } from './dto';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { StorageService } from '@rent-ghar/storage/storage.service';

@Controller('material-rate')
export class MaterialRateController {
  constructor(
    private readonly materialRateService: MaterialRateService,
    private readonly storageService: StorageService,
  ) {}

  // ── Public ──────────────────────────────────────────────────────────────
  @Get()
  async findAll(
    @Query('city') city?: string,
    @Query('materialType') materialType?: string,
    @Query('category') category?: string,
  ) {
    return this.materialRateService.findAll(city, materialType, category);
  }

  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string) {
    return this.materialRateService.findBySlug(slug);
  }

  // ── Admin ───────────────────────────────────────────────────────────────
  @Get('admin/all')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async findAllAdmin(@Query('materialType') materialType?: string) {
    return this.materialRateService.findAllAdmin(materialType);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async findOne(@Param('id') id: string) {
    return this.materialRateService.findById(id);
  }

  // ── Create ──────────────────────────────────────────────────────────────
  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @UseInterceptors(AnyFilesInterceptor())
  @HttpCode(HttpStatus.CREATED)
  async create(@Request() req) {
    try {
      console.log('📝 Creating material rate...');
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
      if (!body.city) {
        throw new BadRequestException('City is required');
      }
      if (!body.materialType) {
        throw new BadRequestException('Material type is required');
      }

      let imageUrl: string | undefined;
      const imageFile = files.find(f => f.fieldname === 'image');
      if (imageFile) {
        console.log('📸 Uploading main image...');
        const key = await this.storageService.upload(imageFile, 'material-rates');
        imageUrl = this.storageService.getUrl(key);
        console.log('✅ Main image uploaded:', imageUrl);
      }

      const extraFiles = files.filter(f => f.fieldname === 'images' || f.fieldname === 'images[]');
      const extraUrls: string[] = [];
      for (const file of extraFiles) {
        console.log('📸 Uploading additional image...');
        const key = await this.storageService.upload(file, 'material-rates');
        extraUrls.push(this.storageService.getUrl(key));
      }
      console.log(`✅ Uploaded ${extraUrls.length} additional images`);

      const dto: CreateMaterialRateDto = {
        brand:        body.brand,
        price:        Number(body.price),
        change:       body.change ? Number(body.change) : 0,
        city:         body.city,
        unit:         body.unit || 'Per Unit',
        materialType: body.materialType,
        category:     body.category || undefined,
        title:        body.title || undefined,
        description:  body.description || undefined,
        isActive:     body.isActive !== undefined ? body.isActive === 'true' || body.isActive === true : true,
        ...(imageUrl             ? { image: imageUrl }    : {}),
        ...(extraUrls.length > 0 ? { images: extraUrls } : {}),
      };

      console.log('💾 Saving material rate to database...');
      const result = await this.materialRateService.create(dto);
      console.log('✅ Material rate created successfully:', result._id);
      return result;
    } catch (error) {
      console.error('❌ Error creating material rate:', error);
      throw error;
    }
  }

  // ── Update ──────────────────────────────────────────────────────────────
  @Put(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @UseInterceptors(AnyFilesInterceptor())
  async update(@Param('id') id: string, @Request() req) {
    try {
      console.log(`📝 Updating material rate ${id}...`);
      const files: any[] = req.files ?? [];
      const body = req.body;

      let imageUrl: string | undefined;
      const imageFile = files.find(f => f.fieldname === 'image');
      if (imageFile) {
        console.log('📸 Uploading new main image...');
        const key = await this.storageService.upload(imageFile, 'material-rates');
        imageUrl = this.storageService.getUrl(key);
      }

      const extraFiles = files.filter(f => f.fieldname === 'images' || f.fieldname === 'images[]');
      const newExtraUrls: string[] = [];
      for (const file of extraFiles) {
        const key = await this.storageService.upload(file, 'material-rates');
        newExtraUrls.push(this.storageService.getUrl(key));
      }

      let keptImages: string[] = [];
      if (body.existingImages) {
        keptImages = Array.isArray(body.existingImages)
          ? body.existingImages
          : [body.existingImages];
      }

      const mergedImages = [...keptImages, ...newExtraUrls];

      const dto: UpdateMaterialRateDto = {
        ...(body.brand        ? { brand: body.brand }                 : {}),
        ...(body.price        ? { price: Number(body.price) }         : {}),
        ...(body.change !== undefined ? { change: Number(body.change) } : {}),
        ...(body.city         ? { city: body.city }                   : {}),
        ...(body.unit         ? { unit: body.unit }                   : {}),
        ...(body.materialType ? { materialType: body.materialType }   : {}),
        ...(body.category     ? { category: body.category }           : {}),
        ...(body.title        ? { title: body.title }                 : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive === 'true' || body.isActive === true } : {}),
        ...(imageUrl          ? { image: imageUrl }                   : {}),
        images: mergedImages,
      };

      console.log('💾 Updating material rate in database...');
      const result = await this.materialRateService.update(id, dto);
      console.log('✅ Material rate updated successfully');
      return result;
    } catch (error) {
      console.error('❌ Error updating material rate:', error);
      throw error;
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────
  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    return this.materialRateService.remove(id);
  }
}

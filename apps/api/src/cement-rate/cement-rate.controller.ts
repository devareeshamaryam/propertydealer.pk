 import {
  Controller, Get, Post, Put, Delete,
  Param, Query, Request,
  HttpCode, HttpStatus,
  UseGuards, UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { CementRateService } from './cement-rate.service';
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
    @Query('city') city?: string,
    @Query('category') category?: string,
  ) {
    return this.cementRateService.findAll(city, category);
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
    const files: any[] = req.files ?? [];  // ✅ any[] instead of Express.Multer.File[]
    const body = req.body;

    let imageUrl: string | undefined;
    const imageFile = files.find(f => f.fieldname === 'image');
    if (imageFile) {
      const key = await this.storageService.upload(imageFile, 'cement-rates');
      imageUrl = this.storageService.getUrl(key);
    }

    const extraFiles = files.filter(f => f.fieldname === 'images' || f.fieldname === 'images[]');
    const extraUrls: string[] = [];
    for (const file of extraFiles) {
      const key = await this.storageService.upload(file, 'cement-rates');
      extraUrls.push(this.storageService.getUrl(key));
    }

    const dto: any = {
      brand:       body.brand,
      price:       Number(body.price),
      change:      body.change ? Number(body.change) : 0,
      city:        body.city,
      weightKg:    body.weightKg ? Number(body.weightKg) : 50,
      category:    body.category ?? 'OPC Cement',
      title:       body.title || undefined,
      description: body.description || undefined,
      isActive:    body.isActive !== undefined ? body.isActive === 'true' || body.isActive === true : true,
      ...(imageUrl             ? { image: imageUrl }    : {}),
      ...(extraUrls.length > 0 ? { images: extraUrls } : {}),
    };

    return this.cementRateService.create(dto);
  }

  // ── Update ──────────────────────────────────────────────────────────────
  @Put(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @UseInterceptors(AnyFilesInterceptor())
  async update(@Param('id') id: string, @Request() req) {
    const files: any[] = req.files ?? [];  // ✅ any[] instead of Express.Multer.File[]
    const body = req.body;

    let imageUrl: string | undefined;
    const imageFile = files.find(f => f.fieldname === 'image');
    if (imageFile) {
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

    const dto: any = {
      ...(body.brand       ? { brand: body.brand }               : {}),
      ...(body.price       ? { price: Number(body.price) }       : {}),
      ...(body.change !== undefined ? { change: Number(body.change) } : {}),
      ...(body.city        ? { city: body.city }                 : {}),
      ...(body.weightKg    ? { weightKg: Number(body.weightKg) } : {}),
      ...(body.category    ? { category: body.category }         : {}),
      ...(body.title       ? { title: body.title }               : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.isActive    !== undefined ? { isActive: body.isActive === 'true' || body.isActive === true } : {}),
      ...(imageUrl         ? { image: imageUrl }                 : {}),
      images: mergedImages,
    };

    return this.cementRateService.update(id, dto);
  }

  // ── Delete ──────────────────────────────────────────────────────────────
  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    return this.cementRateService.remove(id);
  }
}
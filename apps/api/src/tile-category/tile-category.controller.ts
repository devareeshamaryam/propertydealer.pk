 import {
  Controller, Get, Post, Put, Delete,
  Param, Body, UseGuards, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TileCategoryService } from './tile-category.service';
import { CreateTileCategoryDto, UpdateTileCategoryDto } from './dto';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('tile-category')
export class TileCategoryController {
  constructor(private readonly tileCategoryService: TileCategoryService) {}

  // ── Public ───────────────────────────────────────────────────────
  @Get()
  findAll() {
    return this.tileCategoryService.findAll();
  }

  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.tileCategoryService.findBySlug(slug);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.tileCategoryService.findById(id);
  }

  // ── Admin ────────────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/all')
  findAllAdmin() {
    return this.tileCategoryService.findAllAdmin();
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post()
  @UseInterceptors(FileInterceptor('image'))
  create(
    @Body() body: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const parseSubcategories = (value: unknown) => {
      if (Array.isArray(value)) return value;
      if (typeof value === 'string' && value.trim()) {
        try {
          return JSON.parse(value);
        } catch {
          return [];
        }
      }
      return undefined;
    };
    const dto: CreateTileCategoryDto = {
      name: body.name,
      slug: body.slug || undefined,
      // The dashboard uploads through the media library and sends a URL; the
      // file path is kept for any older client still posting multipart.
      image: typeof body.image === 'string' && body.image.trim() ? body.image.trim() : undefined,
      order: body.order ? Number(body.order) : 0,
      isActive: body.isActive === 'true' || body.isActive === true,
      subcategories: parseSubcategories(body.subcategories) ?? [],
    };
    return this.tileCategoryService.create(dto, file);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Put(':id')
  @UseInterceptors(FileInterceptor('image'))
  update(
    @Param('id') id: string,
    @Body() body: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const parseSubcategories = (value: unknown) => {
      if (Array.isArray(value)) return value;
      if (typeof value === 'string' && value.trim()) {
        try {
          return JSON.parse(value);
        } catch {
          return [];
        }
      }
      return undefined;
    };
    const dto: UpdateTileCategoryDto = {
      name: body.name,
      slug: body.slug || undefined,
      image: typeof body.image === 'string' ? body.image.trim() : undefined,
      order: body.order ? Number(body.order) : undefined,
      isActive: body.isActive === 'true' || body.isActive === true,
      subcategories: parseSubcategories(body.subcategories),
    };
    return this.tileCategoryService.update(id, dto, file);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tileCategoryService.remove(id);
  }
}
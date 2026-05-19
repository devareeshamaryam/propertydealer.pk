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
    const dto: CreateTileCategoryDto = {
      name: body.name,
      slug: body.slug || undefined,
      order: body.order ? Number(body.order) : 0,
      isActive: body.isActive === 'true' || body.isActive === true,
      subcategories: body.subcategories
        ? JSON.parse(body.subcategories)
        : [],
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
    const dto: UpdateTileCategoryDto = {
      name: body.name,
      slug: body.slug || undefined,
      order: body.order ? Number(body.order) : undefined,
      isActive: body.isActive === 'true' || body.isActive === true,
      subcategories: body.subcategories
        ? JSON.parse(body.subcategories)
        : undefined,
    };
    return this.tileCategoryService.update(id, dto, file);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tileCategoryService.remove(id);
  }
}
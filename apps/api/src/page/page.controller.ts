import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Delete,
  Put,
  NotFoundException,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { PageService } from './page.service';
import { CreatePageDto } from '@rent-ghar/dtos/page/createpage.dto';
import { UpdatePageDto } from '@rent-ghar/dtos/page/updatepage.dto';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

/**
 * 🔒 SECURITY: this controller had no guards at all.
 *
 * `POST /page`, `PUT /page/:id` and `DELETE /page/:id` were reachable by
 * anyone on the internet with no token — so an unauthenticated caller could
 * create, rewrite or delete any static SEO page on propertydealer.pk. The
 * admin listing (`GET /page`) was open too, exposing unpublished drafts.
 *
 * Reads that the public site needs (`/page/published`, `/page/slug/:slug`)
 * stay open; everything else now requires an admin token.
 */
@Controller('page')
export class PageController {
  constructor(private readonly pageService: PageService) {}

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async createPage(@Body() createPageDto: CreatePageDto) {
    try {
      return await this.pageService.create(createPageDto);
    } catch (error: any) {
      if (error.code === 11000) {
        // Duplicate key error (likely duplicate slug)
        throw new BadRequestException(
          'A page with this slug already exists. Please use a different title.',
        );
      }
      throw error;
    }
  }

  /** Admin listing — includes drafts, so it must not be public. */
  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  getAllPages() {
    return this.pageService.getAll();
  }

  // Public: the website's own navigation and sitemap read this.
  @Get('published')
  getPublishedPages() {
    return this.pageService.getPublished();
  }

  // Public: resolves a page for rendering. Declared before ':id' would be
  // ambiguous, so keep 'slug/:slug' above the bare ':id' route.
  @Get('slug/:slug')
  async getPageBySlug(@Param('slug') slug: string) {
    const page = await this.pageService.getBySlug(slug);
    if (!page) {
      throw new NotFoundException(`Page with slug ${slug} not found`);
    }
    return page;
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getPageById(@Param('id') id: string) {
    const page = await this.pageService.getById(id);
    if (!page) {
      throw new NotFoundException(`Page with ID ${id} not found`);
    }
    return page;
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  updatePage(@Param('id') id: string, @Body() updatePageDto: UpdatePageDto) {
    return this.pageService.update(id, updatePageDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  deletePage(@Param('id') id: string) {
    return this.pageService.delete(id);
  }
}

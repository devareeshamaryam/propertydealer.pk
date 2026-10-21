/* eslint-disable prettier/prettier */
import { Body, Controller, Get, Header, NotFoundException, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { SocietyService } from './society.service';

/** Housing societies: the public guide pages and their management (see SocietyService). */
@Controller('societies')
export class SocietyController {
  constructor(private readonly societies: SocietyService) {}

  /** Published societies, of one city (?city=<slug>) or all. */
  @Get()
  @Header('Cache-Control', 'public, max-age=120, s-maxage=600')
  list(@Query('city') city?: string) {
    return this.societies.listSocieties(city || undefined);
  }

  /** On a listing page: the society this area is (or belongs to), with its phases. */
  @Get('for-area')
  @Header('Cache-Control', 'public, max-age=120, s-maxage=600')
  forArea(@Query('city') city: string, @Query('area') area: string) {
    if (!city || !area) return null;
    return this.societies.guideFor(city, area);
  }

  @Get('page/:city/:slug')
  @Header('Cache-Control', 'public, max-age=120, s-maxage=600')
  async page(@Param('city') city: string, @Param('slug') slug: string) {
    const page = await this.societies.societyPage(city, slug);
    if (!page) throw new NotFoundException('Society not found');
    return page;
  }

  // ── Dashboard ──

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, AdminGuard)
  adminList() {
    return this.societies.adminList();
  }

  /** The guide as it will look, before it is published. */
  @Get('admin/preview/:city/:slug')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async preview(@Param('city') city: string, @Param('slug') slug: string) {
    const page = await this.societies.societyPage(city, slug, true);
    if (!page) throw new NotFoundException('Society not found');
    return page;
  }

  @Get('admin/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  adminGet(@Param('id') id: string) {
    return this.societies.adminGet(id);
  }

  @Put('admin/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  save(@Param('id') id: string, @Body() body: any) {
    return this.societies.save(id, body ?? {});
  }

  @Post('admin/:id/phases')
  @UseGuards(JwtAuthGuard, AdminGuard)
  addPhase(@Param('id') id: string, @Body('name') name: string) {
    return this.societies.addPhase(id, name);
  }
}

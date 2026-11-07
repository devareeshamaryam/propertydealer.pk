import { Body, Controller, Delete, Get, Header, Param, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ToolPagesService } from './tool-pages.service';

/** The admin's SEO and text for each tool page. */
@Controller('tools/pages')
export class ToolPagesController {
  constructor(private readonly pages: ToolPagesService) {}

  /** Every tool page's saved text, by slug. */
  @Get()
  @Header('Cache-Control', 'public, max-age=60, s-maxage=120')
  all() {
    return this.pages.all();
  }

  @Get(':slug')
  @Header('Cache-Control', 'public, max-age=60, s-maxage=120')
  one(@Param('slug') slug: string) {
    return this.pages.one(slug);
  }

  @Put(':slug')
  @UseGuards(JwtAuthGuard, AdminGuard)
  save(@Param('slug') slug: string, @Body() body: unknown) {
    return this.pages.save(slug, body ?? {});
  }

  /** Back to the page's built-in text. */
  @Delete(':slug')
  @UseGuards(JwtAuthGuard, AdminGuard)
  reset(@Param('slug') slug: string) {
    return this.pages.reset(slug);
  }
}

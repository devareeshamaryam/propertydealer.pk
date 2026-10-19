import { Body, Controller, Delete, Get, Header, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { MaterialTypeService, type MaterialTypeInput } from './material-type.service';

/** Materials added from the dashboard: public list and page data, admin CRUD. */
@Controller('material-types')
export class MaterialTypeController {
  constructor(private readonly types: MaterialTypeService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=120, s-maxage=600')
  async list() {
    return { success: true, data: await this.types.listPublic() };
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async listAdmin() {
    return { success: true, data: await this.types.listAdmin() };
  }

  @Get('slug/:slug')
  @Header('Cache-Control', 'public, max-age=60, s-maxage=300')
  async get(@Param('slug') slug: string) {
    return { success: true, data: await this.types.getPublic(slug) };
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async create(@Body() body: MaterialTypeInput) {
    return { success: true, data: await this.types.create(body ?? {}) };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async update(@Param('id') id: string, @Body() body: MaterialTypeInput) {
    return { success: true, data: await this.types.update(id, body ?? {}) };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async remove(@Param('id') id: string) {
    return { success: true, data: await this.types.remove(id) };
  }
}

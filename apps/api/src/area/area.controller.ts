/* eslint-disable prettier/prettier */
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  UsePipes,
  ValidationPipe,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AreaService } from './area.service';
import { CreateAreaDto } from '@rent-ghar/dtos/area/createarea.dto';
import { AreaDocument } from '@rent-ghar/db/schemas/area.schema';
import { UpdateAreaDto } from '@rent-ghar/dtos/area/updatearea.dto';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('areas')
@UsePipes(new ValidationPipe())
export class AreaController {
  constructor(private readonly areaService: AreaService) {}

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async createArea(
    @Body() createAreaDto: CreateAreaDto,
  ): Promise<AreaDocument> {
    return this.areaService.createArea(createAreaDto);
  }

  @Get()
  async findAllAreas(
    @Query('cityId') cityId?: string,
  ): Promise<AreaDocument[]> {
    if (cityId) {
      return this.areaService.findAreasByCity(cityId);
    }
    return this.areaService.findAllAreas();
  }

  /** [{ _id, name, areaSlug, city }] — the light list for dropdowns. ?cityId= narrows it. */
  @Get('names')
  async findAreaNames(@Query('cityId') cityId?: string) {
    return this.areaService.findAreaNames(cityId);
  }

  /** Dashboard: every area with status (merged / hidden) and its listing count. */
  @Get('admin/overview')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async adminOverview() {
    return this.areaService.adminOverview();
  }

  /** Dashboard: fold a duplicate into the area it repeats (listings move, URL keeps working). */
  @Post(':id/merge')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async mergeArea(@Param('id') id: string, @Body('into') into: string) {
    return this.areaService.mergeArea(id, into);
  }

  @Post(':id/unmerge')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async unmergeArea(@Param('id') id: string) {
    return this.areaService.unmergeArea(id);
  }

  @Post(':id/hidden')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async setAreaHidden(@Param('id') id: string, @Body('hidden') hidden: boolean) {
    return this.areaService.setAreaHidden(id, hidden !== false);
  }

  /** Any signed-in agent: the area their listing is in, added if it is missing (no duplicates). */
  @Post('suggest')
  @UseGuards(JwtAuthGuard)
  async suggestArea(@Body('city') city: string, @Body('name') name: string, @Request() req: any) {
    return this.areaService.suggestArea(city, name, req.user?.userId);
  }

  @Get(':id')
  async findAreaById(@Param('id') id: string): Promise<AreaDocument> {
    return this.areaService.findAreaById(id);
  }

  @Get('name/:name')
  async findAreaByName(
    @Param('name') name: string,
    @Query('cityId') cityId?: string,
  ): Promise<AreaDocument> {
    return this.areaService.findAreaByName(name, cityId);
  }

  @Get('slug/:slug')
  async findAreaBySlug(
    @Param('slug') slug: string,
    @Query('cityId') cityId?: string,
  ): Promise<AreaDocument> {
    return this.areaService.findAreaBySlug(slug, cityId);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateArea(
    @Param('id') id: string,
    @Body() updateAreaDto: UpdateAreaDto,
  ): Promise<AreaDocument> {
    return this.areaService.updateArea(id, updateAreaDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async deleteArea(@Param('id') id: string): Promise<void> {
    await this.areaService.deleteArea(id);
  }
}

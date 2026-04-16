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

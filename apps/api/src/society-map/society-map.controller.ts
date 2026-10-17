import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UploadedFiles,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { SocietyMapService } from './society-map.service';
import { SocietyDataService } from './society-data.service';

/** Society maps for visitors: the published ones only. */
@Controller('society-maps')
export class SocietyMapController {
  constructor(
    private readonly maps: SocietyMapService,
    private readonly data: SocietyDataService,
  ) {}

  /** Plot finder: ?city=lahore&map=dha-phase-6&q=L 215 */
  @Get('plots/find')
  @Header('Cache-Control', 'public, max-age=300, s-maxage=3600')
  async findPlots(@Query('city') city: string, @Query('map') map: string | undefined, @Query('q') q: string) {
    if (!city || !q) throw new BadRequestException('city and q are required');
    return { success: true, data: await this.data.findPlots(city, map, q) };
  }

  /** The plot under a tapped point, if the society's GIS has it. */
  @Get('plots/at')
  @Header('Cache-Control', 'public, max-age=300, s-maxage=3600')
  async plotAt(@Query('lat') lat: string, @Query('lng') lng: string) {
    const la = Number(lat);
    const lo = Number(lng);
    if (!(la > 20 && la < 40 && lo > 58 && lo < 80)) throw new BadRequestException('lat and lng inside Pakistan are required');
    return { success: true, data: await this.data.plotAt(la, lo) };
  }

  @Get()
  @Header('Cache-Control', 'public, max-age=120, s-maxage=600')
  async list(@Query('city') city?: string) {
    return { success: true, data: await this.maps.list(city) };
  }

  /** The society plans inside a map box, for drawing on any map. */
  @Get('in-view')
  @Header('Cache-Control', 'public, max-age=120, s-maxage=300')
  async inView(
    @Query('minLat') minLat: string,
    @Query('maxLat') maxLat: string,
    @Query('minLng') minLng: string,
    @Query('maxLng') maxLng: string,
  ) {
    const box = { minLat: Number(minLat), maxLat: Number(maxLat), minLng: Number(minLng), maxLng: Number(maxLng) };
    if (Object.values(box).some((v) => !Number.isFinite(v))) {
      throw new BadRequestException('minLat, maxLat, minLng and maxLng are required');
    }
    return { success: true, data: await this.maps.inView(box) };
  }

  /** Labels for the map: cities, or one city's societies (placed by their real listings). */
  @Get('places')
  @Header('Cache-Control', 'public, max-age=120, s-maxage=600')
  async places(@Query('city') city?: string) {
    return { success: true, data: await this.maps.places(city) };
  }

  /** Is there a map for this area? ?areaId=… or ?city=lahore&area=dha-phase-6 */
  @Get('lookup')
  @Header('Cache-Control', 'public, max-age=120, s-maxage=600')
  async lookup(@Query('areaId') areaId?: string, @Query('city') city?: string, @Query('area') area?: string) {
    return { success: true, data: await this.maps.lookup({ areaId, city, area }) };
  }

  @Get('page/:city/:slug')
  @Header('Cache-Control', 'public, max-age=60, s-maxage=600')
  async page(@Param('city') city: string, @Param('slug') slug: string) {
    const data = await this.maps.getPublic(city, slug);
    if (!data) throw new NotFoundException('Map not found');
    return { success: true, data };
  }
}

/** The dashboard's side: drafts, editing, images and tiling. */
@Controller('admin/society-maps')
@UseGuards(JwtAuthGuard, AdminGuard)
export class SocietyMapAdminController {
  constructor(private readonly maps: SocietyMapService) {}

  @Get()
  async list() {
    return { success: true, data: await this.maps.adminList() };
  }

  @Post()
  async create(@Body() body: { name?: string; city?: string; area?: string; slug?: string }) {
    return { success: true, data: await this.maps.create(body ?? {}) };
  }

  /** Load exported maps (.pdmap.json files), one or many. ?replace=1 overwrites a map at the same address. */
  @Post('import')
  @UseInterceptors(FilesInterceptor('packages', 40, { limits: { fileSize: 120 * 1024 * 1024 } }))
  async importMaps(@UploadedFiles() files: Express.Multer.File[], @Query('replace') replace?: string) {
    if (!files?.length) throw new BadRequestException('Choose one or more map files');
    const results: Record<string, unknown>[] = [];
    for (const f of files) {
      try {
        results.push({ file: f.originalname, ...(await this.maps.importPackage(f.buffer, replace === '1')) });
      } catch (e: any) {
        results.push({ file: f.originalname, error: e?.message ?? 'Import failed' });
      }
    }
    return { success: true, data: results };
  }

  @Get(':id/export')
  async exportMap(@Param('id') id: string, @Res() res: Response) {
    const pkg = await this.maps.exportPackage(id);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${pkg.citySlug}-${pkg.slug}.pdmap.json"`);
    res.send(JSON.stringify(pkg));
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return { success: true, data: await this.maps.adminGet(id) };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return { success: true, data: await this.maps.update(id, body ?? {}) };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return { success: true, data: await this.maps.remove(id) };
  }

  /** multipart: `image` (JPG/PNG/WebP/TIFF, up to 80 MB) and an optional `name`. */
  @Post(':id/layers')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 80 * 1024 * 1024, files: 1 } }))
  async addLayer(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @Body('name') name?: string) {
    return { success: true, data: await this.maps.addLayer(id, file, name) };
  }

  @Delete(':id/layers/:layerId')
  async removeLayer(@Param('id') id: string, @Param('layerId') layerId: string) {
    return { success: true, data: await this.maps.removeLayer(id, layerId) };
  }

  @Post(':id/layers/:layerId/tiles')
  async tile(@Param('id') id: string, @Param('layerId') layerId: string) {
    return { success: true, data: await this.maps.tile(id, layerId) };
  }
}

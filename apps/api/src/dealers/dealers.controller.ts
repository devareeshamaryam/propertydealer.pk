import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import {
  DealersService,
  type DealerPage,
  type DealerSettings,
} from './dealers.service';

/** The property dealers directory: /api/dealers/… */
@Controller('dealers')
export class DealersController {
  constructor(private readonly dealers: DealersService) {}

  /** Every city with its number of agencies and agents. */
  @Get('cities')
  @Header('Cache-Control', 'public, max-age=120, s-maxage=300')
  cities() {
    return this.dealers.cities();
  }

  /** The text of /property-dealers and the default text of a city page. */
  @Get('settings')
  @Header('Cache-Control', 'public, max-age=120, s-maxage=300')
  settings() {
    return this.dealers.settings();
  }

  @Put('settings')
  @UseGuards(JwtAuthGuard, AdminGuard)
  saveSettings(@Body() body: Partial<DealerSettings>) {
    return this.dealers.saveSettings(body ?? {});
  }

  /** One city: its text, agencies, and a page of agents (?page=2). */
  @Get('city/:slug')
  @Header('Cache-Control', 'public, max-age=120, s-maxage=300')
  city(
    @Param('slug') slug: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.dealers.city(slug, Number(page) || 1, Number(limit) || 30);
  }

  @Get('admin/city/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  adminCity(@Param('id') id: string) {
    return this.dealers.adminCity(id);
  }

  @Put('admin/city/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  saveCity(@Param('id') id: string, @Body() body: DealerPage) {
    return this.dealers.saveCityPage(id, body ?? {});
  }
}

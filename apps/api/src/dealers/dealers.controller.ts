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
import { Throttle } from '@nestjs/throttler';
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

  /** Every city's agencies, biggest plans first, with their city. */
  @Get('agencies')
  @Header('Cache-Control', 'public, max-age=120, s-maxage=300')
  agencies(@Query('limit') limit?: string) {
    return this.dealers.agencies(Number(limit) || 24);
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

  /**
   * One dealer's phone and WhatsApp, asked for when someone taps Call or
   * WhatsApp. The lists leave numbers out so they can't be collected in bulk;
   * this gives them one at a time, a few a minute per visitor, never cached.
   */
  @Get('contact/:id')
  @Throttle({ medium: { limit: 12, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  @Header('X-Robots-Tag', 'noindex')
  contact(@Param('id') id: string) {
    return this.dealers.contact(String(id).slice(0, 40));
  }

  /** One city: its text, agencies, and a page of agents (?page=2). */
  @Get('city/:slug')
  @Header('Cache-Control', 'public, max-age=120, s-maxage=300')
  city(
    @Param('slug') slug: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
  ) {
    return this.dealers.city(slug, Number(page) || 1, Number(limit) || 30, q ?? '');
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

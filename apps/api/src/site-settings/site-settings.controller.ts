import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { SiteSettingsService, type SiteSettingsInput } from './site-settings.service';

/**
 * The site's appearance. Public to read — every page needs it, signed in or
 * not — and admin-only to change.
 */
@Controller('site-settings')
export class SiteSettingsController {
  constructor(private readonly settings: SiteSettingsService) {}

  @Get()
  async get() {
    return { success: true, data: await this.settings.get() };
  }

  @Put()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async update(@Body() body: SiteSettingsInput) {
    return { success: true, data: await this.settings.update(body ?? {}) };
  }
}

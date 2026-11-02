import { Body, Controller, Delete, Get, Headers, HttpCode, Ip, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { PropertyRequestService } from './property-request.service';

/** /api/property-requests — the public form posts here; the team reads and updates. */
@Controller('property-requests')
export class PropertyRequestController {
  constructor(private readonly requests: PropertyRequestService) {}

  @Post()
  @HttpCode(200)
  @Throttle({ medium: { limit: 5, ttl: 60_000 } })
  create(@Body() body: any, @Ip() ip: string, @Headers('cf-connecting-ip') cf?: string) {
    return this.requests.create(body ?? {}, { ip: String(cf || ip || '') });
  }

  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  list(@Query('status') status?: string, @Query('page') page?: string, @Query('q') q?: string) {
    return this.requests.list(status || 'new', Number(page) || 1, q || '');
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  update(@Param('id') id: string, @Body() body: any) {
    return this.requests.update(id, body ?? {});
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  remove(@Param('id') id: string) {
    return this.requests.remove(id);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import {
  ConstructionService,
  type ConstructionConfig,
} from './construction.service';

@Controller('tools/construction')
export class ConstructionController {
  constructor(private readonly construction: ConstructionService) {}

  /** Rates and settings for the public construction cost calculator. */
  @Get()
  @Header('Cache-Control', 'public, max-age=120, s-maxage=300')
  get() {
    return this.construction.publicData();
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, AdminGuard)
  admin() {
    return this.construction.adminData();
  }

  @Put('admin')
  @UseGuards(JwtAuthGuard, AdminGuard)
  save(@Body() body: Partial<ConstructionConfig>) {
    return this.construction.save(body ?? {});
  }

  /** Back to automatic everything. */
  @Delete('admin')
  @UseGuards(JwtAuthGuard, AdminGuard)
  reset() {
    return this.construction.reset();
  }
}

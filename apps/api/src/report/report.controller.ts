import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ReportService } from './report.service';

/**
 * Reports.
 *
 * Filing one needs an account — an anonymous report button is a weapon
 * competitors use on each other, and a name on the complaint is also what
 * makes a pattern believable. Reading and resolving them is admin-only.
 */
@Controller('reports')
export class ReportController {
  constructor(private readonly reports: ReportService) {}

  /** The reason list the report dialog shows. Public: it is just labels. */
  @Get('reasons')
  reasons() {
    return { success: true, data: this.reports.reasons() };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  // Enough for a real person with a few genuine complaints, not enough to
  // bury an agent under a hundred of them.
  @Throttle({ default: { limit: 6, ttl: 3600000 } })
  async create(
    @Request() req,
    @Body()
    body: {
      type?: 'listing' | 'agent';
      propertyId?: string;
      agentId?: string;
      reason?: string;
      message?: string;
    },
  ) {
    await this.reports.create(
      {
        type: body?.type === 'agent' ? 'agent' : 'listing',
        propertyId: body?.propertyId,
        agentId: body?.agentId,
        reason: body?.reason ?? '',
        message: body?.message,
      },
      req.user.userId,
    );

    return {
      success: true,
      message: 'Thank you — our team will look into this.',
    };
  }

  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async list(
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.reports.list({
      status,
      type,
      page: Number(page) || 1,
      limit: Number(limit) || 25,
    });
    return { success: true, ...result };
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async stats() {
    return { success: true, data: await this.reports.stats() };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async setStatus(
    @Param('id') id: string,
    @Request() req,
    @Body() body: { status?: 'open' | 'reviewed' | 'dismissed'; adminNote?: string },
  ) {
    const doc = await this.reports.setStatus(
      id,
      body?.status === 'dismissed'
        ? 'dismissed'
        : body?.status === 'open'
          ? 'open'
          : 'reviewed',
      req.user.userId,
      body?.adminNote,
    );
    return { success: true, data: doc };
  }
}

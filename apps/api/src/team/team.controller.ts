import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { TeamService } from './team.service';

/** An agency owner's agent accounts. Every route acts on the caller's own team only. */
@Controller('team')
@UseGuards(JwtAuthGuard)
export class TeamController {
  constructor(private readonly team: TeamService) {}

  private me(req: any): string {
    const id = req.user?.userId;
    if (!id) throw new ForbiddenException('Authentication required');
    return String(id);
  }

  @Get()
  async list(@Request() req) {
    return { success: true, data: await this.team.list(this.me(req)) };
  }

  @Post()
  async create(@Request() req, @Body() body: { name?: string; email?: string; password?: string; phone?: string; listingLimit?: number }) {
    return { success: true, data: await this.team.create(this.me(req), body ?? {}) };
  }

  @Patch(':id')
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { name?: string; phone?: string; email?: string; isActive?: boolean; password?: string; listingLimit?: number | null },
  ) {
    return { success: true, data: await this.team.update(this.me(req), id, body ?? {}) };
  }

  /** One listing of the team to the owner (no `to`) or an agent. */
  @Post('listings/:propertyId/assign')
  async assign(@Request() req, @Param('propertyId') propertyId: string, @Body('to') to?: string) {
    return { success: true, data: await this.team.assignListing(this.me(req), propertyId, to || undefined) };
  }

  /** Move all of an agent's listings to the owner (no `to`) or to another agent. */
  @Post(':id/transfer')
  async transfer(@Request() req, @Param('id') id: string, @Body('to') to?: string) {
    return { success: true, data: await this.team.transfer(this.me(req), id, to || undefined) };
  }

  /** ?to=<agent id> sends their listings to that agent instead of the owner. */
  @Delete(':id')
  async remove(@Request() req, @Param('id') id: string, @Query('to') to?: string) {
    return { success: true, data: await this.team.remove(this.me(req), id, to || undefined) };
  }
}

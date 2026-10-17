import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
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
  async create(@Request() req, @Body() body: { name?: string; email?: string; password?: string; phone?: string }) {
    return { success: true, data: await this.team.create(this.me(req), body ?? {}) };
  }

  @Patch(':id')
  async update(@Request() req, @Param('id') id: string, @Body() body: { name?: string; phone?: string; isActive?: boolean; password?: string }) {
    return { success: true, data: await this.team.update(this.me(req), id, body ?? {}) };
  }

  @Delete(':id')
  async remove(@Request() req, @Param('id') id: string) {
    return { success: true, data: await this.team.remove(this.me(req), id) };
  }
}

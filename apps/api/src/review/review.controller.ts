import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ReviewService, type ReviewInput } from './review.service';

/**
 * Agent reviews.
 *
 * Reading is public. Writing needs an account — anonymous stars are what
 * rival dealers would use on each other — and one account gets one review per
 * agent, which it can edit or delete. The agent can answer each review and
 * ask the admins to look at one; only an admin hides a review.
 */
@Controller()
export class ReviewController {
  constructor(private readonly reviews: ReviewService) {}

  @Get('agents/:id/reviews')
  // Short: a new review should show up within a minute.
  @Header('Cache-Control', 'public, max-age=30, s-maxage=60')
  list(@Param('id') id: string, @Query('page') page?: string) {
    return this.reviews.list(id, Number(page) || 1);
  }

  @Get('agents/:id/reviews/summary')
  @Header('Cache-Control', 'public, max-age=60, s-maxage=300')
  summary(@Param('id') id: string) {
    return this.reviews.summary(id);
  }

  /** Every review including hidden ones, for the admin's moderation buttons. */
  @Get('agents/:id/reviews/all')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Header('Cache-Control', 'no-store')
  all(@Param('id') id: string, @Request() req, @Query('page') page?: string) {
    return this.reviews.list(id, Number(page) || 1, { userId: req.user.userId, role: req.user.role });
  }

  @Get('agents/:id/reviews/mine')
  @UseGuards(JwtAuthGuard)
  @Header('Cache-Control', 'no-store')
  mine(@Param('id') id: string, @Request() req) {
    return this.reviews.mine(id, req.user.userId);
  }

  @Put('agents/:id/reviews/mine')
  @UseGuards(JwtAuthGuard)
  // A real person reviews a handful of dealers, not dozens an hour.
  @Throttle({ default: { limit: 10, ttl: 3600000 } })
  save(@Param('id') id: string, @Request() req, @Body() body: ReviewInput) {
    return this.reviews.upsert(id, req.user.userId, body ?? {});
  }

  @Delete('agents/:id/reviews/mine')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string, @Request() req) {
    return this.reviews.remove(id, req.user.userId);
  }

  @Post('reviews/:id/reply')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 30, ttl: 3600000 } })
  reply(@Param('id') id: string, @Request() req, @Body() body: { text?: string }) {
    return this.reviews.reply(id, req.user.userId, body?.text);
  }

  @Post('reviews/:id/flag')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 3600000 } })
  flag(@Param('id') id: string, @Request() req, @Body() body: { reason?: string }) {
    return this.reviews.flag(id, req.user.userId, body?.reason);
  }

  /** Admin: the approval queue (?status=pending|published|hidden|flagged|all). */
  @Get('reviews')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Header('Cache-Control', 'no-store')
  queue(@Query('status') status?: string, @Query('page') page?: string) {
    const s = ['pending', 'published', 'hidden', 'flagged', 'all'].includes(String(status)) ? String(status) : 'pending';
    return this.reviews.queue(s, Number(page) || 1);
  }

  @Patch('reviews/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  setStatus(@Param('id') id: string, @Body() body: { status?: string }) {
    return this.reviews.setStatus(id, body?.status === 'hidden' ? 'hidden' : 'published');
  }
}

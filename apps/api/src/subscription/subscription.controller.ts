import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { CreateSubscriptionDto } from '@rent-ghar/types/subscription';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('subscriptions')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Post('purchase')
  @UseGuards(JwtAuthGuard)
  async purchase(@Request() req, @Body() dto: CreateSubscriptionDto) {
    return this.subscriptionService.purchase(req.user.userId, dto);
  }

  @Get('my-subscriptions')
  @UseGuards(JwtAuthGuard)
  async findUserSubscriptions(@Request() req) {
    console.log('GET /subscriptions/my-subscriptions called');
    console.log('User:', req.user);
    return this.subscriptionService.findUserSubscriptions(req.user.userId);
  }

  @Get('active')
  @UseGuards(JwtAuthGuard)
  async findActiveSubscription(@Request() req) {
    console.log('GET /subscriptions/active called');
    console.log('User:', req.user);
    return this.subscriptionService.findActiveSubscription(req.user.userId);
  }

  /**
   * What the signed-in account is entitled to right now — the Free tier
   * included. Must come before the @Get(':id') route below.
   */
  /**
   * POST /subscriptions/:id/payment — the agent's "I have paid" step.
   *
   * Owner only, checked in the service. Before :id/activate in declaration
   * order is irrelevant here (different methods), but it must come before the
   * @Get(':id') route below for the same reason that one does.
   */
  @Post(':id/payment')
  @UseGuards(JwtAuthGuard)
  async submitPayment(
    @Param('id') id: string,
    @Request() req,
    @Body()
    body: {
      paymentScreenshotUrl?: string;
      paymentMethod?: string;
      paymentNote?: string;
    },
  ) {
    const saved = await this.subscriptionService.submitPayment(
      id,
      req.user.userId,
      body ?? {},
    );
    return {
      success: true,
      message:
        'Payment submitted. Your plan activates as soon as an admin verifies it.',
      data: saved,
    };
  }

  /** PUT /subscriptions/:id/reject — admin could not verify the payment. */
  @Put(':id/reject')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async rejectPayment(
    @Param('id') id: string,
    @Request() req,
    @Body() body: { reason?: string },
  ) {
    const saved = await this.subscriptionService.rejectPayment(
      id,
      body?.reason ?? '',
      req.user.userId,
    );
    return { success: true, data: saved };
  }

  @Get('my-plan')
  @UseGuards(JwtAuthGuard)
  async myPlan(@Request() req) {
    return this.subscriptionService.getEffectivePlan(req.user.userId);
  }

  @Get('can-create-property')
  @UseGuards(JwtAuthGuard)
  async canCreateProperty(@Request() req) {
    console.log('GET /subscriptions/can-create-property called');
    return this.subscriptionService.canCreateProperty(req.user.userId);
  }

  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async findAll() {
    return this.subscriptionService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string) {
    return this.subscriptionService.findOne(id);
  }

  @Put(':id/activate')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async activate(@Param('id') id: string) {
    return this.subscriptionService.activate(id);
  }

  @Put(':id/cancel')
  @UseGuards(JwtAuthGuard)
  async cancel(@Param('id') id: string, @Request() req) {
    return this.subscriptionService.cancel(id, req.user.userId);
  }
}

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

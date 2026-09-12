import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { CementOrderService } from './cement-order.service';
import { CreateCementOrderDto } from '@rent-ghar/dtos/cement-order/create-cement-order.dto';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

/**
 * 🔒 SECURITY: the read routes here had no guards.
 *
 * `GET /cement-order` returned every order with the customer's name, phone
 * number, email and delivery address — to anyone who asked, unauthenticated.
 * `GET /cement-order/:id` had the same problem for a single order.
 *
 * Placing an order stays public (it is the checkout on the cement rate page);
 * reading them is now admin-only.
 */
@Controller('cement-order')
export class CementOrderController {
  constructor(private readonly cementOrderService: CementOrderService) {}

  // Public: the storefront checkout posts here.
  @Post()
  create(@Body() createDto: CreateCementOrderDto) {
    return this.cementOrderService.create(createDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  findAll() {
    return this.cementOrderService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  findOne(@Param('id') id: string) {
    return this.cementOrderService.findOne(id);
  }
}

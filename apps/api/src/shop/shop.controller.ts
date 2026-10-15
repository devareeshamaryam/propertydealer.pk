import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ShopService, type PlaceOrderInput } from './shop.service';

type AuthedRequest = Request & { user?: { userId?: string } };

/**
 * The materials shop.
 *
 * Public: the catalogue, a delivery quote, placing an order (no account
 * needed — most buyers here will not sign up to buy cement) and tracking one
 * by order number + phone. Admin: the order queue and the rates board.
 */
@Controller('shop')
export class ShopController {
  constructor(private readonly shop: ShopService) {}

  @Get('products')
  async products(@Query('type') type?: string, @Query('search') search?: string) {
    return { success: true, data: await this.shop.listProducts({ type, search }) };
  }

  @Get('quote')
  async quote(@Query('subTotal') subTotal?: string) {
    return { success: true, data: await this.shop.quote(Number(subTotal) || 0) };
  }

  @Post('orders')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async placeOrder(@Body() body: PlaceOrderInput) {
    return { success: true, data: await this.shop.placeOrder(body ?? {}) };
  }

  @Get('track')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async track(@Query('number') number?: string, @Query('phone') phone?: string) {
    return { success: true, data: await this.shop.track(number ?? '', phone ?? '') };
  }

  // ── Admin ──

  @Get('admin/products')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async adminProducts(@Query('type') type?: string, @Query('search') search?: string) {
    return { success: true, data: await this.shop.listProducts({ type, search, includeInactive: true }) };
  }

  @Patch('admin/products/:type/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateProduct(
    @Param('type') type: string,
    @Param('id') id: string,
    @Body() body: { price?: unknown; change?: unknown; isActive?: unknown },
  ) {
    return { success: true, data: await this.shop.updateProduct(type, id, body ?? {}) };
  }

  @Get('admin/orders')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async orders(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<{ success: boolean; data: Record<string, unknown> }> {
    return { success: true, data: await this.shop.adminList({ status, search, page: Number(page), limit: Number(limit) }) };
  }

  @Get('admin/orders/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async order(@Param('id') id: string): Promise<{ success: boolean; data: Record<string, unknown> }> {
    const order = await this.shop.adminGet(id);
    return { success: true, data: { ...order, nextStatuses: ShopService.nextStatuses(order.status) } };
  }

  @Patch('admin/orders/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateOrder(
    @Param('id') id: string,
    @Body() body: { status?: unknown; adminNote?: unknown; paymentStatus?: unknown; note?: unknown },
    @Req() req: AuthedRequest,
  ): Promise<{ success: boolean; data: Record<string, unknown> }> {
    const order = await this.shop.adminUpdate(id, body ?? {}, req.user?.userId);
    return { success: true, data: { ...order, nextStatuses: ShopService.nextStatuses(order.status) } };
  }
}

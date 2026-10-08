import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import {
  PaymentMethodService,
  type PaymentMethodInput,
} from './payment-method.service';

/**
 * The accounts an agent can pay into.
 *
 * Reading the active list needs a sign-in but not admin — it is the checkout
 * page. Everything else is admin-only: these are the numbers money is sent to,
 * so who may change them matters more than usual.
 */
@Controller('payment-methods')
export class PaymentMethodController {
  constructor(private readonly methods: PaymentMethodService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async listActive() {
    return { success: true, data: await this.methods.listActive() };
  }

  @Get('all')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async listAll() {
    return { success: true, data: await this.methods.listAll() };
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async create(@Body() body: PaymentMethodInput) {
    return { success: true, data: await this.methods.create(body ?? {}) };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async update(@Param('id') id: string, @Body() body: PaymentMethodInput) {
    return { success: true, data: await this.methods.update(id, body ?? {}) };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async remove(@Param('id') id: string) {
    return this.methods.remove(id);
  }
}

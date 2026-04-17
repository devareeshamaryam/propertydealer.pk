import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { CementOrderService } from './cement-order.service';
import { CreateCementOrderDto } from '@rent-ghar/dtos/cement-order/create-cement-order.dto';

@Controller('cement-order')
export class CementOrderController {
  constructor(private readonly cementOrderService: CementOrderService) {}

  @Post()
  create(@Body() createDto: CreateCementOrderDto) {
    return this.cementOrderService.create(createDto);
  }

  @Get()
  findAll() {
    return this.cementOrderService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cementOrderService.findOne(id);
  }
}

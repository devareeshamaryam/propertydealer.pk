import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CementOrder, CementOrderDocument } from '@rent-ghar/db/schemas/cement-order.schema';
import { CreateCementOrderDto } from '@rent-ghar/dtos/cement-order/create-cement-order.dto';

@Injectable()
export class CementOrderService {
  constructor(
    @InjectModel(CementOrder.name) private cementOrderModel: Model<CementOrderDocument>,
  ) {}

  async create(createDto: CreateCementOrderDto): Promise<CementOrder> {
    const createdOrder = new this.cementOrderModel(createDto);
    return createdOrder.save();
  }

  async findAll(): Promise<CementOrder[]> {
    return this.cementOrderModel.find().sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string): Promise<CementOrder> {
    const order = await this.cementOrderModel.findById(id).exec();
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }
    return order;
  }
}

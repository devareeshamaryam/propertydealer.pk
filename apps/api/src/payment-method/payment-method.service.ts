import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PaymentMethod,
  PaymentMethodDocument,
  PAYMENT_METHOD_TYPES,
  type PaymentMethodType,
} from '@rent-ghar/db/schemas/payment-method.schema';

export interface PaymentMethodInput {
  label?: string;
  type?: string;
  accountNumber?: string;
  accountTitle?: string;
  instructions?: string;
  isActive?: boolean;
  order?: number;
}

@Injectable()
export class PaymentMethodService {
  constructor(
    @InjectModel(PaymentMethod.name)
    private readonly model: Model<PaymentMethodDocument>,
  ) {}

  /** What the checkout page shows — active accounts, in the admin's order. */
  async listActive() {
    return this.model
      .find({ isActive: true })
      .sort({ order: 1, createdAt: 1 })
      .lean()
      .exec();
  }

  /** The admin list, including the switched-off ones. */
  async listAll() {
    return this.model.find().sort({ order: 1, createdAt: 1 }).lean().exec();
  }

  private clean(input: PaymentMethodInput) {
    const type = PAYMENT_METHOD_TYPES.includes(input.type as PaymentMethodType)
      ? (input.type as PaymentMethodType)
      : 'other';

    return {
      ...(input.label !== undefined ? { label: String(input.label).trim() } : {}),
      ...(input.type !== undefined ? { type } : {}),
      ...(input.accountNumber !== undefined
        ? { accountNumber: String(input.accountNumber).trim() }
        : {}),
      ...(input.accountTitle !== undefined
        ? { accountTitle: String(input.accountTitle).trim() }
        : {}),
      ...(input.instructions !== undefined
        ? { instructions: String(input.instructions).trim().slice(0, 500) }
        : {}),
      ...(input.isActive !== undefined ? { isActive: Boolean(input.isActive) } : {}),
      ...(input.order !== undefined ? { order: Number(input.order) || 0 } : {}),
    };
  }

  async create(input: PaymentMethodInput) {
    return this.model.create(this.clean(input));
  }

  async update(id: string, input: PaymentMethodInput) {
    const doc = await this.model
      .findByIdAndUpdate(id, { $set: this.clean(input) }, { new: true })
      .exec();
    if (!doc) throw new NotFoundException('Payment method not found');
    return doc;
  }

  async remove(id: string) {
    const doc = await this.model.findByIdAndDelete(id).exec();
    if (!doc) throw new NotFoundException('Payment method not found');
    return { success: true };
  }
}

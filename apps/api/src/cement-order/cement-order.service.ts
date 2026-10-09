import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CementOrder, CementOrderDocument } from '@rent-ghar/db/schemas/cement-order.schema';
import { CreateCementOrderDto } from '@rent-ghar/dtos/cement-order/create-cement-order.dto';
import { DiscordService, DISCORD_COLORS } from '../notify/discord.service';

@Injectable()
export class CementOrderService {
  constructor(
    @InjectModel(CementOrder.name) private cementOrderModel: Model<CementOrderDocument>,
    private readonly discord: DiscordService,
  ) {}

  async create(createDto: CreateCementOrderDto): Promise<CementOrder> {
    const createdOrder = new this.cementOrderModel(createDto);
    const saved = await createdOrder.save();

    /*
     * An order is the one thing on this site that someone is waiting on.
     *
     * A listing can sit in the queue for an hour and nobody minds; a customer
     * who has just ordered twenty bags of cement is expecting a phone call.
     * The alert carries the phone number and the address so the office can
     * ring back straight from the notification without opening the dashboard.
     *
     * Fire-and-forget by design — see DiscordService.send. A webhook that is
     * down, slow or simply not configured must never cost a customer their
     * order.
     */
    const items = (saved.items ?? [])
      .map(
        (item) =>
          `${item.quantity} × ${item.brand}${item.weightKg ? ` ${item.weightKg}kg` : ''}`,
      )
      .join('\n')
      .slice(0, 900);

    this.discord.send({
      title: '🧱 New materials order',
      description: `${saved.customerName} — ${DiscordService.money(saved.total)}`,
      url: '/dashboard/cement-order',
      color: DISCORD_COLORS.order,
      fields: [
        { name: 'Phone', value: saved.customerPhone || '—' },
        { name: 'City', value: saved.items?.[0]?.city || '—' },
        { name: 'Payment', value: String(saved.paymentMethod || 'cod').toUpperCase() },
        { name: 'Items', value: items || '—', inline: false },
        { name: 'Deliver to', value: saved.address || '—', inline: false },
        {
          name: 'Total',
          value:
            `${DiscordService.money(saved.subTotal)} + ${DiscordService.money(saved.deliveryCharges)} delivery` +
            ` = ${DiscordService.money(saved.total)}`,
          inline: false,
        },
        { name: 'Order id', value: String((saved as { _id?: unknown })._id ?? ''), inline: false },
      ],
    });

    return saved;
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

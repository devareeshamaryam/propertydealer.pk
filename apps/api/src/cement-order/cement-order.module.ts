import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CementOrder, CementOrderSchema } from '@rent-ghar/db/schemas/cement-order.schema';
import { CementOrderService } from './cement-order.service';
import { CementOrderController } from './cement-order.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CementOrder.name, schema: CementOrderSchema },
    ]),
  ],
  controllers: [CementOrderController],
  providers: [CementOrderService],
})
export class CementOrderModule {}

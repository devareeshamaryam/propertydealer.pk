import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  PaymentMethod,
  PaymentMethodSchema,
} from '@rent-ghar/db/schemas/payment-method.schema';
import { PaymentMethodService } from './payment-method.service';
import { PaymentMethodController } from './payment-method.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PaymentMethod.name, schema: PaymentMethodSchema },
    ]),
  ],
  providers: [PaymentMethodService],
  controllers: [PaymentMethodController],
  exports: [PaymentMethodService],
})
export class PaymentMethodModule {}

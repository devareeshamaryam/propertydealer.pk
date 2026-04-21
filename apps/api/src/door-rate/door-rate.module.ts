import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DoorRate, DoorRateSchema } from '@rent-ghar/db/schemas/door-rate.schema';
import { DoorRateService } from './door-rate.service';
import { DoorRateController } from './door-rate.controller';
import { StorageModule } from '@rent-ghar/storage';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DoorRate.name, schema: DoorRateSchema },
    ]),
    StorageModule,
  ],
  providers: [DoorRateService],
  controllers: [DoorRateController],
  exports: [DoorRateService],
})
export class DoorRateModule {}

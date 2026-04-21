import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WoodRate, WoodRateSchema } from '@rent-ghar/db/schemas/wood-rate.schema';
import { WoodRateService } from './wood-rate.service';
import { WoodRateController } from './wood-rate.controller';
import { StorageModule } from '@rent-ghar/storage';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WoodRate.name, schema: WoodRateSchema },
    ]),
    StorageModule,
  ],
  providers: [WoodRateService],
  controllers: [WoodRateController],
  exports: [WoodRateService],
})
export class WoodRateModule {}

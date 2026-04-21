import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SteelRate, SteelRateSchema } from '@rent-ghar/db/schemas/steel-rate.schema';
import { SteelRateService } from './steel-rate.service';
import { SteelRateController } from './steel-rate.controller';
import { StorageModule } from '@rent-ghar/storage';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SteelRate.name, schema: SteelRateSchema },
    ]),
    StorageModule,
  ],
  providers: [SteelRateService],
  controllers: [SteelRateController],
  exports: [SteelRateService],
})
export class SteelRateModule {}

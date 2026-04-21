import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BajriRate, BajriRateSchema } from '@rent-ghar/db/schemas/bajri-rate.schema';
import { BajriRateService } from './bajri-rate.service';
import { BajriRateController } from './bajri-rate.controller';
import { StorageModule } from '@rent-ghar/storage';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BajriRate.name, schema: BajriRateSchema },
    ]),
    StorageModule,
  ],
  providers: [BajriRateService],
  controllers: [BajriRateController],
  exports: [BajriRateService],
})
export class BajriRateModule {}

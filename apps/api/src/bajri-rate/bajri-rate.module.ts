import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BajriRate, BajriRateSchema } from '@rent-ghar/db/schemas/bajri-rate.schema';
import { BajriRateService } from './bajri-rate.service';
import { BajriRateController } from './bajri-rate.controller';
import { StorageModule } from '@rent-ghar/storage';
import { MaterialRateModule } from '../material-rate/material-rate.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BajriRate.name, schema: BajriRateSchema },
    ]),
    StorageModule,
    // Lets this module serve the unified `materialrates` collection when
    // MATERIAL_RATES_UNIFIED is on. See scripts/migrate-material-rates.ts.
    MaterialRateModule,
  ],
  providers: [BajriRateService],
  controllers: [BajriRateController],
  exports: [BajriRateService],
})
export class BajriRateModule {}

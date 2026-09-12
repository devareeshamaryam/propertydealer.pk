import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SteelRate, SteelRateSchema } from '@rent-ghar/db/schemas/steel-rate.schema';
import { SteelRateService } from './steel-rate.service';
import { SteelRateController } from './steel-rate.controller';
import { StorageModule } from '@rent-ghar/storage';
import { MaterialRateModule } from '../material-rate/material-rate.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SteelRate.name, schema: SteelRateSchema },
    ]),
    StorageModule,
    // Lets this module serve the unified `materialrates` collection when
    // MATERIAL_RATES_UNIFIED is on. See scripts/migrate-material-rates.ts.
    MaterialRateModule,
  ],
  providers: [SteelRateService],
  controllers: [SteelRateController],
  exports: [SteelRateService],
})
export class SteelRateModule {}

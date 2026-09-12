import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WoodRate, WoodRateSchema } from '@rent-ghar/db/schemas/wood-rate.schema';
import { WoodRateService } from './wood-rate.service';
import { WoodRateController } from './wood-rate.controller';
import { StorageModule } from '@rent-ghar/storage';
import { MaterialRateModule } from '../material-rate/material-rate.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WoodRate.name, schema: WoodRateSchema },
    ]),
    StorageModule,
    // Lets this module serve the unified `materialrates` collection when
    // MATERIAL_RATES_UNIFIED is on. See scripts/migrate-material-rates.ts.
    MaterialRateModule,
  ],
  providers: [WoodRateService],
  controllers: [WoodRateController],
  exports: [WoodRateService],
})
export class WoodRateModule {}

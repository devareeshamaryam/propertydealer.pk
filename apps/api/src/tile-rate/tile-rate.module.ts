import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TileRate, TileRateSchema } from '@rent-ghar/db/schemas/tile-rate.schema';
import { TileRateService } from './tile-rate.service';
import { TileRateController } from './tile-rate.controller';
import { StorageModule } from '@rent-ghar/storage';
import { MaterialRateModule } from '../material-rate/material-rate.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TileRate.name, schema: TileRateSchema },
    ]),
    StorageModule,
    // Lets this module serve the unified `materialrates` collection when
    // MATERIAL_RATES_UNIFIED is on. See scripts/migrate-material-rates.ts.
    MaterialRateModule,
  ],
  providers: [TileRateService],
  controllers: [TileRateController],
  exports: [TileRateService],
})
export class TileRateModule {}

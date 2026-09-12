import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BricksRate, BricksRateSchema } from '@rent-ghar/db/schemas/bricks-rate.schema';
import { BricksRateService } from './bricks-rate.service';
import { BricksRateController } from './bricks-rate.controller';
import { StorageModule } from '@rent-ghar/storage';
import { MaterialRateModule } from '../material-rate/material-rate.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BricksRate.name, schema: BricksRateSchema },
    ]),
    StorageModule,
    // Lets this module serve the unified `materialrates` collection when
    // MATERIAL_RATES_UNIFIED is on. See scripts/migrate-material-rates.ts.
    MaterialRateModule,
  ],
  providers: [BricksRateService],
  controllers: [BricksRateController],
  exports: [BricksRateService],
})
export class BricksRateModule {}

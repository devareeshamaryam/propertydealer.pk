import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DoorRate, DoorRateSchema } from '@rent-ghar/db/schemas/door-rate.schema';
import { DoorRateService } from './door-rate.service';
import { DoorRateController } from './door-rate.controller';
import { StorageModule } from '@rent-ghar/storage';
import { MaterialRateModule } from '../material-rate/material-rate.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DoorRate.name, schema: DoorRateSchema },
    ]),
    StorageModule,
    // Lets this module serve the unified `materialrates` collection when
    // MATERIAL_RATES_UNIFIED is on. See scripts/migrate-material-rates.ts.
    MaterialRateModule,
  ],
  providers: [DoorRateService],
  controllers: [DoorRateController],
  exports: [DoorRateService],
})
export class DoorRateModule {}

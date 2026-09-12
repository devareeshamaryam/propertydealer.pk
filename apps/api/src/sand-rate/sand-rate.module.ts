import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SandRate, SandRateSchema } from '@rent-ghar/db/schemas/sand-rate.schema';
import { SandRateService } from './sand-rate.service';
import { SandRateController } from './sand-rate.controller';
import { StorageModule } from '@rent-ghar/storage';
import { MaterialRateModule } from '../material-rate/material-rate.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SandRate.name, schema: SandRateSchema },
    ]),
    StorageModule,
    // Lets this module serve the unified `materialrates` collection when
    // MATERIAL_RATES_UNIFIED is on. See scripts/migrate-material-rates.ts.
    MaterialRateModule,
  ],
  providers: [SandRateService],
  controllers: [SandRateController],
  exports: [SandRateService],
})
export class SandRateModule {}

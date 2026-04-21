import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MaterialRate, MaterialRateSchema } from '@rent-ghar/db/schemas/material-rate.schema';
import { MaterialRateService } from './material-rate.service';
import { MaterialRateController } from './material-rate.controller';
import { StorageModule } from '@rent-ghar/storage';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MaterialRate.name, schema: MaterialRateSchema },
    ]),
    StorageModule,
  ],
  providers: [MaterialRateService],
  controllers: [MaterialRateController],
  exports: [MaterialRateService],
})
export class MaterialRateModule {}

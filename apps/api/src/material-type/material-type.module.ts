import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MaterialType, MaterialTypeSchema } from '@rent-ghar/db/schemas/material-type.schema';
import { MaterialRate, MaterialRateSchema } from '@rent-ghar/db/schemas/material-rate.schema';
import { MaterialTypeController } from './material-type.controller';
import { MaterialTypeService } from './material-type.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MaterialType.name, schema: MaterialTypeSchema },
      { name: MaterialRate.name, schema: MaterialRateSchema },
    ]),
  ],
  controllers: [MaterialTypeController],
  providers: [MaterialTypeService],
  exports: [MaterialTypeService, MongooseModule],
})
export class MaterialTypeModule {}

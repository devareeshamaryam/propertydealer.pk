import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BricksRate, BricksRateSchema } from '@rent-ghar/db/schemas/bricks-rate.schema';
import { BricksRateService } from './bricks-rate.service';
import { BricksRateController } from './bricks-rate.controller';
import { StorageModule } from '@rent-ghar/storage';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BricksRate.name, schema: BricksRateSchema },
    ]),
    StorageModule,
  ],
  providers: [BricksRateService],
  controllers: [BricksRateController],
  exports: [BricksRateService],
})
export class BricksRateModule {}

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TileRate, TileRateSchema } from '@rent-ghar/db/schemas/tile-rate.schema';
import { TileRateService } from './tile-rate.service';
import { TileRateController } from './tile-rate.controller';
import { StorageModule } from '@rent-ghar/storage';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TileRate.name, schema: TileRateSchema },
    ]),
    StorageModule,
  ],
  providers: [TileRateService],
  controllers: [TileRateController],
  exports: [TileRateService],
})
export class TileRateModule {}

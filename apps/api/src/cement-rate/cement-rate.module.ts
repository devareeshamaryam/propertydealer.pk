import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CementRate, CementRateSchema } from '@rent-ghar/db/schemas/cement-rate.schema';
import { CementRateService } from './cement-rate.service';
import { CementRateController } from './cement-rate.controller';
import { StorageModule } from '@rent-ghar/storage';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CementRate.name, schema: CementRateSchema },
    ]),
    StorageModule,
  ],
  providers: [CementRateService],
  controllers: [CementRateController],
  exports: [CementRateService],
})
export class CementRateModule {}

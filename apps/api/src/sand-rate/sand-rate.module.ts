import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SandRate, SandRateSchema } from '@rent-ghar/db/schemas/sand-rate.schema';
import { SandRateService } from './sand-rate.service';
import { SandRateController } from './sand-rate.controller';
import { StorageModule } from '@rent-ghar/storage';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SandRate.name, schema: SandRateSchema },
    ]),
    StorageModule,
  ],
  providers: [SandRateService],
  controllers: [SandRateController],
  exports: [SandRateService],
})
export class SandRateModule {}

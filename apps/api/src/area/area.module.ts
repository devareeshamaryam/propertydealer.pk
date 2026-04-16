import { Module } from '@nestjs/common';
// Force reload of Area Module and its Schema
import { MongooseModule } from '@nestjs/mongoose';
import { AreaController } from './area.controller';
import { AreaService } from './area.service';
import { Area, AreaSchema } from '@rent-ghar/db/schemas/area.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Area.name, schema: AreaSchema }])],
  controllers: [AreaController],
  providers: [AreaService],
  exports: [AreaService]
})
export class AreaModule {}

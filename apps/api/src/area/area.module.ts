import { Module } from '@nestjs/common';
// Force reload of Area Module and its Schema
import { MongooseModule } from '@nestjs/mongoose';
import { AreaController } from './area.controller';
import { AreaService } from './area.service';
import { SocietyService } from './society.service';
import { SocietyController } from './society.controller';
import { Area, AreaSchema } from '@rent-ghar/db/schemas/area.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Area.name, schema: AreaSchema }])],
  controllers: [AreaController, SocietyController],
  providers: [AreaService, SocietyService],
  exports: [AreaService, SocietyService]
})
export class AreaModule {}

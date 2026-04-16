import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CityService } from './city.service';
import { CityController } from './city.controller';
import { City, CitySchema } from '@rent-ghar/db/schemas/city.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: City.name, schema: CitySchema }])],
  providers: [CityService],
  controllers: [CityController],
  exports: [CityService]
})
export class CityModule {}

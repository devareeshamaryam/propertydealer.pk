import { Module } from '@nestjs/common';
import { PropertyController } from './property.controller';
import { PropertyService } from './property.service';
import { Property, PropertySchema } from '@rent-ghar/db/schemas/property.schema';
import { Area, AreaSchema } from '@rent-ghar/db/schemas/area.schema';
import { City, CitySchema } from '@rent-ghar/db/schemas/city.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { StorageModule } from '@rent-ghar/storage';
import { SubscriptionModule } from '../subscription/subscription.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Property.name, schema: PropertySchema },
      { name: Area.name, schema: AreaSchema },
      { name: City.name, schema: CitySchema }
    ]),
    StorageModule,
    SubscriptionModule,
  ],
  controllers: [PropertyController],
  providers: [PropertyService],
  exports: [PropertyService]
})
export class PropertyModule {}

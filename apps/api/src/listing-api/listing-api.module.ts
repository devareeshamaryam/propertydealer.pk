import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Area, AreaSchema } from '@rent-ghar/db/schemas/area.schema';
import { City, CitySchema } from '@rent-ghar/db/schemas/city.schema';
import { User, UserSchema } from '@rent-ghar/db/schemas/user.schema';
import { Property, PropertySchema } from '@rent-ghar/db/schemas/property.schema';
import { StorageModule } from '@rent-ghar/storage';
import { PropertyModule } from '../property/property.module';
import { AreaModule } from '../area/area.module';
import { ListingApiController } from './listing-api.controller';
import { ListingApiService } from './listing-api.service';
import { ApiKeyGuard } from './api-key.guard';

/**
 * The Listing API for automation (n8n, scripts). Listings go through the same
 * PropertyService as the dashboard, areas through the same AreaService.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Area.name, schema: AreaSchema },
      { name: City.name, schema: CitySchema },
      { name: User.name, schema: UserSchema },
      { name: Property.name, schema: PropertySchema },
    ]),
    StorageModule,
    PropertyModule,
    AreaModule,
  ],
  controllers: [ListingApiController],
  providers: [ListingApiService, ApiKeyGuard],
})
export class ListingApiModule {}

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Area, AreaSchema } from '@rent-ghar/db/schemas/area.schema';
import { City, CitySchema } from '@rent-ghar/db/schemas/city.schema';
import { User, UserSchema } from '@rent-ghar/db/schemas/user.schema';
import { StorageModule } from '@rent-ghar/storage';
import { PropertyModule } from '../property/property.module';
import { ListingApiController } from './listing-api.controller';
import { ListingApiService } from './listing-api.service';
import { ApiKeyGuard } from './api-key.guard';

/**
 * ListingApiModule
 * ----------------
 * Standalone module that exposes a narrow, API-key-protected interface for
 * automation tools (n8n, scripts, etc.) to create draft property listings and
 * look up reference data. Reuses the existing PropertyModule for the actual
 * property creation logic.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Area.name, schema: AreaSchema },
      { name: City.name, schema: CitySchema },
      { name: User.name, schema: UserSchema },
    ]),
    StorageModule,
    PropertyModule,
  ],
  controllers: [ListingApiController],
  providers: [ListingApiService, ApiKeyGuard],
})
export class ListingApiModule {}

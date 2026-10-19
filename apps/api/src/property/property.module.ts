import { Module } from '@nestjs/common';
import { PropertyController } from './property.controller';
import { PropertyService } from './property.service';
import { PropertyCountersService } from './property-counters.service';
import { ListingBrainService } from './listing-brain.service';
import { ListingExpiryService } from './listing-expiry.service';
import { Property, PropertySchema } from '@rent-ghar/db/schemas/property.schema';
import { Area, AreaSchema } from '@rent-ghar/db/schemas/area.schema';
import { City, CitySchema } from '@rent-ghar/db/schemas/city.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { SiteSettingsModule } from '../site-settings/site-settings.module';
import { AgencyModule } from '../agency/agency.module';
import { StorageModule } from '@rent-ghar/storage';
import { SubscriptionModule } from '../subscription/subscription.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Property.name, schema: PropertySchema },
      { name: Area.name, schema: AreaSchema },
      { name: City.name, schema: CitySchema }
    ]),
    StorageModule,
    SubscriptionModule,
    // For promoting a USER to AGENT on their first listing.
    UserModule,
    // Sold/rented grace period comes from the site settings.
    SiteSettingsModule,
    // Agency teams and the verified badge.
    AgencyModule,
  ],
  controllers: [PropertyController],
  providers: [PropertyService, PropertyCountersService, ListingBrainService, ListingExpiryService],
  exports: [PropertyService]
})
export class PropertyModule {}

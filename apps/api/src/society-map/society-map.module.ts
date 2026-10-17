import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SocietyMap, SocietyMapSchema } from '@rent-ghar/db/schemas/society-map.schema';
import { SocietyPlot, SocietyPlotSchema } from '@rent-ghar/db/schemas/society-plot.schema';
import { Property, PropertySchema } from '@rent-ghar/db/schemas/property.schema';
import { City, CitySchema } from '@rent-ghar/db/schemas/city.schema';
import { Area, AreaSchema } from '@rent-ghar/db/schemas/area.schema';
import { StorageModule } from '@rent-ghar/storage';
import { SocietyMapService } from './society-map.service';
import { SocietyMapTiler } from './society-map.tiler';
import { SocietyMapSetup } from './society-map.setup';
import { SocietyDataService } from './society-data.service';
import { SocietyMapAdminController, SocietyMapController } from './society-map.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SocietyMap.name, schema: SocietyMapSchema },
      { name: SocietyPlot.name, schema: SocietyPlotSchema },
      { name: Property.name, schema: PropertySchema },
      { name: City.name, schema: CitySchema },
      { name: Area.name, schema: AreaSchema },
    ]),
    StorageModule,
  ],
  providers: [SocietyMapService, SocietyMapTiler, SocietyMapSetup, SocietyDataService],
  controllers: [SocietyMapController, SocietyMapAdminController],
  exports: [SocietyMapService],
})
export class SocietyMapModule {}

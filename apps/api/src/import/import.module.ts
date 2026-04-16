import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';
import { PropertySchema } from '../../../../packages/db/src/schemas/property.schema';
import { AreaSchema } from '../../../../packages/db/src/schemas/area.schema';
import { CitySchema } from '../../../../packages/db/src/schemas/city.schema';
import { StorageModule } from '../../../../packages/storage/storage.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Property', schema: PropertySchema },
      { name: 'Area', schema: AreaSchema },
      { name: 'City', schema: CitySchema },
    ]),
    StorageModule,
  ],
  controllers: [ImportController],
  providers: [ImportService],
})
export class ImportModule {}

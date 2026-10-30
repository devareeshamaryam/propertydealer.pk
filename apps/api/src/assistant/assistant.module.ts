import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Property, PropertySchema } from '@rent-ghar/db/schemas/property.schema';
import { AgencyModule } from '../agency/agency.module';
import { AssistantDataService } from './assistant-data.service';
import { AssistantController } from './assistant.controller';

@Module({
  imports: [AgencyModule, MongooseModule.forFeature([{ name: Property.name, schema: PropertySchema }])],
  providers: [AssistantDataService],
  controllers: [AssistantController],
})
export class AssistantModule {}

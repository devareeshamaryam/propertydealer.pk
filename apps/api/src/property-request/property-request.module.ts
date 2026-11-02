import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PropertyRequest, PropertyRequestSchema } from '@rent-ghar/db/schemas/property-request.schema';
import { PropertyRequestController } from './property-request.controller';
import { PropertyRequestService } from './property-request.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: PropertyRequest.name, schema: PropertyRequestSchema }])],
  providers: [PropertyRequestService],
  controllers: [PropertyRequestController],
})
export class PropertyRequestModule {}

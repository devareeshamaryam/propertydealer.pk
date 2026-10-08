import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Report, ReportSchema } from '@rent-ghar/db/schemas/report.schema';
import {
  Property,
  PropertySchema,
} from '@rent-ghar/db/schemas/property.schema';
import { ReportService } from './report.service';
import { ReportController } from './report.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Report.name, schema: ReportSchema },
      // A listing report needs the listing's owner, so complaints can be
      // counted per agent rather than per listing.
      { name: Property.name, schema: PropertySchema },
    ]),
  ],
  providers: [ReportService],
  controllers: [ReportController],
  exports: [ReportService],
})
export class ReportModule {}

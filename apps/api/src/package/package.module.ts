import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Package, PackageSchema } from '@rent-ghar/db/schemas/package.schema';
import { PackageController } from './package.controller';
import { PackageService } from './package.service';
import { AgencyModule } from '../agency/agency.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Package.name, schema: PackageSchema }]),
    AgencyModule,
  ],
  controllers: [PackageController],
  providers: [PackageService],
  exports: [PackageService],
})
export class PackageModule {}

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Package, PackageSchema } from '@rent-ghar/db/schemas/package.schema';
import { Page, PageSchema } from '@rent-ghar/db/schemas/page.schema';
import { SetupService } from './setup.service';

/** One-time data changes that run after a deploy — see setup.service.ts. */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Package.name, schema: PackageSchema },
      { name: Page.name, schema: PageSchema },
    ]),
  ],
  providers: [SetupService],
})
export class SetupModule {}

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  SiteSetting,
  SiteSettingSchema,
} from '@rent-ghar/db/schemas/site-setting.schema';
import { SiteSettingsService } from './site-settings.service';
import { SiteSettingsController } from './site-settings.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: SiteSetting.name, schema: SiteSettingSchema }]),
  ],
  providers: [SiteSettingsService],
  controllers: [SiteSettingsController],
  exports: [SiteSettingsService],
})
export class SiteSettingsModule {}

import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  PushCampaign, PushCampaignSchema, PushJob, PushJobSchema, PushSetting, PushSettingSchema, PushStat, PushStatSchema, PushSubscriber, PushSubscriberSchema,
} from '@rent-ghar/db/schemas/push.schema';
import { User, UserSchema } from '@rent-ghar/db/schemas/user.schema';
import { Property, PropertySchema } from '@rent-ghar/db/schemas/property.schema';
import { SiteSettingsModule } from '../site-settings/site-settings.module';
import { PushCoreService } from './push-core.service';
import { PushIconService } from './push-icon.service';
import { PushService } from './push.service';
import { PushEventsService } from './push-events.service';
import { PushCampaignService } from './push-campaign.service';
import { PushSchedulerService } from './push-scheduler.service';
import { PushController } from './push.controller';
import { PushAdminController } from './push-admin.controller';

/**
 * Browser push notifications. Global, so the listing, review, payment and
 * report services can say what happened (PushEventsService) without
 * importing this module — and without this module importing theirs.
 */
@Global()
@Module({
  imports: [
    SiteSettingsModule,
    MongooseModule.forFeature([
      { name: PushSubscriber.name, schema: PushSubscriberSchema },
      { name: PushCampaign.name, schema: PushCampaignSchema },
      { name: PushJob.name, schema: PushJobSchema },
      { name: PushStat.name, schema: PushStatSchema },
      { name: PushSetting.name, schema: PushSettingSchema },
      { name: User.name, schema: UserSchema },
      { name: Property.name, schema: PropertySchema },
    ]),
  ],
  providers: [PushIconService, PushCoreService, PushService, PushEventsService, PushCampaignService, PushSchedulerService],
  controllers: [PushController, PushAdminController],
  exports: [PushEventsService, PushService],
})
export class PushModule {}

import { Global, Module } from '@nestjs/common';
import { DiscordService } from './discord.service';
import { DigestService } from './digest.service';
import { NotifyController } from './notify.controller';

/**
 * Global, like the cache module: admin alerts are cross-cutting — a listing, a
 * sign-up, a payment and a report all need to announce themselves, and none of
 * those modules should have to import a notifier to do it.
 */
@Global()
@Module({
  providers: [DiscordService, DigestService],
  controllers: [NotifyController],
  exports: [DiscordService],
})
export class NotifyModule {}

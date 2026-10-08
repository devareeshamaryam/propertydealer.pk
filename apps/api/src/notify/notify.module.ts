import { Global, Module } from '@nestjs/common';
import { DiscordService } from './discord.service';

/**
 * Global, like the cache module: admin alerts are cross-cutting — a listing, a
 * sign-up, a payment and a report all need to announce themselves, and none of
 * those modules should have to import a notifier to do it.
 */
@Global()
@Module({
  providers: [DiscordService],
  exports: [DiscordService],
})
export class NotifyModule {}

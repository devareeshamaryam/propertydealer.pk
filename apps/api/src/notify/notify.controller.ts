import { Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { DISCORD_COLORS, DiscordService } from './discord.service';
import { DigestService } from './digest.service';

/** Dashboard → Notifications: check the channel works, and see the morning report now. */
@Controller('notify')
@UseGuards(JwtAuthGuard, AdminGuard)
export class NotifyController {
  constructor(
    private readonly discord: DiscordService,
    private readonly digest: DigestService,
  ) {}

  @Post('test')
  async test() {
    if (!this.discord.configured()) return { ok: false, reason: 'DISCORD_WEBHOOK_URL is not set on the server' };
    const ok = await this.discord.deliver(
      {
        title: '🔔 Test message',
        description: 'Alerts from the dashboard reach this channel.',
        url: '/dashboard/notifications',
        color: DISCORD_COLORS.info,
        links: [{ label: 'Notification settings', url: '/dashboard/notifications' }],
      },
      true,
    );
    return { ok };
  }

  @Post('digest')
  async sendDigest() {
    if (!this.discord.configured()) return { ok: false, reason: 'DISCORD_WEBHOOK_URL is not set on the server' };
    await this.digest.send(true);
    return { ok: true };
  }
}

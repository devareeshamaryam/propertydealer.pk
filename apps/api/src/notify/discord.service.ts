import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Admin alerts, delivered to a Discord channel.
 *
 * Why Discord: the admin already carries the Discord app, which handles the
 * push notification, the sound and the badge — so "tell me when an agent posts
 * a property" costs one webhook URL instead of Firebase keys, APNs
 * certificates, a service worker and a device-token table. Each alert is an
 * embed with a link straight to the thing it is about.
 *
 * Fire-and-forget by design: it never throws and never blocks the request that
 * triggered it. A listing must not fail to save because a webhook timed out.
 */

export const DISCORD_COLORS = {
  listing: 0x3b82f6, // blue — new listing
  approved: 0x16a34a, // green — went live
  review: 0xf59e0b, // amber — held for approval
  report: 0xe11d2a, // red — someone reported something
  account: 0x8b5cf6, // purple — new account
  money: 0x10b981, // emerald — a plan was bought
  info: 0x6b7280, // grey
} as const;

export interface DiscordField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordAlert {
  title: string;
  description?: string;
  /** A path ("/dashboard/property?status=pending") or a full URL. */
  url?: string;
  color?: number;
  fields?: DiscordField[];
}

@Injectable()
export class DiscordService {
  private readonly logger = new Logger(DiscordService.name);

  constructor(private readonly config: ConfigService) {}

  private webhook(): string {
    const url = this.config.get<string>('DISCORD_WEBHOOK_URL') ?? '';
    return url.startsWith('https://discord.com/api/webhooks/') ||
      url.startsWith('https://discordapp.com/api/webhooks/')
      ? url
      : '';
  }

  /** Base URL of the website, for turning paths into clickable links. */
  private siteUrl(): string {
    return (
      this.config.get<string>('WEB_URL') ||
      this.config.get<string>('APP_URL') ||
      this.config.get<string>('FRONTEND_URL') ||
      'https://propertydealer.pk'
    ).replace(/\/$/, '');
  }

  /** Absolute link for a path, so every alert is one tap from the thing. */
  link(path: string): string {
    if (/^https?:\/\//i.test(path)) return path;
    return `${this.siteUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  }

  /**
   * Send an alert. Returns immediately — the caller does not await the network.
   */
  send(alert: DiscordAlert): void {
    const webhook = this.webhook();
    if (!webhook) return; // Not configured: silently off, by design.

    const embed = {
      title: alert.title.slice(0, 250),
      description: alert.description?.slice(0, 1500),
      url: alert.url ? this.link(alert.url) : undefined,
      color: alert.color ?? DISCORD_COLORS.info,
      fields: alert.fields?.slice(0, 10).map((field) => ({
        name: field.name.slice(0, 250),
        value: (field.value || '—').slice(0, 1000),
        inline: field.inline ?? true,
      })),
      footer: { text: 'propertydealer.pk' },
      timestamp: new Date().toISOString(),
    };

    void fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'PropertyDealer',
        embeds: [embed],
      }),
      signal: AbortSignal.timeout(6000),
    })
      .then((response) => {
        if (!response.ok) {
          this.logger.warn(
            `Discord webhook answered ${response.status} for "${alert.title}"`,
          );
        }
      })
      .catch((error) => {
        this.logger.warn(
          `Discord alert "${alert.title}" failed: ${(error as Error).message}`,
        );
      });
  }

  /** Rs 15,500,000 → "Rs 1.55 Crore" for a readable alert. */
  static money(amount?: number | null): string {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return '—';

    const trim = (n: number) => String(Number(n.toFixed(2)));
    if (value >= 1_000_000_000) return `Rs ${trim(value / 1_000_000_000)} Arab`;
    if (value >= 10_000_000) return `Rs ${trim(value / 10_000_000)} Crore`;
    if (value >= 100_000) return `Rs ${trim(value / 100_000)} Lakh`;
    return `Rs ${value.toLocaleString('en-PK')}`;
  }
}

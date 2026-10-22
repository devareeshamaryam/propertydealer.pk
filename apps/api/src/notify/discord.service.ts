import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types, isValidObjectId } from 'mongoose';

/**
 * Admin alerts, delivered to a Discord channel.
 *
 * Why Discord: the admin already carries the Discord app, which handles the
 * push notification, the sound and the badge — so "tell me when an agent posts
 * a property" costs one webhook URL instead of Firebase keys, APNs
 * certificates, a service worker and a device-token table.
 *
 * Every alert is meant to be acted on from the phone: who it is about (name,
 * phone, WhatsApp, email, city, plan — not a bare id), and links straight to
 * the thing — review it, edit it, open it on the site, see their listings.
 * Each kind can be switched off in the dashboard (Settings → Notifications).
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
  order: 0xf97316, // orange — a materials order came in
  security: 0xdc2626, // red — a lock-out, a role change
  error: 0x991b1b, // dark red — the server failed
  info: 0x6b7280, // grey
} as const;

/**
 * The kinds of alert, each with its own on/off switch (site setting
 * `notify<Kind>`, on unless switched off).
 */
export const NOTIFY_CATEGORIES = [
  'Accounts',
  'Listings',
  'ListingsAuto',
  'ListingChanges',
  'Reports',
  'Orders',
  'Payments',
  'Team',
  'Places',
  'Security',
  'Errors',
  'Digest',
] as const;
export type NotifyCategory = (typeof NOTIFY_CATEGORIES)[number];

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
  /** Which switch in Settings → Notifications this alert obeys. */
  category?: NotifyCategory;
  /** People the alert is about: their details are looked up and shown, with links. */
  who?: { label: string; id: unknown }[];
  /** Buttons, in effect: "Review" → /dashboard/…, "Open" → /properties/…. */
  links?: { label: string; url: string }[];
  /** A small picture beside the alert — a listing's cover photo. */
  image?: string;
}

const clip = (v: unknown, n: number) => String(v ?? '').slice(0, n);
const slugify = (t: string) => t.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

@Injectable()
export class DiscordService {
  private readonly logger = new Logger(DiscordService.name);
  private switches: { at: number; value: Record<string, unknown> } | null = null;
  private recent = new Map<string, number>();

  constructor(
    private readonly config: ConfigService,
    @InjectConnection() private readonly conn: Connection,
  ) {}

  private webhook(): string {
    const url = this.config.get<string>('DISCORD_WEBHOOK_URL') ?? '';
    return url.startsWith('https://discord.com/api/webhooks/') ||
      url.startsWith('https://discordapp.com/api/webhooks/')
      ? url
      : '';
  }

  /** Whether alerts can be sent at all (a webhook is set). */
  configured(): boolean {
    return !!this.webhook();
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

  /** A markdown link Discord shows as tappable text. */
  md(label: string, path: string): string {
    return `[${label.replace(/[[\]]/g, '')}](${this.link(path)})`;
  }

  /** The admin's switches (Settings → Notifications), read at most once a minute. */
  private async enabled(category?: NotifyCategory): Promise<boolean> {
    if (!category) return true;
    if (!this.switches || Date.now() - this.switches.at > 60_000) {
      const doc = await this.conn.collection('site_settings').findOne({ key: 'site' }).catch(() => null);
      this.switches = { at: Date.now(), value: (doc ?? {}) as Record<string, unknown> };
    }
    const v = this.switches.value[`notify${category}`];
    return v === undefined || v === null ? true : v === true || v === 'true';
  }

  /** "Name (Company) · 0300… · email · Lahore · Plan" with links to their profile and listings. */
  private async person(id: unknown): Promise<string> {
    const sid = String(id ?? '');
    if (!isValidObjectId(sid)) return sid ? `\`${sid}\`` : '—';
    const u: any = await this.conn
      .collection('users')
      .findOne(
        { _id: new Types.ObjectId(sid) },
        { projection: { name: 1, companyName: 1, email: 1, phone: 1, whatsappNumber: 1, role: 1, city: 1, agencyId: 1, isActive: 1 } },
      )
      .catch(() => null);
    if (!u) return `\`${sid}\` (account not found)`;
    const [city, sub] = await Promise.all([
      u.city ? this.conn.collection('cities').findOne({ _id: u.city }, { projection: { name: 1 } }).catch(() => null) : null,
      this.conn
        .collection('subscriptions')
        .find({ userId: { $in: [u._id, sid] }, status: 'active', endDate: { $gt: new Date() } }, { projection: { planName: 1, packageId: 1, endDate: 1 } })
        .sort({ endDate: -1 })
        .limit(1)
        .toArray()
        .then((r) => r[0])
        .catch(() => null),
    ]);
    let plan = (sub as any)?.planName as string | undefined;
    if (sub && !plan && isValidObjectId(String((sub as any).packageId))) {
      const pkg: any = await this.conn.collection('packages').findOne({ _id: new Types.ObjectId(String((sub as any).packageId)) }, { projection: { name: 1 } }).catch(() => null);
      plan = pkg?.name;
    }
    const name = u.companyName ? `${u.name || '—'} (${u.companyName})` : u.name || u.email || 'No name';
    const wa = String(u.whatsappNumber || u.phone || '').replace(/\D/g, '').replace(/^0/, '92');
    const label = slugify(String(u.companyName || u.name || ''));
    const lines = [
      `**${clip(name, 120)}**${u.isActive === false ? ' · ⛔ deactivated' : ''}${u.role === 'ADMIN' ? ' · admin' : ''}`,
      [u.phone && `📞 ${u.phone}`, wa && `[WhatsApp](https://wa.me/${wa})`, u.email && `✉️ ${u.email}`].filter(Boolean).join(' · '),
      [city && `📍 ${(city as any).name}`, `💼 ${plan || 'Free plan'}`, u.agencyId && 'agency agent'].filter(Boolean).join(' · '),
      [
        this.md('Profile', label ? `/agents/${label}-${sid}` : `/agents/${sid}`),
        this.md('Their listings', `/dashboard/property?ownerId=${sid}&owner=${encodeURIComponent(String(u.companyName || u.name || 'this agent'))}`),
        this.md('Account', `/dashboard/users?q=${encodeURIComponent(String(u.email || u.name || sid))}`),
      ].join(' · '),
    ];
    return lines.filter(Boolean).join('\n');
  }

  /**
   * Send an alert. Returns immediately — the caller does not await the network.
   */
  send(alert: DiscordAlert): void {
    void this.deliver(alert).catch((error) => this.logger.warn(`Discord alert "${alert.title}" failed: ${(error as Error).message}`));
  }

  /**
   * The same, for a single alert that should not repeat: the same key is sent
   * at most once per `minutes` (server errors, a hammered login).
   */
  sendOnce(key: string, minutes: number, alert: DiscordAlert): void {
    const now = Date.now();
    const last = this.recent.get(key);
    if (last && now - last < minutes * 60_000) return;
    this.recent.set(key, now);
    if (this.recent.size > 500) for (const [k, t] of this.recent) if (now - t > 3_600_000) this.recent.delete(k);
    this.send(alert);
  }

  /** Awaited delivery — for "Send a test message" in the dashboard. */
  async deliver(alert: DiscordAlert, force = false): Promise<boolean> {
    const webhook = this.webhook();
    if (!webhook) return false; // Not configured: silently off, by design.
    if (!force && !(await this.enabled(alert.category))) return false;

    const people = await Promise.all(
      (alert.who ?? []).filter((w) => w.id).map(async (w) => ({ name: w.label, value: await this.person(w.id), inline: false })),
    );
    const links = (alert.links ?? []).filter((l) => l.url);
    const fields = [
      ...(alert.fields ?? []),
      ...people,
      ...(links.length ? [{ name: '🔗 Open', value: links.map((l) => this.md(l.label, l.url)).join(' · '), inline: false }] : []),
    ];

    const embed = {
      title: alert.title.slice(0, 250),
      description: alert.description?.slice(0, 1500),
      url: alert.url ? this.link(alert.url) : undefined,
      color: alert.color ?? DISCORD_COLORS.info,
      fields: fields.slice(0, 25).map((field) => ({
        name: field.name.slice(0, 250),
        value: (field.value || '—').slice(0, 1000),
        inline: field.inline ?? true,
      })),
      ...(alert.image ? { thumbnail: { url: this.link(alert.image) } } : {}),
      footer: { text: alert.category ? `propertydealer.pk · ${alert.category}` : 'propertydealer.pk' },
      timestamp: new Date().toISOString(),
    };

    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'Property Dealer', embeds: [embed] }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      this.logger.warn(`Discord webhook answered ${response.status} for "${alert.title}"`);
      return false;
    }
    return true;
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

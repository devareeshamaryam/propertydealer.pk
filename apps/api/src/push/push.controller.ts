import { BadRequestException, Body, Controller, Delete, Get, Header, Headers, HttpCode, NotFoundException, Param, Patch, Post, Put, Request, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { PushIconService } from './push-icon.service';
import { Throttle } from '@nestjs/throttler';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';
import { Model, Types } from 'mongoose';
import { User } from '@rent-ghar/db/schemas/user.schema';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { newPushId, PushCoreService } from './push-core.service';
import { PUSH_CATEGORIES, renderTemplate } from './push.config';

/*
 * Browsers subscribe through their vendor's push service. Only those hosts
 * are accepted — otherwise anyone could register an internal address and
 * make this server send requests to it. PUSH_ENDPOINT_HOSTS adds more.
 */
const PUSH_HOSTS = [
  'fcm.googleapis.com', 'android.googleapis.com', // Chrome, Android, Samsung, Opera
  'updates.push.services.mozilla.com', 'push.services.mozilla.com', // Firefox
  'web.push.apple.com', // Safari, iPhone home-screen apps
  'notify.windows.com', // Edge
  ...(process.env.PUSH_ENDPOINT_HOSTS || '').split(',').map((h) => h.trim()).filter(Boolean),
];
function validEndpoint(u: unknown): string | null {
  if (typeof u !== 'string' || u.length > 1024) return null;
  try {
    const url = new URL(u);
    if (url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase();
    if (PUSH_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return u;
    if (process.env.PUSH_TEST_ENDPOINTS === '1' && (host === 'localhost' || host === '127.0.0.1')) return u;
  } catch {
    /* fall through */
  }
  return null;
}
const b64url = (v: unknown, min: number, max: number) => (typeof v === 'string' && v.length >= min && v.length <= max && /^[A-Za-z0-9_-]+=*$/.test(v) ? v : null);
const oid = (v: unknown) => (typeof v === 'string' && Types.ObjectId.isValid(v) ? new Types.ObjectId(v) : null);

function parseUA(s: string) {
  const browser = /EdgA?\//.test(s) ? 'Edge' : /SamsungBrowser\//.test(s) ? 'Samsung Internet' : /OPR\/|Opera/.test(s) ? 'Opera' : /Firefox\/|FxiOS\//.test(s) ? 'Firefox' : /CriOS\/|Chrome\//.test(s) ? 'Chrome' : /Safari\//.test(s) ? 'Safari' : 'Other';
  const os = /Android/.test(s) ? 'Android' : /iPhone|iPad|iPod/.test(s) ? 'iOS' : /Windows/.test(s) ? 'Windows' : /Mac OS X|Macintosh/.test(s) ? 'macOS' : /CrOS/.test(s) ? 'ChromeOS' : /Linux/.test(s) ? 'Linux' : 'Other';
  const device: 'mobile' | 'tablet' | 'desktop' = /iPad|Tablet/.test(s) || (/Android/.test(s) && !/Mobile/.test(s)) ? 'tablet' : /Mobi|iPhone|Android/.test(s) ? 'mobile' : 'desktop';
  return { browser, os, device };
}

/**
 * The browser side of push: config, subscribing (signed in or not), the
 * service worker's delivered/tapped beacons, and a person's own settings.
 */
@Controller('push')
export class PushController {
  private readonly jwt = new JwtService({ secret: process.env.JWT_SECRET });

  constructor(
    private readonly core: PushCoreService,
    private readonly icons: PushIconService,
    @InjectModel(User.name) private readonly users: Model<any>,
  ) {}

  /** The signed-in user, if the request carries a valid token; never throws. */
  private viewer(auth?: string): { userId: string; role: string } | null {
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return null;
    try {
      const p: any = this.jwt.verify(token);
      return p?.sub ? { userId: String(p.sub), role: String(p.role || 'USER') } : null;
    } catch {
      return null;
    }
  }

  /** On a paid plan — their own, or their agency's. */
  private async isPaid(userId: string): Promise<boolean> {
    const u: any = await this.users.findById(userId).select('agencyId').lean().exec();
    const owner = u?.agencyId ? String(u.agencyId) : userId;
    const ids = [owner, ...(Types.ObjectId.isValid(owner) ? [new Types.ObjectId(owner)] : [])];
    return !!(await this.users.db
      .collection('subscriptions')
      .findOne({ userId: { $in: ids }, status: 'active', amount: { $gt: 0 }, $or: [{ endDate: null }, { endDate: { $gt: new Date() } }] }, { projection: { _id: 1 } }));
  }

  /** The notification icon and the status-bar badge, made from the site's current icon. */
  @Get(['icon.png', 'badge.png'])
  async icon(@Request() req, @Res() res: Response) {
    const kind = String(req.path || req.url).includes('badge') ? 'badge' : 'icon';
    const png = await this.icons.render(kind, (await this.core.config()).icon);
    if (!png) throw new NotFoundException('No site icon to make it from');
    res.setHeader('Content-Type', 'image/png');
    // The URL carries ?v= of the source: safe to keep for a day.
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    res.end(png);
  }

  @Get('config')
  @Header('Cache-Control', 'public, max-age=60, stale-while-revalidate=600')
  async config() {
    const [{ cfg, siteName, icon }, key] = await Promise.all([this.core.load(), this.core.publicKey()]);
    const t = (s: string) => renderTemplate(s, {}, siteName);
    return {
      enabled: cfg.enabled && !!key,
      publicKey: key,
      siteName,
      icon,
      prompt: {
        ...cfg.prompt,
        title: t(cfg.prompt.title),
        body: t(cfg.prompt.body),
        contexts: Object.fromEntries(Object.entries(cfg.prompt.contexts).map(([k, v]) => [k, { title: t(v.title), body: t(v.body) }])),
        excludePaths: cfg.prompt.excludePaths.split(',').map((s) => s.trim()).filter(Boolean),
      },
    };
  }

  /**
   * A browser allowed notifications, or checks in. Signed in: the device is
   * (re)linked to that account. What the device has been browsing comes with
   * it, for "new in your area" and price drops.
   */
  @Post('subscribe')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async subscribe(@Body() b: any, @Headers('authorization') auth?: string, @Headers('user-agent') ua?: string, @Headers('accept-language') lang?: string) {
    const endpoint = validEndpoint(b?.subscription?.endpoint);
    const p256dh = b64url(b?.subscription?.keys?.p256dh, 80, 100);
    const authKey = b64url(b?.subscription?.keys?.auth, 16, 30);
    if (!endpoint || !p256dh || !authKey) throw new BadRequestException('Invalid subscription');

    const me = this.viewer(auth);
    const user: any = me ? await this.users.findById(me.userId).select('role pushOff city isActive').lean().exec() : null;

    // What this device has been looking at (newest first, one per area and purpose, at most 10).
    const interests: any[] = [];
    for (const i of Array.isArray(b?.interests) ? b.interests.slice(0, 20) : []) {
      const areaId = oid(i?.areaId);
      if (!areaId) continue;
      const purpose = i?.purpose === 'rent' ? 'rent' : i?.purpose === 'sale' ? 'sale' : '';
      if (interests.some((x) => String(x.areaId) === String(areaId) && x.purpose === purpose)) continue;
      interests.push({ areaId, area: String(i?.area || '').slice(0, 80), cityId: oid(i?.cityId), purpose, type: String(i?.type || '').toLowerCase().slice(0, 30), at: new Date(Number(i?.at) || Date.now()) });
      if (interests.length >= 10) break;
    }
    const viewed = (Array.isArray(b?.viewed) ? b.viewed : []).map(oid).filter(Boolean).slice(0, 30);
    const cityId = interests.find((i) => i.cityId)?.cityId || (user?.city && Types.ObjectId.isValid(String(user.city)) ? new Types.ObjectId(String(user.city)) : null);
    const city = cityId ? ((await this.users.db.collection('cities').findOne({ _id: cityId }, { projection: { name: 1 } })) as any)?.name || null : null;

    const set: Record<string, unknown> = {
      endpoint,
      keys: { p256dh, auth: authKey },
      status: 'active',
      endedAt: null,
      failCount: 0,
      lastSeenAt: new Date(),
      ...parseUA(ua || ''),
      lang: (lang || '').split(',')[0]!.trim().slice(0, 12) || null,
      ...(interests.length ? { interests } : {}),
      ...(viewed.length ? { viewed } : {}),
      ...(cityId ? { cityId, city } : {}),
    };
    // Signed in: the device belongs to this account now. Signed out leaves it alone — signing out detaches it (PATCH).
    if (user && user.isActive !== false) {
      const off: string[] = user.pushOff || [];
      Object.assign(set, { userId: user._id, role: user.role || 'USER', paid: await this.isPaid(String(user._id)), promoOff: off.includes('promotions'), alertsOff: off.includes('alerts') });
    }

    // The browser rotated its subscription: move the old record across.
    const old = validEndpoint(b?.oldEndpoint);
    if (old && old !== endpoint) {
      if (!(await this.core.subscribers.exists({ endpoint }))) await this.core.subscribers.updateOne({ endpoint: old }, { $set: { endpoint } });
      else await this.core.subscribers.updateOne({ endpoint: old, status: 'active' }, { $set: { status: 'expired', endedAt: new Date() } });
    }

    const before: any = await this.core.subscribers.findOne({ endpoint }).select('status').lean().exec();
    await this.core.subscribers.updateOne({ endpoint }, { $set: set, $setOnInsert: { source: String(b?.source || 'prompt').slice(0, 20) } }, { upsert: true });
    const isNew = !before || before.status !== 'active';
    if (isNew) {
      this.core.bump('subscriber', { subscribed: 1 });
      if (!['sync', 'rotate'].includes(String(b?.source))) void this.welcome(endpoint, p256dh, authKey);
    }
    return { success: true, new: isNew };
  }

  /** One welcome push, only to the device that just allowed notifications. */
  private async welcome(endpoint: string, p256dh: string, auth: string) {
    try {
      const { cfg, siteName, icon, badge } = await this.core.load();
      if (!cfg.enabled || !cfg.auto.welcome?.enabled) return;
      if (!(await this.core.once(`welcome:${createHash('sha1').update(endpoint).digest('hex')}`, 24 * 365))) return;
      const r = await this.core.sendBatch([{ endpoint, keys: { p256dh, auth } }], {
        title: renderTemplate(cfg.auto.welcome.title, {}, siteName),
        body: renderTemplate(cfg.auto.welcome.body, {}, siteName),
        url: '/',
        icon,
        badge,
        type: 'welcome',
        id: newPushId(),
      }, { urgency: 'high' });
      this.core.bump('welcome', { sent: r.sent, failed: r.failed + r.removed });
    } catch {
      /* best effort */
    }
  }

  /** Signing out on this device: it stops getting this account's notifications. */
  @Patch('subscribe')
  async detach(@Body() b: any) {
    const endpoint = validEndpoint(b?.endpoint);
    if (!endpoint || !b?.detach) throw new BadRequestException('Which device?');
    await this.core.subscribers.updateOne({ endpoint }, { $set: { userId: null, role: null, paid: false, promoOff: false, alertsOff: false } });
    return { success: true };
  }

  /** Notifications turned off on this device. */
  @Delete('subscribe')
  async unsubscribe(@Body() b: any) {
    const endpoint = validEndpoint(b?.endpoint);
    if (!endpoint) throw new BadRequestException('Which device?');
    const r = await this.core.subscribers.updateOne({ endpoint, status: 'active' }, { $set: { status: 'unsubscribed', endedAt: new Date() } });
    if (r.modifiedCount) this.core.bump('subscriber', { unsubscribed: 1 });
    return { success: true };
  }

  /** The service worker: a notification was shown, tapped or dismissed. Each device's event counts once. */
  private seen = new Map<string, number>();
  @Post('track')
  @HttpCode(200)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  track(@Body() b: any) {
    const field = ({ delivered: 'delivered', click: 'clicked', close: 'closed' } as const)[b?.e as 'delivered' | 'click' | 'close'];
    const id = typeof b?.id === 'string' ? b.id.slice(0, 40) : '';
    if (!field || !id) return { ok: false };
    const who = typeof b?.endpoint === 'string' ? b.endpoint.slice(-64) : 'anon';
    const key = `${who}|${id}|${field}`;
    if (this.seen.has(key)) return { ok: true };
    this.seen.set(key, Date.now());
    if (this.seen.size > 100_000) this.seen.delete(this.seen.keys().next().value as string);
    const type = typeof b?.t === 'string' && /^[a-z_]{2,30}$/.test(b.t) ? b.t : 'campaign';
    this.core.bump(type, { [field]: 1 });
    if (typeof b?.c === 'string' && Types.ObjectId.isValid(b.c)) this.core.bumpCampaign(b.c, { [field]: 1 });
    if (field === 'clicked' && typeof b?.endpoint === 'string' && b.endpoint.length < 1024) this.core.bumpClick(b.endpoint);
    return { ok: true };
  }

  /* ── my settings ── */

  @Get('prefs')
  @UseGuards(JwtAuthGuard)
  @Header('Cache-Control', 'no-store')
  async prefs(@Request() req) {
    const uid = new Types.ObjectId(req.user.userId);
    const [user, devices] = await Promise.all([
      this.users.findById(uid).select('pushOff role').lean().exec() as Promise<any>,
      this.core.subscribers.find({ userId: uid, status: 'active' }).sort({ lastSeenAt: -1 }).select('browser os device city createdAt lastSeenAt endpoint').lean().exec(),
    ]);
    const admin = user?.role === 'ADMIN';
    return {
      categories: Object.entries(PUSH_CATEGORIES).filter(([, c]) => admin || !c.adminOnly).map(([id, c]) => ({ id, label: c.label, hint: c.hint })),
      off: user?.pushOff || [],
      devices: (devices as any[]).map((d) => ({
        id: String(d._id),
        browser: d.browser,
        os: d.os,
        device: d.device,
        place: d.city || '',
        since: d.createdAt,
        lastSeen: d.lastSeenAt,
        // Lets the page mark "this device" without sending the other endpoints.
        tail: String(d.endpoint).slice(-24),
      })),
    };
  }

  @Put('prefs')
  @UseGuards(JwtAuthGuard)
  async savePrefs(@Request() req, @Body() b: any) {
    const off = Array.isArray(b?.off) ? [...new Set<string>(b.off.map(String).filter((k: string) => k in PUSH_CATEGORIES))] : [];
    const uid = new Types.ObjectId(req.user.userId);
    await Promise.all([
      this.users.updateOne({ _id: uid }, { $set: { pushOff: off } }).exec(),
      this.core.subscribers.updateMany({ userId: uid }, { $set: { promoOff: off.includes('promotions'), alertsOff: off.includes('alerts') } }).exec(),
    ]);
    return { success: true, off };
  }

  @Delete('prefs/devices/:id')
  @UseGuards(JwtAuthGuard)
  async removeDevice(@Request() req, @Param('id') id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Which device?');
    const r = await this.core.subscribers.updateOne({ _id: id, userId: new Types.ObjectId(req.user.userId), status: 'active' }, { $set: { status: 'unsubscribed', endedAt: new Date() } });
    if (r.modifiedCount) this.core.bump('subscriber', { unsubscribed: 1 });
    return { success: true };
  }

  /** "Send me a test": every active device of mine. */
  @Post('test')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async test(@Request() req) {
    const { siteName, icon, badge } = await this.core.load();
    const subs = await this.core.subscribers.find({ userId: new Types.ObjectId(req.user.userId), status: 'active' }).select('endpoint keys').lean().exec();
    if (!subs.length) return { success: false, message: 'Notifications are not on for any of your devices yet.' };
    const r = await this.core.sendBatch(subs as any, { title: `Test from ${siteName}`, body: 'Notifications work on this device.', url: '/dashboard/push-settings', icon, badge, type: 'test', id: newPushId() }, { urgency: 'high', ttlSec: 3600 });
    return { success: r.sent > 0, sent: r.sent, devices: subs.length };
  }
}

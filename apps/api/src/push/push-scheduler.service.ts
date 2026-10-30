import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PushJob, PushJobDocument } from '@rent-ghar/db/schemas/push.schema';
import { Property } from '@rent-ghar/db/schemas/property.schema';
import { PushCoreService } from './push-core.service';
import { PushService } from './push.service';
import { PushCampaignService } from './push-campaign.service';
import { localHour } from './push.config';

const slug = (s: string) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const PLURAL: Record<string, string> = { house: 'houses', plot: 'plots', flat: 'flats', apartment: 'flats', shop: 'shops', office: 'offices', 'upper portion': 'portions', 'lower portion': 'portions', room: 'rooms', farmhouse: 'farmhouses', penthouse: 'penthouses', building: 'buildings', warehouse: 'warehouses', 'commercial plot': 'commercial plots', 'residential plot': 'plots' };
const what = (type: string, purpose: string, n: number) => {
  const t = String(type || '').toLowerCase();
  const word = n === 1 ? t || 'property' : PLURAL[t] || (t ? `${t}s` : 'properties');
  return `${word} for ${purpose === 'rent' ? 'rent' : 'sale'}`;
};

/**
 * Background push work, every 15 seconds (one tick at a time per process;
 * every step is safe with several API processes):
 *   - campaigns that are due, or whose sender stopped (resumed);
 *   - automatic pushes held back by quiet hours;
 *   - every 30 minutes: listings and plans ending soon, or just ended;
 *   - once a day at the alert hour: "N new houses for rent in Johar Town" to
 *     each device that has been looking there (one alert a day at most);
 *   - once a day: devices that keep failing are retired.
 * AUTO_SETUP=false, or PUSH_WORKER=0 on web-only processes, switches it off.
 */
@Injectable()
export class PushSchedulerService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('Push');
  private timer?: NodeJS.Timeout;
  private busy = false;
  private lastReminders = 0;
  private lastHygiene = 0;

  constructor(
    private readonly core: PushCoreService,
    private readonly push: PushService,
    private readonly campaigns: PushCampaignService,
    @InjectModel(PushJob.name) private readonly jobs: Model<PushJobDocument>,
    @InjectModel(Property.name) private readonly properties: Model<Property>,
  ) {}

  onApplicationBootstrap() {
    if ((process.env.AUTO_SETUP ?? 'true').toLowerCase() === 'false' || process.env.PUSH_WORKER === '0') return;
    this.timer = setInterval(() => void this.tick(), 15_000);
    this.timer.unref?.();
    setTimeout(() => void this.tick(), 20_000).unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Run now (right after an admin presses Send). */
  kick() {
    if (process.env.PUSH_WORKER !== '0') void this.tick();
  }

  async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      if (!(await this.core.publicKey())) return;
      while (await this.campaigns.runNext()) {
        /* next campaign */
      }
      await this.sendHeld();
      const now = Date.now();
      if (now - this.lastReminders > 30 * 60_000) {
        this.lastReminders = now;
        await this.reminders();
        await this.areaAlerts();
      }
      if (now - this.lastHygiene > 24 * 3_600_000) {
        this.lastHygiene = now;
        await this.core.subscribers.updateMany({ status: 'active', failCount: { $gte: 15 } }, { $set: { status: 'invalid', endedAt: new Date() } });
      }
    } catch (e: any) {
      this.logger.warn(`tick failed: ${e?.message}`);
    } finally {
      this.busy = false;
    }
  }

  private async sendHeld() {
    const now = new Date();
    const free = { $or: [{ lockedUntil: null }, { lockedUntil: { $lt: now } }] };
    const due = await this.jobs.find({ sendAt: { $lte: now }, ...free }).sort({ sendAt: 1 }).limit(300).select('_id').lean().exec();
    if (!due.length) return;
    const claim = new Date(now.getTime() + 5 * 60_000);
    await this.jobs.updateMany({ _id: { $in: due.map((d) => d._id) }, ...free }, { $set: { lockedUntil: claim } });
    const mine: any[] = await this.jobs.find({ _id: { $in: due.map((d) => d._id) }, lockedUntil: claim }).lean().exec();
    for (const j of mine) {
      await this.push.toUsers([j.userId], { type: j.type, vars: j.vars, url: j.url || '/', image: j.image, icon: j.icon, tag: j.tag }, true).catch(() => undefined);
    }
    await this.jobs.deleteMany({ _id: { $in: mine.map((j) => j._id) } });
  }

  /** Listings (Free plan) and plans ending within the reminder window, or ended in the last 3 days. Each once. */
  private async reminders() {
    const cfg = await this.core.config();
    const now = Date.now();
    const soon = new Date(now + cfg.remindDays * 86_400_000);
    const when = (d: Date) => {
      const days = Math.round((new Date(d).getTime() - now) / 86_400_000);
      return days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
    };
    const col = this.properties.collection;

    const ending = await col
      .find({ status: 'approved', expiresAt: { $gt: new Date(now + 3_600_000), $lte: soon } }, { projection: { title: 1, slug: 1, owner: 1, expiresAt: 1, mainPhotoUrl: 1 } })
      .limit(2000)
      .toArray();
    for (const l of ending as any[]) {
      if (!(await this.core.once(`expiring:${l._id}:${new Date(l.expiresAt).getTime()}`, 24 * 40))) continue;
      await this.push.toUsers([l.owner], { type: 'listing_expiring', vars: { listing: String(l.title || '').slice(0, 80), when: when(l.expiresAt) }, url: '/dashboard/property', tag: `listing:${l._id}`, icon: l.mainPhotoUrl || null });
    }

    const ended = await col
      .find({ status: 'expired', expiresAt: { $gte: new Date(now - 3 * 86_400_000), $lte: new Date(now) } }, { projection: { title: 1, owner: 1, expiresAt: 1, mainPhotoUrl: 1 } })
      .limit(2000)
      .toArray();
    for (const l of ended as any[]) {
      if (!(await this.core.once(`expired:${l._id}:${new Date(l.expiresAt).getTime()}`, 24 * 40))) continue;
      await this.push.toUsers([l.owner], { type: 'listing_expired', vars: { listing: String(l.title || '').slice(0, 80) }, url: '/dashboard/property', tag: `listing:${l._id}`, icon: l.mainPhotoUrl || null });
    }

    const subs = this.properties.db.collection('subscriptions');
    const plans = await subs
      .find({ status: { $in: ['active', 'expired'] }, endDate: { $gte: new Date(now - 3 * 86_400_000), $lte: soon } }, { projection: { userId: 1, endDate: 1, planName: 1, amount: 1, status: 1 } })
      .limit(2000)
      .toArray();
    for (const s of plans as any[]) {
      if (!s.amount) continue; // the Free plan does not end
      const end = new Date(s.endDate);
      const past = end.getTime() <= now;
      if (!past && s.status !== 'active') continue;
      if (!(await this.core.once(`plan:${past ? 'ended' : 'ending'}:${s._id}:${end.getTime()}`, 24 * 40))) continue;
      await this.push.toUsers([s.userId], past
        ? { type: 'plan_expired', vars: { plan: s.planName || 'paid' }, url: '/packages' }
        : { type: 'plan_expiring', vars: { plan: s.planName || 'paid', when: when(end) }, url: '/packages' });
    }
  }

  /**
   * "N new houses for rent in Johar Town": once a day at the alert hour. New
   * listings of the last 24 hours, grouped by area, purpose and type; each
   * device gets the biggest group among the areas it has been looking at.
   */
  private async areaAlerts() {
    const cfg = await this.core.config();
    if (!cfg.enabled || !cfg.auto.new_in_area?.enabled) return;
    if (localHour(cfg.timezone) !== cfg.alertHour) return;
    const day = this.core.today(cfg);
    if (!(await this.core.once(`area-alerts:${day}`, 30))) return;

    const since = new Date(Date.now() - 24 * 3_600_000);
    const groups = await this.properties.collection
      .aggregate<{ _id: { area: Types.ObjectId; purpose: string; type: string }; n: number; one: any }>([
        { $match: { status: 'approved', createdAt: { $gte: since }, area: { $type: 'objectId' } } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: { area: '$area', purpose: '$listingType', type: { $toLower: '$propertyType' } }, n: { $sum: 1 }, one: { $first: { slug: '$slug', title: '$title', mainPhotoUrl: '$mainPhotoUrl', owner: '$owner' } } } },
        { $sort: { n: -1 } },
        { $limit: 500 },
      ])
      .toArray();
    if (!groups.length) return;

    const areaDocs = await this.properties.db.collection('areas').find({ _id: { $in: [...new Set(groups.map((g) => String(g._id.area)))].map((s) => new Types.ObjectId(s)) } }, { projection: { name: 1, areaSlug: 1, city: 1 } }).toArray();
    const cityIds = [...new Set(areaDocs.map((a: any) => String(a.city)).filter((s) => Types.ObjectId.isValid(s)))].map((s) => new Types.ObjectId(s));
    const cityDocs = await this.properties.db.collection('cities').find({ _id: { $in: cityIds } }, { projection: { name: 1 } }).toArray();
    const cityName = new Map(cityDocs.map((c: any) => [String(c._id), String(c.name)]));
    const areas = new Map(areaDocs.map((a: any) => [String(a._id), a]));

    const done = new Set<string>();
    let sent = 0;
    for (const g of groups) {
      const area: any = areas.get(String(g._id.area));
      if (!area) continue;
      const purpose = g._id.purpose === 'rent' ? 'rent' : 'sale';
      const devices: any[] = await this.core.subscribers
        .find({
          status: 'active',
          alertsOff: { $ne: true },
          alertDay: { $ne: day },
          interests: { $elemMatch: { areaId: g._id.area, $or: [{ purpose }, { purpose: { $in: [null, ''] } }] } },
        })
        .select('endpoint keys userId')
        .limit(20_000)
        .lean()
        .exec();
      const owner = g.one?.owner ? String(g.one.owner) : '';
      const fresh = devices.filter((d) => !done.has(d.endpoint) && !(owner && d.userId && String(d.userId) === owner));
      if (!fresh.length) continue;
      fresh.forEach((d) => done.add(d.endpoint));
      await this.core.subscribers.updateMany({ endpoint: { $in: fresh.map((d) => d.endpoint) } }, { $set: { alertDay: day } });
      const city = cityName.get(String(area.city)) || '';
      const url = g.n === 1 && g.one?.slug ? `/properties/${g.one.slug}` : `/properties/${purpose}/${slug(city)}/${area.areaSlug}`;
      const r = await this.push.toDevices(fresh, {
        type: 'new_in_area',
        vars: { count: g.n, what: what(g._id.type, purpose, g.n), area: area.name ? String(area.name).replace(/\b\w/g, (c) => c.toUpperCase()) : 'your area' },
        url,
        tag: `area:${day}`,
        icon: g.one?.mainPhotoUrl || null,
      });
      sent += r.sent;
    }
    if (sent) this.logger.log(`New-in-your-area alerts: ${sent} sent`);
  }
}

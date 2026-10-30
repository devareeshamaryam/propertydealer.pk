import { BadRequestException, Body, Controller, Delete, Get, Header, NotFoundException, Param, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PushStat, PushStatDocument } from '@rent-ghar/db/schemas/push.schema';
import { User } from '@rent-ghar/db/schemas/user.schema';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { PushCoreService } from './push-core.service';
import { PushCampaignService } from './push-campaign.service';
import { PushSchedulerService } from './push-scheduler.service';
import { AUTO_TYPES, CAMPAIGN_TEMPLATES, DEFAULT_PUSH_CONFIG, PUSH_CATEGORIES, dayKey } from './push.config';

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Dashboard → Push notifications. Admin only. */
@Controller('push/admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class PushAdminController {
  constructor(
    private readonly core: PushCoreService,
    private readonly campaigns: PushCampaignService,
    private readonly scheduler: PushSchedulerService,
    @InjectModel(PushStat.name) private readonly stats: Model<PushStatDocument>,
    @InjectModel(User.name) private readonly users: Model<any>,
  ) {}

  /** Devices, growth, where and on what, and what was sent / shown / tapped. */
  @Get('overview')
  @Header('Cache-Control', 'no-store')
  async overview(@Query('days') daysQ?: string) {
    const days = Math.max(7, Math.min(90, Number(daysQ) || 30));
    const cfg = await this.core.config();
    const since = new Date(Date.now() - days * 86_400_000);
    const sinceDay = dayKey(cfg.timezone, since);
    const S = this.core.subscribers;
    const active = { status: 'active' };
    const group = (field: string, limit = 8) =>
      S.aggregate([{ $match: active }, { $group: { _id: `$${field}`, n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: limit }]).exec();
    const [total, signedIn, agents, paid, guests, newN, lost, byCity, byBrowser, byDevice, byOs, daily, byType, topAreas, key] = await Promise.all([
      S.countDocuments(active),
      S.countDocuments({ ...active, userId: { $ne: null } }),
      S.countDocuments({ ...active, role: 'AGENT' }),
      S.countDocuments({ ...active, paid: true }),
      S.countDocuments({ ...active, userId: null }),
      S.countDocuments({ createdAt: { $gte: since } }),
      S.countDocuments({ endedAt: { $gte: since } }),
      group('city'),
      group('browser'),
      group('device', 3),
      group('os'),
      this.stats.aggregate([{ $match: { day: { $gte: sinceDay } } }, { $group: { _id: '$day', sent: { $sum: '$sent' }, delivered: { $sum: '$delivered' }, clicked: { $sum: '$clicked' }, subscribed: { $sum: '$subscribed' }, unsubscribed: { $sum: '$unsubscribed' } } }, { $sort: { _id: 1 } }]).exec(),
      this.stats.aggregate([{ $match: { day: { $gte: sinceDay }, type: { $nin: ['subscriber'] } } }, { $group: { _id: '$type', sent: { $sum: '$sent' }, delivered: { $sum: '$delivered' }, clicked: { $sum: '$clicked' }, failed: { $sum: '$failed' } } }, { $sort: { sent: -1 } }]).exec(),
      S.aggregate([{ $match: active }, { $unwind: '$interests' }, { $group: { _id: '$interests.area', n: { $sum: 1 } } }, { $match: { _id: { $nin: [null, ''] } } }, { $sort: { n: -1 } }, { $limit: 8 }]).exec(),
      this.core.publicKey(),
    ]);
    const label = (rows: any[]) => rows.map((r) => ({ label: r._id || 'Unknown', n: r.n }));
    return {
      ready: !!key,
      totals: { total, signedIn, guests, agents, paid, newN, lost, days },
      byCity: label(byCity),
      byBrowser: label(byBrowser),
      byDevice: label(byDevice),
      byOs: label(byOs),
      topAreas: label(topAreas),
      daily,
      byType: byType.map((t: any) => ({ ...t, label: t._id === 'campaign' ? 'Campaigns' : AUTO_TYPES[t._id]?.label || t._id })),
    };
  }

  @Get('settings')
  @Header('Cache-Control', 'no-store')
  async settings() {
    return {
      config: await this.core.config(),
      defaults: DEFAULT_PUSH_CONFIG,
      types: Object.entries(AUTO_TYPES).map(([id, d]) => ({ id, label: d.label, to: d.to, category: d.category, vars: d.vars })),
      categories: PUSH_CATEGORIES,
      templates: CAMPAIGN_TEMPLATES,
    };
  }

  @Put('settings')
  async saveSettings(@Body() body: any) {
    return { config: await this.core.saveConfig(body?.config ?? body) };
  }

  @Get('subscribers')
  @Header('Cache-Control', 'no-store')
  async subscribers(@Query('page') pageQ?: string, @Query('status') status?: string, @Query('who') who?: string, @Query('q') q?: string) {
    const page = Math.max(1, Number(pageQ) || 1);
    const f: Record<string, any> = { status: ['expired', 'invalid', 'unsubscribed', 'all'].includes(String(status)) ? status : 'active' };
    if (f.status === 'all') delete f.status;
    if (who === 'users') f.userId = { $ne: null };
    else if (who === 'guests') f.userId = null;
    else if (who === 'agents') f.role = 'AGENT';
    else if (who === 'paid') f.paid = true;
    if (q?.trim()) {
      const rx = new RegExp(esc(q.trim()).slice(0, 60), 'i');
      const ids = (await this.users.find({ $or: [{ name: rx }, { email: rx }, { companyName: rx }, { phone: rx }] }).select('_id').limit(200).lean().exec()).map((u: any) => u._id);
      f.$or = [{ userId: { $in: ids } }, { city: rx }, { 'interests.area': rx }];
    }
    const [rows, total] = await Promise.all([
      this.core.subscribers.find(f).sort({ lastSeenAt: -1 }).skip((page - 1) * 50).limit(50).populate('userId', 'name email companyName phone').select('-keys -viewed').lean().exec(),
      this.core.subscribers.countDocuments(f),
    ]);
    return {
      total,
      page,
      pages: Math.max(1, Math.ceil(total / 50)),
      rows: rows.map((r: any) => ({
        _id: String(r._id),
        user: r.userId ? { _id: String(r.userId._id), name: r.userId.companyName || r.userId.name, email: r.userId.email, phone: r.userId.phone } : null,
        role: r.role,
        paid: r.paid,
        city: r.city,
        areas: (r.interests || []).slice(0, 3).map((i: any) => [i.area, i.purpose].filter(Boolean).join(' · ')),
        browser: r.browser,
        os: r.os,
        device: r.device,
        source: r.source,
        status: r.status,
        sentCount: r.sentCount,
        clickCount: r.clickCount,
        createdAt: r.createdAt,
        lastSeenAt: r.lastSeenAt,
        lastClickAt: r.lastClickAt,
      })),
    };
  }

  /** Cities, the areas devices look at, and people — for the audience picker. */
  @Get('options')
  @Header('Cache-Control', 'no-store')
  async options(@Query('q') q?: string, @Query('kind') kind?: string) {
    const rx = q?.trim() ? new RegExp(esc(q.trim()).slice(0, 60), 'i') : null;
    if (kind === 'users') {
      if (!rx) return { users: [] };
      const users = await this.users.find({ $or: [{ name: rx }, { email: rx }, { companyName: rx }, { phone: rx }] }).select('name email companyName').limit(20).lean().exec();
      return { users: users.map((u: any) => ({ _id: String(u._id), name: u.companyName || u.name || u.email, email: u.email })) };
    }
    if (kind === 'areas') {
      const rows = await this.core.subscribers
        .aggregate([{ $match: { status: 'active' } }, { $unwind: '$interests' }, ...(rx ? [{ $match: { 'interests.area': rx } }] : []), { $group: { _id: '$interests.areaId', area: { $first: '$interests.area' }, n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 30 }])
        .exec();
      return { areas: rows.filter((r: any) => r._id).map((r: any) => ({ _id: String(r._id), name: r.area || 'Area', n: r.n })) };
    }
    const cities = await this.core.subscribers.aggregate([{ $match: { status: 'active', cityId: { $ne: null } } }, { $group: { _id: '$cityId', name: { $first: '$city' }, n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 50 }]).exec();
    return { cities: cities.map((c: any) => ({ _id: String(c._id), name: c.name || 'City', n: c.n })) };
  }

  @Post('estimate')
  async estimate(@Body() body: any) {
    return { count: await this.campaigns.estimate(body?.audience ?? body) };
  }

  /* ── campaigns ── */

  @Get('campaigns')
  @Header('Cache-Control', 'no-store')
  async list(@Query('page') pageQ?: string) {
    const page = Math.max(1, Number(pageQ) || 1);
    const [rows, total] = await Promise.all([
      this.campaigns.campaigns.find().sort({ createdAt: -1 }).skip((page - 1) * 30).limit(30).lean().exec(),
      this.campaigns.campaigns.countDocuments(),
    ]);
    return { rows, total, page, pages: Math.max(1, Math.ceil(total / 30)) };
  }

  @Get('campaigns/:id')
  @Header('Cache-Control', 'no-store')
  async one(@Param('id') id: string) {
    const c = Types.ObjectId.isValid(id) ? await this.campaigns.campaigns.findById(id).lean().exec() : null;
    if (!c) throw new NotFoundException('Campaign not found');
    return c;
  }

  /**
   * Create or edit. `action`: "draft" (save), "send" (now), "schedule" (at sendAt)
   * or "test" (to this admin's own devices only, nothing saved).
   */
  @Post('campaigns')
  async create(@Request() req, @Body() body: any) {
    return this.save(null, req, body);
  }

  @Put('campaigns/:id')
  async update(@Param('id') id: string, @Request() req, @Body() body: any) {
    return this.save(id, req, body);
  }

  private async save(id: string | null, req: any, body: any) {
    const { data, error } = this.campaigns.clean(body);
    if (!data) throw new BadRequestException(error);
    if (body?.action === 'test') {
      const r = await this.campaigns.test({ ...data, _id: id || 'test' }, req.user.userId);
      if (!r.devices) throw new BadRequestException('Notifications are not on in any of your browsers yet — allow them on this site first.');
      return { tested: r };
    }
    const action = ['send', 'schedule'].includes(body?.action) ? body.action : 'draft';
    let sendAt: Date | null = null;
    if (action === 'schedule') {
      sendAt = new Date(body?.sendAt);
      if (Number.isNaN(sendAt.getTime()) || sendAt.getTime() < Date.now() - 60_000) throw new BadRequestException('Pick a time in the future');
    }
    const status = action === 'draft' ? 'draft' : 'scheduled';
    const set = { ...data, status, sendAt: action === 'send' ? new Date() : sendAt };
    let doc: any;
    if (id) {
      const existing: any = await this.campaigns.campaigns.findById(id).select('status').lean().exec();
      if (!existing) throw new NotFoundException('Campaign not found');
      if (!['draft', 'scheduled', 'failed', 'cancelled'].includes(existing.status)) throw new BadRequestException('This campaign has already been sent — duplicate it instead.');
      doc = await this.campaigns.campaigns.findByIdAndUpdate(id, { $set: { ...set, cursor: null, error: null } }, { new: true }).lean().exec();
    } else {
      doc = (await this.campaigns.campaigns.create({ ...set, createdBy: new Types.ObjectId(req.user.userId) })).toObject();
    }
    if (action === 'send') this.scheduler.kick();
    return doc;
  }

  @Post('campaigns/:id/cancel')
  async cancel(@Param('id') id: string) {
    const r = await this.campaigns.campaigns.updateOne({ _id: id, status: { $in: ['scheduled', 'sending'] } }, { $set: { status: 'cancelled', lockedBy: null } }).exec();
    if (!r.modifiedCount) throw new BadRequestException('Only a scheduled or sending campaign can be stopped');
    return { success: true };
  }

  @Post('campaigns/:id/duplicate')
  async duplicate(@Param('id') id: string, @Request() req) {
    const c: any = await this.campaigns.campaigns.findById(id).lean().exec();
    if (!c) throw new NotFoundException('Campaign not found');
    const { _id, stats, status, sendAt, startedAt, finishedAt, heartbeatAt, lockedBy, cursor, error, createdAt, updatedAt, ...rest } = c;
    return (await this.campaigns.campaigns.create({ ...rest, name: `${c.name || c.title} (copy)`, status: 'draft', createdBy: new Types.ObjectId(req.user.userId) })).toObject();
  }

  @Delete('campaigns/:id')
  async remove(@Param('id') id: string) {
    const r = await this.campaigns.campaigns.deleteOne({ _id: id, status: { $ne: 'sending' } }).exec();
    if (!r.deletedCount) throw new BadRequestException('A campaign that is sending cannot be deleted — stop it first.');
    return { success: true };
  }
}

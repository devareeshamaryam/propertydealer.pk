import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PropertyRequest } from '@rent-ghar/db/schemas/property-request.schema';
import { DiscordService, DISCORD_COLORS } from '../notify/discord.service';

/**
 * "Find a property for me" requests: saved, announced on Discord, worked
 * through by the team in Dashboard → Property requests.
 *
 * Open to everyone (no account needed — that is the point of the page), so:
 * a real Pakistani mobile number, a hidden field bots fill in, and the same
 * number at most once in 10 minutes and 5 times a day.
 */

export const REQUEST_TYPES = ['any', 'house', 'plot', 'flat', 'upper-portion', 'lower-portion', 'commercial', 'shop', 'office', 'farmhouse', 'room'] as const;
export const REQUEST_TIMELINES = ['asap', '1month', '3months', 'exploring'] as const;
export const REQUEST_STATUSES = ['new', 'contacted', 'found', 'closed'] as const;

const TYPE_LABEL: Record<string, string> = {
  any: 'Any', house: 'House', plot: 'Plot', flat: 'Flat / Apartment', 'upper-portion': 'Upper portion', 'lower-portion': 'Lower portion',
  commercial: 'Commercial', shop: 'Shop', office: 'Office', farmhouse: 'Farmhouse', room: 'Room',
};
const TIMELINE_LABEL: Record<string, string> = { asap: 'Right away', '1month': 'Within a month', '3months': 'In 1–3 months', exploring: 'Just exploring' };

const text = (v: unknown, n: number) => String(v ?? '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const num = (v: unknown, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n <= max ? Math.round(n * 100) / 100 : null;
};

/** 03XXXXXXXXX from "+92 300 1234567", "0300-1234567", "3001234567"… or null. */
export function pkMobile(v: unknown): string | null {
  let d = String(v ?? '').replace(/\D/g, '');
  if (d.startsWith('0092')) d = d.slice(4);
  if (d.startsWith('92')) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  return /^3\d{9}$/.test(d) ? `0${d}` : null;
}

const money = (n: number | null) => {
  if (!n) return '';
  const t = (x: number) => String(Number(x.toFixed(2)));
  if (n >= 1e7) return `${t(n / 1e7)} Crore`;
  if (n >= 1e5) return `${t(n / 1e5)} Lakh`;
  return n.toLocaleString('en-PK');
};
const size = (m: number | null) => (!m ? '' : m >= 20 && m % 20 === 0 ? `${m / 20} Kanal` : `${m} Marla`);
const range = (a: string, b: string) => (a && b ? (a === b ? a : `${a} – ${b}`) : a ? `from ${a}` : b ? `up to ${b}` : '');

@Injectable()
export class PropertyRequestService {
  constructor(
    @InjectModel(PropertyRequest.name) private readonly requests: Model<PropertyRequest>,
    private readonly discord: DiscordService,
  ) {}

  async create(b: any, meta: { ip: string; userId?: string | null }) {
    // A hidden field only bots fill in: accept quietly, keep nothing.
    if (b?.website) return { ok: true };

    const name = text(b?.name, 80);
    const phone = pkMobile(b?.phone);
    if (name.length < 2) throw new BadRequestException('Please enter your name.');
    if (!phone) throw new BadRequestException('Please enter a valid mobile number, e.g. 0300 1234567.');

    const purpose = b?.purpose === 'rent' ? 'rent' : 'sale';
    const type = (REQUEST_TYPES as readonly string[]).includes(b?.type) ? String(b.type) : 'any';
    const city = text(b?.city, 60);
    const areas = text(b?.areas, 200);
    if (!city && !areas) throw new BadRequestException('Please tell us the city or area.');

    let minPrice = num(b?.minPrice, 5e10);
    let maxPrice = num(b?.maxPrice, 5e10);
    if (minPrice && maxPrice && minPrice > maxPrice) [minPrice, maxPrice] = [maxPrice, minPrice];
    let minMarla = num(b?.minMarla, 2000);
    let maxMarla = num(b?.maxMarla, 2000);
    if (minMarla && maxMarla && minMarla > maxMarla) [minMarla, maxMarla] = [maxMarla, minMarla];
    const beds = num(b?.beds, 20);
    const timeline = (REQUEST_TIMELINES as readonly string[]).includes(b?.timeline) ? String(b.timeline) : '';
    const notes = String(b?.notes ?? '').replace(/[<>]/g, '').trim().slice(0, 1000);

    // The same number: once per 10 minutes, five a day.
    const [recent, today] = await Promise.all([
      this.requests.exists({ phone, createdAt: { $gte: new Date(Date.now() - 10 * 60_000) } }),
      this.requests.countDocuments({ $or: [{ phone }, ...(meta.ip ? [{ ip: meta.ip }] : [])], createdAt: { $gte: new Date(Date.now() - 86_400_000) } }),
    ]);
    if (recent) return { ok: true, duplicate: true };
    if (today >= 5) throw new BadRequestException('We already have your requests for today — our team will call you soon.');

    const doc = await this.requests.create({
      name, phone, whatsapp: b?.whatsapp !== false, purpose, type, city, areas,
      minPrice, maxPrice, minMarla, maxMarla, beds, timeline, notes,
      userId: meta.userId && Types.ObjectId.isValid(meta.userId) ? new Types.ObjectId(meta.userId) : null,
      source: text(b?.source, 20) || 'page',
      ip: meta.ip.slice(0, 64),
    });

    const wa = `92${phone.slice(1)}`;
    this.discord.send({
      title: `🏠 Find-a-property request — ${purpose === 'rent' ? 'Rent' : 'Buy'} ${TYPE_LABEL[type] ?? type}`,
      description: [areas, city].filter(Boolean).join(', '),
      url: '/dashboard/property-requests',
      color: DISCORD_COLORS.listing,
      category: 'Requests',
      fields: [
        { name: '👤 Name', value: name, inline: true },
        { name: '📞 Phone', value: `${phone}${doc.whatsapp ? ' (WhatsApp)' : ''}`, inline: true },
        ...(minPrice || maxPrice ? [{ name: '💰 Budget', value: range(money(minPrice), money(maxPrice)), inline: true }] : []),
        ...(minMarla || maxMarla ? [{ name: '📐 Size', value: range(size(minMarla), size(maxMarla)), inline: true }] : []),
        ...(beds ? [{ name: '🛏 Bedrooms', value: `${beds}+`, inline: true }] : []),
        ...(timeline ? [{ name: '⏱ When', value: TIMELINE_LABEL[timeline] ?? timeline, inline: true }] : []),
        ...(notes ? [{ name: '📝 Notes', value: notes.slice(0, 900) }] : []),
      ],
      links: [
        { label: 'Open requests', url: '/dashboard/property-requests' },
        ...(doc.whatsapp ? [{ label: 'WhatsApp', url: `https://wa.me/${wa}` }] : []),
      ],
    });

    return { ok: true, id: String(doc._id) };
  }

  async list(status = 'new', page = 1, q = '') {
    const filter: Record<string, unknown> = {};
    if ((REQUEST_STATUSES as readonly string[]).includes(status)) filter.status = status;
    const term = String(q || '').trim().slice(0, 60);
    if (term) {
      const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: re }, { phone: re }, { city: re }, { areas: re }, { notes: re }];
    }
    const size = 30;
    const p = Math.max(1, Math.floor(page) || 1);
    const [rows, total, byStatus] = await Promise.all([
      this.requests.find(filter).sort({ createdAt: -1 }).skip((p - 1) * size).limit(size).select('-ip').lean().exec(),
      this.requests.countDocuments(filter),
      this.requests.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    ]);
    const counts: Record<string, number> = Object.fromEntries(byStatus.map((s: any) => [s._id, s.n]));
    counts.all = Object.values(counts).reduce((a, b) => a + b, 0);
    return { requests: rows, total, page: p, pages: Math.max(1, Math.ceil(total / size)), counts };
  }

  async update(id: string, b: any) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Request not found');
    const set: Record<string, unknown> = {};
    if ((REQUEST_STATUSES as readonly string[]).includes(b?.status)) set.status = b.status;
    if (typeof b?.adminNote === 'string') set.adminNote = b.adminNote.trim().slice(0, 1000);
    const doc = await this.requests.findByIdAndUpdate(id, { $set: set }, { new: true }).select('-ip').lean().exec();
    if (!doc) throw new NotFoundException('Request not found');
    return doc;
  }

  async remove(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Request not found');
    await this.requests.deleteOne({ _id: id });
    return { ok: true };
  }
}

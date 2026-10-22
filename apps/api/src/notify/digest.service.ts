import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { DISCORD_COLORS, DiscordService } from './discord.service';

/*
 * The morning report, in Discord at 9:00 Pakistan time: what happened in the
 * last 24 hours (accounts, listings, leads, orders), what is waiting on the
 * admin (listings to review, payments to verify, open reports) and what is
 * about to run out (paid plans ending this week).
 *
 * Sent once a day however many API processes are running — the day is
 * claimed in the database first. Leads are counted from the listings' call
 * and WhatsApp counters, against yesterday's total. AUTO_SETUP=false turns it
 * off, like the other background jobs.
 */

const HOUR_PKT = 9;
const pktDate = (d = new Date()) => new Date(d.getTime() + 5 * 3_600_000).toISOString().slice(0, 10);
const pktHour = (d = new Date()) => new Date(d.getTime() + 5 * 3_600_000).getUTCHours();

@Injectable()
export class DigestService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(DigestService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    @InjectConnection() private readonly conn: Connection,
    private readonly discord: DiscordService,
  ) {}

  onApplicationBootstrap() {
    if ((process.env.AUTO_SETUP ?? 'true').toLowerCase() === 'false') return;
    const tick = () => void this.maybeSend().catch((e) => this.logger.warn(`Daily report failed: ${e?.message}`));
    this.timer = setInterval(tick, 10 * 60_000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async maybeSend() {
    if (!this.discord.configured() || pktHour() < HOUR_PKT) return;
    const day = pktDate();
    // Claim today's report: only the process that inserts the row sends it.
    const claim = await this.conn
      .collection('notify_state')
      .updateOne({ _id: `digest:${day}` as any }, { $setOnInsert: { at: new Date() } }, { upsert: true });
    if (!claim.upsertedCount) return;
    await this.send();
  }

  /** Build and send the report now. */
  async send(force = false) {
    const db = this.conn;
    const since = new Date(Date.now() - 24 * 3_600_000);
    const weekAhead = new Date(Date.now() + 7 * 24 * 3_600_000);

    const [users, listingsNew, listingsLive, pending, reports, orders, payments, ending, leadsNow] = await Promise.all([
      db.collection('users').countDocuments({ createdAt: { $gte: since } }),
      db.collection('properties').countDocuments({ createdAt: { $gte: since } }),
      db.collection('properties').countDocuments({ createdAt: { $gte: since }, status: 'approved' }),
      db.collection('properties').countDocuments({ status: 'pending' }),
      db.collection('reports').countDocuments({ status: 'open' }),
      db
        .collection('cementorders')
        .aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: null, n: { $sum: 1 }, total: { $sum: '$total' } } }])
        .toArray(),
      db.collection('subscriptions').countDocuments({ paymentStatus: 'submitted' }),
      db
        .collection('subscriptions')
        .find({ status: 'active', endDate: { $gt: new Date(), $lte: weekAhead }, amount: { $gt: 0 } }, { projection: { userId: 1, planName: 1, endDate: 1 } })
        .sort({ endDate: 1 })
        .limit(10)
        .toArray(),
      db
        .collection('properties')
        .aggregate([{ $group: { _id: null, n: { $sum: { $add: [{ $ifNull: ['$phoneClicks', 0] }, { $ifNull: ['$whatsappClicks', 0] }] } } } }])
        .toArray(),
    ]);

    // Leads: today's running total against the one saved with yesterday's report.
    const leadsTotal = Number(leadsNow[0]?.n ?? 0);
    const prev: any = await db.collection('notify_state').findOne({ _id: 'leads' as any });
    const leads = prev && typeof prev.total === 'number' ? Math.max(0, leadsTotal - prev.total) : null;
    if (!force || !prev) await db.collection('notify_state').updateOne({ _id: 'leads' as any }, { $set: { total: leadsTotal, at: new Date() } }, { upsert: true });

    const endingLines = await Promise.all(
      ending.map(async (s: any) => {
        const u: any = await db
          .collection('users')
          .findOne({ _id: s.userId }, { projection: { name: 1, companyName: 1, phone: 1 } })
          .catch(() => null);
        const who = u ? u.companyName || u.name || 'Agent' : 'Agent';
        return `• ${who}${u?.phone ? ` (${u.phone})` : ''} — ${s.planName ?? 'plan'}, ends ${new Date(s.endDate).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}`;
      }),
    );

    const o = orders[0] as any;
    await this.discord.deliver(
      {
        title: `📊 Daily report — ${new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Karachi' })}`,
        description: 'The last 24 hours, and what is waiting for you.',
        url: '/dashboard',
        color: DISCORD_COLORS.info,
        category: 'Digest',
        fields: [
          { name: '👤 New accounts', value: String(users) },
          { name: '🏠 New listings', value: `${listingsNew} (${listingsLive} live)` },
          { name: '📞 Leads', value: leads === null ? 'from tomorrow' : `${leads} calls & WhatsApps` },
          { name: '🧱 Orders', value: o ? `${o.n} · ${DiscordService.money(o.total)}` : '0' },
          { name: '🕵️ To review', value: pending ? `**${pending}** listings` : 'Nothing' },
          { name: '🧾 To verify', value: payments ? `**${payments}** payments` : 'Nothing' },
          { name: '🚩 Open reports', value: String(reports) },
          ...(endingLines.length ? [{ name: '⏰ Paid plans ending this week', value: endingLines.join('\n'), inline: false }] : []),
        ],
        links: [
          ...(pending ? [{ label: 'Review listings', url: '/dashboard/property?status=pending' }] : []),
          ...(payments ? [{ label: 'Verify payments', url: '/dashboard/subscriptions' }] : []),
          ...(reports ? [{ label: 'Reports', url: '/dashboard/reports' }] : []),
          { label: 'Insights', url: '/dashboard/insights' },
        ],
      },
      force,
    );
  }
}

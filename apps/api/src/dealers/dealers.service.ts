import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { AgencyService } from '../agency/agency.service';
import { RedisCacheService } from '../redis-cache/redis-cache.service';
import { RevalidateService } from '../revalidate/revalidate.service';

/*
 * The property dealers directory: every agency and agent, city by city.
 *
 * Who is in a city: the city on their account; an agency's agent without one
 * takes the agency's; an older account without one goes where most of its
 * live listings are.
 *
 * Order, top to bottom:
 *   1. Agencies (accounts whose plan has agent accounts), dearest plan first.
 *   2. Agents, ranked by the plan they list under — an agency's agent by the
 *      agency's plan — so Agency Plus agents, then Agency, Dealer, Starter,
 *      and Free last. Within a plan: verified first, then most live listings,
 *      then the longest on the site.
 *
 * Paid accounts and an agency's agents are always listed. A Free account
 * appears once it has a live listing, so nobody lands on an empty profile.
 */

export interface DealerCard {
  _id: string;
  /** Agency: its company name. Agent: their own name. */
  name: string;
  /** As stored — part of the profile address. */
  companyName: string;
  /** Agency: the person behind it. */
  person: string;
  avatarUrl: string;
  coverUrl: string;
  address: string;
  phone: string;
  whatsapp: string;
  experienceYears: number;
  listings: number;
  verified: boolean;
  isAgency: boolean;
  /** The plan's name, and its place in the order (its price; 0 = Free). */
  plan: string;
  rank: number;
  /** An agency's agent: the agency. */
  agency: { _id: string; name: string } | null;
  /** An agency: its agents listed in this city. */
  agents: number;
  since: string;
}

export interface DealerPage {
  metaTitle?: string;
  metaDescription?: string;
  heading?: string;
  intro?: string;
  /** Rich text below the list. */
  content?: string;
  faqs?: { q: string; a: string }[];
  /** Keep the page out of search results. */
  noindex?: boolean;
}

export interface DealerSettings {
  /** /property-dealers, the page of every city. */
  hub: DealerPage;
  /**
   * Used for a city that has no text of its own. {city} becomes the city's
   * name and {count} the number of dealers.
   */
  cityDefaults: DealerPage;
}

const DOC_ID = 'dealers';
const sid = (v: unknown) => String(v ?? '');

export const citySlug = (name: string) =>
  String(name ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const text = (v: unknown, max: number) =>
  String(v ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, max);

function cleanPage(input: any): DealerPage {
  const p = input && typeof input === 'object' ? input : {};
  const faqs = (Array.isArray(p.faqs) ? p.faqs : [])
    .map((f: any) => ({ q: text(f?.q, 200), a: text(f?.a, 1200) }))
    .filter((f: { q: string; a: string }) => f.q && f.a)
    .slice(0, 15);
  const out: DealerPage = {
    metaTitle: text(p.metaTitle, 90),
    metaDescription: text(p.metaDescription, 250),
    heading: text(p.heading, 120),
    intro: text(p.intro, 700),
    // Rich text from the admin's editor, like a city's other content.
    content: String(p.content ?? '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .slice(0, 30_000),
    faqs,
    noindex: !!p.noindex,
  };
  for (const k of Object.keys(out) as (keyof DealerPage)[]) {
    const v = out[k];
    if (v === '' || v === false || (Array.isArray(v) && !v.length))
      delete out[k];
  }
  return out;
}

type Directory = {
  cities: Record<string, { agencies: DealerCard[]; agents: DealerCard[] }>;
};

@Injectable()
export class DealersService {
  constructor(
    @InjectConnection() private readonly conn: Connection,
    private readonly agency: AgencyService,
    private readonly cache: RedisCacheService,
    private readonly revalidate: RevalidateService,
  ) {}

  private col(name: string) {
    return this.conn.db!.collection<any>(name);
  }

  /* ── Settings ── */

  private async stored(): Promise<{
    hub?: DealerPage;
    cityDefaults?: DealerPage;
    cities?: Record<string, DealerPage>;
  }> {
    return (
      (await this.col('tool_config').findOne({
        _id: DOC_ID,
      } as any)) ?? {}
    );
  }

  async settings(): Promise<DealerSettings> {
    const s = await this.stored();
    return { hub: s.hub ?? {}, cityDefaults: s.cityDefaults ?? {} };
  }

  async saveSettings(input: Partial<DealerSettings>): Promise<DealerSettings> {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (input?.hub !== undefined) set.hub = cleanPage(input.hub);
    if (input?.cityDefaults !== undefined)
      set.cityDefaults = cleanPage(input.cityDefaults);
    await this.col('tool_config').updateOne(
      { _id: DOC_ID } as any,
      { $set: set },
      { upsert: true },
    );
    await this.refresh();
    return this.settings();
  }

  async cityPageText(cityId: string): Promise<DealerPage> {
    return (await this.stored()).cities?.[cityId] ?? {};
  }

  async saveCityPage(cityId: string, input: DealerPage): Promise<DealerPage> {
    if (!Types.ObjectId.isValid(cityId))
      throw new NotFoundException('City not found');
    const city = await this.col('cities').findOne(
      { _id: new Types.ObjectId(cityId) },
      { projection: { _id: 1 } },
    );
    if (!city) throw new NotFoundException('City not found');
    const page = cleanPage(input);
    await this.col('tool_config').updateOne(
      { _id: DOC_ID } as any,
      { $set: { [`cities.${cityId}`]: page, updatedAt: new Date() } },
      { upsert: true },
    );
    await this.refresh();
    return page;
  }

  private async refresh() {
    await this.cache.invalidateTags(['dealers']).catch(() => undefined);
    await this.revalidate
      .revalidate({ tags: ['dealers'], paths: ['/property-dealers'] })
      .catch(() => undefined);
  }

  /* ── The directory ── */

  private async cityList(): Promise<
    { _id: string; name: string; slug: string; thumbnail: string }[]
  > {
    const rows = await this.col('cities')
      .find({}, { projection: { name: 1, thumbnail: 1 } })
      .sort({ name: 1 })
      .toArray();
    return rows.map((c) => ({
      _id: sid(c._id),
      name: String(c.name ?? ''),
      slug: citySlug(c.name),
      thumbnail: c.thumbnail ?? '',
    }));
  }

  /** Every city's agencies and agents, worked out in one pass and cached for ten minutes. */
  private directory(): Promise<Directory> {
    return this.cache.wrap(
      this.cache.buildKey('dealers:directory', []),
      () => this.build(),
      {
        ttl: 600,
        // Any of these changing can add a city's first dealer — the page appears at once.
      tags: ['dealers', 'agents', 'subscriptions', 'properties'],
      },
    );
  }

  private async build(): Promise<Directory> {
    const now = new Date();
    const [users, packages, subs, areas, verified] = await Promise.all([
      this.col('users')
        .find(
          { role: 'AGENT', isActive: { $ne: false } },
          {
            projection: {
              name: 1,
              companyName: 1,
              avatarUrl: 1,
              coverUrl: 1,
              address: 1,
              phone: 1,
              whatsappNumber: 1,
              experienceYears: 1,
              city: 1,
              agencyId: 1,
              createdAt: 1,
            },
          },
        )
        .toArray(),
      this.col('packages')
        .find({}, { projection: { name: 1, price: 1, teamMembers: 1 } })
        .toArray(),
      this.col('subscriptions')
        .find(
          { status: 'active', endDate: { $gt: now } },
          { projection: { userId: 1, packageId: 1, endDate: 1, planName: 1 } },
        )
        .sort({ endDate: -1 })
        .toArray(),
      this.col('areas')
        .find({}, { projection: { city: 1 } })
        .toArray(),
      this.agency.verifiedIds().catch(() => new Set<string>()),
    ]);

    const pkgById = new Map(packages.map((p) => [sid(p._id), p]));
    const free = packages.filter((p) => Number(p.price) <= 0);
    const freeName = String(
      (
        free.find((p) => String(p.name).trim().toLowerCase() === 'free') ??
        free[0]
      )?.name ?? 'Free',
    );

    // The plan in force per account: its latest-ending live subscription (as the dashboard reads it).
    const planOf = new Map<
      string,
      { name: string; price: number; team: number }
    >();
    for (const s of subs) {
      const id = sid(s.userId);
      if (planOf.has(id)) continue;
      const p = pkgById.get(sid(s.packageId));
      planOf.set(id, {
        name: String(p?.name ?? s.planName ?? 'Plan'),
        price: Math.max(0, Number(p?.price) || 0),
        team: Math.max(0, Number(p?.teamMembers) || 0),
      });
    }
    const plan = (id: string) =>
      planOf.get(id) ?? { name: freeName, price: 0, team: 0 };

    // Live listings per account, and the city most of them are in.
    const areaCity = new Map(areas.map((a) => [sid(a._id), sid(a.city)]));
    const byOwnerArea = await this.col('properties')
      .aggregate([
        { $match: { status: 'approved' } },
        {
          $group: {
            _id: { o: { $toString: '$owner' }, a: { $toString: '$area' } },
            n: { $sum: 1 },
          },
        },
      ])
      .toArray();
    const listings = new Map<string, number>();
    const cityVotes = new Map<string, Map<string, number>>();
    for (const r of byOwnerArea) {
      const o = sid(r._id?.o);
      listings.set(o, (listings.get(o) ?? 0) + r.n);
      const c = areaCity.get(sid(r._id?.a));
      if (!c) continue;
      const votes = cityVotes.get(o) ?? new Map<string, number>();
      votes.set(c, (votes.get(c) ?? 0) + r.n);
      cityVotes.set(o, votes);
    }
    const topCity = (o: string) => {
      let best = '';
      let n = 0;
      for (const [c, v] of cityVotes.get(o) ?? [])
        if (v > n) [best, n] = [c, v];
      return best;
    };

    const byId = new Map(users.map((u) => [sid(u._id), u]));
    const cityOf = (u: any): string => {
      if (u.city) return sid(u.city);
      if (u.agencyId) {
        const a = byId.get(sid(u.agencyId));
        if (a?.city) return sid(a.city);
      }
      return topCity(sid(u._id));
    };

    const teamListings = new Map<string, number>();
    for (const u of users) {
      if (!u.agencyId) continue;
      const a = sid(u.agencyId);
      teamListings.set(
        a,
        (teamListings.get(a) ?? 0) + (listings.get(sid(u._id)) ?? 0),
      );
    }

    const cities: Directory['cities'] = {};
    const slot = (c: string) => (cities[c] ??= { agencies: [], agents: [] });

    for (const u of users) {
      const id = sid(u._id);
      const city = cityOf(u);
      if (!city) continue;
      const agencyId = u.agencyId ? sid(u.agencyId) : '';
      const agencyUser = agencyId ? byId.get(agencyId) : null;
      // An agent whose agency is gone or inactive lists as an independent agent.
      const owner = agencyUser ? agencyId : id;
      const p = plan(owner);
      const isAgency = !agencyUser && p.team > 0;
      const own = listings.get(id) ?? 0;
      const count = isAgency ? own + (teamListings.get(id) ?? 0) : own;
      if (p.price <= 0 && !agencyUser && count === 0) continue;

      const card: DealerCard = {
        _id: id,
        name:
          String(
            (isAgency ? u.companyName || u.name : u.name || u.companyName) ??
              'Agent',
          ).trim() || 'Agent',
        companyName: String(u.companyName ?? ''),
        person: isAgency && u.companyName ? String(u.name ?? '') : '',
        avatarUrl: u.avatarUrl ?? '',
        coverUrl: u.coverUrl ?? '',
        address: u.address ?? '',
        phone: u.phone ?? '',
        whatsapp: u.whatsappNumber ?? '',
        experienceYears: Number(u.experienceYears) || 0,
        listings: count,
        verified: verified.has(id),
        isAgency,
        plan: p.name,
        rank: p.price,
        agency: agencyUser
          ? {
              _id: agencyId,
              name: String(
                agencyUser.companyName || agencyUser.name || 'Agency',
              ),
            }
          : null,
        agents: 0,
        since: u.createdAt ? new Date(u.createdAt).toISOString() : '',
      };
      if (isAgency) slot(city).agencies.push(card);
      else slot(city).agents.push(card);
    }

    const order = (a: DealerCard, b: DealerCard) =>
      b.rank - a.rank ||
      Number(b.verified) - Number(a.verified) ||
      b.listings - a.listings ||
      a.since.localeCompare(b.since) ||
      a.name.localeCompare(b.name);
    for (const c of Object.values(cities)) {
      for (const ag of c.agencies)
        ag.agents = c.agents.filter((x) => x.agency?._id === ag._id).length;
      c.agencies.sort(order);
      c.agents.sort(order);
    }
    return { cities };
  }

  /** Every city with how many agencies and agents it has — for /property-dealers and the admin. */
  async cities() {
    const [list, dir] = await Promise.all([this.cityList(), this.directory()]);
    return list.map((c) => ({
      ...c,
      agencies: dir.cities[c._id]?.agencies.length ?? 0,
      agents: dir.cities[c._id]?.agents.length ?? 0,
    }));
  }

  /** One city's page: its text, its agencies, and a page of its agents. */
  async city(slug: string, page = 1, limit = 30, q = '') {
    const key = citySlug(slug);
    const list = await this.cityList();
    const city =
      list.find((c) => c.slug === key) ?? list.find((c) => c._id === slug);
    if (!city) throw new NotFoundException('City not found');
    const [dir, text, s] = await Promise.all([
      this.directory(),
      this.cityPageText(city._id),
      this.settings(),
    ]);
    const all = dir.cities[city._id] ?? { agencies: [], agents: [] };
    // A search by name: agency, agent, the person behind an agency, or an agent's agency.
    const term = String(q ?? '').trim().toLowerCase().slice(0, 60);
    const hit = (d: DealerCard) =>
      !term || [d.name, d.companyName, d.person, d.agency?.name].some((v) => String(v ?? '').toLowerCase().includes(term));
    const agencies = all.agencies.filter(hit);
    const agents = all.agents.filter(hit);
    const size = Math.min(60, Math.max(6, Math.floor(limit) || 30));
    const pages = Math.max(1, Math.ceil(agents.length / size));
    const p = Math.min(pages, Math.max(1, Math.floor(page) || 1));
    return {
      city: {
        _id: city._id,
        name: city.name,
        slug: city.slug,
        thumbnail: city.thumbnail,
      },
      page: text,
      defaults: s.cityDefaults,
      agencies,
      agents: agents.slice((p - 1) * size, p * size),
      total: { agencies: all.agencies.length, agents: all.agents.length },
      /** With a search: how many of each match. */
      found: { agencies: agencies.length, agents: agents.length },
      pageInfo: { page: p, pages, limit: size },
    };
  }

  /**
   * Every city's agencies in one list, biggest plans first, each with its
   * city — the top of /property-dealers.
   */
  async agencies(limit = 24) {
    const [list, dir] = await Promise.all([this.cityList(), this.directory()]);
    const byId = new Map(list.map((c) => [c._id, c]));
    const rows: (DealerCard & { city: { name: string; slug: string } })[] = [];
    for (const [cityId, c] of Object.entries(dir.cities)) {
      const city = byId.get(cityId);
      if (!city) continue;
      for (const a of c.agencies) rows.push({ ...a, city: { name: city.name, slug: city.slug } });
    }
    rows.sort(
      (a, b) =>
        b.rank - a.rank ||
        Number(b.verified) - Number(a.verified) ||
        b.listings - a.listings ||
        a.name.localeCompare(b.name),
    );
    return { total: rows.length, agencies: rows.slice(0, Math.min(60, Math.max(1, Math.floor(limit) || 24))) };
  }

  /** The admin's view of one city: its text and counts. */
  async adminCity(cityId: string) {
    const list = await this.cityList();
    const city = list.find((c) => c._id === cityId);
    if (!city) throw new NotFoundException('City not found');
    const dir = await this.directory();
    return {
      city,
      page: await this.cityPageText(cityId),
      total: {
        agencies: dir.cities[cityId]?.agencies.length ?? 0,
        agents: dir.cities[cityId]?.agents.length ?? 0,
      },
    };
  }
}

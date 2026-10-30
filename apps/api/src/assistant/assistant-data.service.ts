import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Property } from '@rent-ghar/db/schemas/property.schema';
import { AgencyService } from '../agency/agency.service';

/**
 * The live data behind the site assistant (the chat bubble).
 *
 * Everything is read from the database as it is now — a listing approved a
 * minute ago is in the next answer. Three questions, answered fast:
 *
 *   places   "bahria", "dha 6 lahore", "johar town" → the real areas and
 *            societies, with their city and how many listings they have
 *   search   a budget, a size, a place, a type → the best matching listings
 *   market   what things actually cost in a place, from its live listings
 *
 * The model never makes numbers up: it calls these and reads the answer.
 */

type AreaRow = {
  _id: string;
  name: string;
  slug: string;
  cityId: string;
  city: string;
  kind: string;
  parent: string | null;
  mergedInto: string | null;
  guide?: any;
  tokens: string[];
  listings: number;
};

export const TYPE_ALIASES: Record<string, string[]> = {
  house: ['house'],
  home: ['house'],
  plot: ['plot', 'land'],
  land: ['plot', 'land'],
  flat: ['flat', 'apartment'],
  apartment: ['flat', 'apartment'],
  commercial: ['commercial', 'shop', 'office'],
  shop: ['shop', 'commercial'],
  office: ['office', 'commercial'],
  factory: ['factory'],
  hotel: ['hotel'],
  restaurant: ['restaurant'],
};

const SYN: Record<string, string> = { ph: 'phase', phs: 'phase', sec: 'sector', sect: 'sector', blk: 'block', bt: 'bahria', dha: 'dha', defence: 'dha', defense: 'dha', lhr: 'lahore', isb: 'islamabad', khi: 'karachi', rwp: 'rawalpindi', pindi: 'rawalpindi', fsd: 'faisalabad', mtn: 'multan', soc: 'society', town: 'town', scheme: 'scheme' };
const STOP = new Set(['in', 'the', 'of', 'at', 'near', 'mein', 'me', 'main', 'k', 'ka', 'ki', 'ke', 'and', 'housing', 'society', 'lahore-']);
const tokens = (s: string) =>
  String(s || '')
    .toLowerCase()
    .replace(/(\d+)([a-z])/g, '$1 $2')
    .replace(/([a-z])(\d+)/g, '$1 $2')
    .split(/[^a-z0-9]+/)
    .map((t) => SYN[t] || t)
    .filter((t) => t && !STOP.has(t));

/** Marla of a listing: kanal and marla if given, else its square feet. */
export function marlaOf(p: any): number {
  const m = (Number(p.kanal) || 0) * 20 + (Number(p.marla) || 0);
  if (m > 0) return m;
  const sqft = Number(p.areaSize) || 0;
  return sqft > 0 ? sqft / (Number(p.marlaSqft) || 225) : 0;
}

/** "PKR 2.5 Crore", "PKR 85,000". */
export function pkr(n: unknown): string {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return '';
  const t = (x: number) => String(Number(x.toFixed(2)));
  if (v >= 1e9) return `PKR ${t(v / 1e9)} Arab`;
  if (v >= 1e7) return `PKR ${t(v / 1e7)} Crore`;
  if (v >= 1e5) return `PKR ${t(v / 1e5)} Lakh`;
  return `PKR ${Math.round(v).toLocaleString('en-PK')}`;
}

export function sizeText(m: number): string {
  if (!(m > 0)) return '';
  if (m >= 20 && Math.abs(m / 20 - Math.round(m / 20)) < 0.05) return `${Math.round(m / 20)} Kanal`;
  return `${Number(m.toFixed(1))} Marla`;
}

const median = (a: number[]) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
const pct = (a: number[], p: number) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))))]!;
};

export interface SearchInput {
  /** Area / society ids from places(). */
  placeIds?: string[];
  cityId?: string;
  purpose?: 'sale' | 'rent';
  types?: string[];
  minPrice?: number;
  maxPrice?: number;
  minMarla?: number;
  maxMarla?: number;
  minBeds?: number;
  keywords?: string;
  sort?: 'best' | 'cheapest' | 'newest' | 'largest' | 'expensive';
  limit?: number;
}

@Injectable()
export class AssistantDataService {
  private areas: { at: number; rows: AreaRow[]; byId: Map<string, AreaRow> } | null = null;

  constructor(
    @InjectModel(Property.name) private readonly properties: Model<Property>,
    private readonly agency: AgencyService,
  ) {}

  /** Every area and society with its city and live listing count (10 minutes). */
  private async allAreas() {
    if (this.areas && Date.now() - this.areas.at < 10 * 60_000) return this.areas;
    const db = this.properties.db;
    const [areaDocs, cities, counts] = await Promise.all([
      db.collection('areas').find({}, { projection: { name: 1, areaSlug: 1, city: 1, kind: 1, parent: 1, mergedInto: 1, guide: 1 } }).toArray(),
      db.collection('cities').find({}, { projection: { name: 1 } }).toArray(),
      this.properties.collection.aggregate([{ $match: { status: 'approved' } }, { $group: { _id: '$area', n: { $sum: 1 } } }]).toArray(),
    ]);
    const cityName = new Map(cities.map((c: any) => [String(c._id), String(c.name || '').trim()]));
    const count = new Map(counts.map((c: any) => [String(c._id), c.n as number]));
    const rows: AreaRow[] = areaDocs.map((a: any) => {
      const city = cityName.get(String(a.city)) || '';
      return {
        _id: String(a._id),
        name: String(a.name || '').trim(),
        slug: a.areaSlug,
        cityId: String(a.city),
        city,
        kind: a.kind || 'area',
        parent: a.parent ? String(a.parent) : null,
        mergedInto: a.mergedInto ? String(a.mergedInto) : null,
        guide: a.kind === 'society' && a.guide ? a.guide : undefined,
        tokens: tokens(a.name),
        listings: count.get(String(a._id)) || 0,
      };
    });
    // A society counts its phases' listings too.
    const byId = new Map(rows.map((r) => [r._id, r]));
    for (const r of rows) if (r.parent && byId.has(r.parent)) byId.get(r.parent)!.listings += r.listings;
    this.areas = { at: Date.now(), rows, byId };
    return this.areas;
  }

  private async cityList() {
    const { rows } = await this.allAreas();
    const m = new Map<string, { _id: string; name: string; listings: number }>();
    for (const r of rows) {
      if (!r.city) continue;
      const c = m.get(r.cityId) || { _id: r.cityId, name: r.city, listings: 0 };
      if (!r.parent) c.listings += r.listings;
      m.set(r.cityId, c);
    }
    return [...m.values()];
  }

  /** Places matching what a person typed — areas, societies, phases and cities. */
  async places(q: string, city?: string) {
    const { rows } = await this.allAreas();
    const qt = tokens(q);
    const cities = await this.cityList();
    const cityTok = new Set(tokens(city || ''));
    const cityHits = cities.filter((c) => tokens(c.name).every((t) => qt.includes(t) || cityTok.has(t)));
    const cityIds = new Set(cityHits.map((c) => c._id));
    const placeTok = qt.filter((t) => !cityHits.some((c) => tokens(c.name).includes(t)));

    const scored: { r: AreaRow; s: number }[] = [];
    if (placeTok.length) {
      for (const r of rows) {
        if (r.mergedInto) continue;
        let hit = 0;
        for (const t of placeTok) {
          if (r.tokens.includes(t)) hit += 1;
          else if (t.length >= 3 && r.tokens.some((x) => x.startsWith(t) || (x.length >= 4 && t.startsWith(x)))) hit += 0.7;
        }
        if (!hit) continue;
        const cover = hit / placeTok.length;
        if (cover < 0.6) continue;
        const extra = r.tokens.filter((x) => !placeTok.includes(x)).length;
        let s = cover * 10 - extra * 0.6 + Math.log10(1 + r.listings) * 1.5 + (cover === 1 && !extra ? 3 : 0);
        if (r.kind === 'society') s += 1.5;
        if (cityIds.size) s += cityIds.has(r.cityId) ? 4 : -6;
        scored.push({ r, s });
      }
    }
    scored.sort((a, b) => b.s - a.s);
    const places = scored.slice(0, 6).map(({ r }) => ({
      id: r._id,
      name: titleCase(r.name),
      city: titleCase(r.city),
      cityId: r.cityId,
      kind: r.kind,
      listings: r.listings,
      ...(r.guide?.published
        ? {
            society: {
              tagline: r.guide.tagline || '',
              developer: r.guide.developer || '',
              approval: [r.guide.approvedBy, r.guide.approval].filter(Boolean).join(' — '),
              possession: r.guide.possession || '',
              plotSizes: r.guide.plotSizes || '',
              address: r.guide.address || '',
              amenities: (r.guide.amenities || []).slice(0, 8),
              url: `/societies/${slugify(r.city)}/${r.slug}`,
            },
          }
        : {}),
      url: `/properties/sale/${slugify(r.city)}/${r.slug}`,
    }));
    // A broad name ("Bahria Town", "DHA") covers every area named that way in
    // the city — the areas are often listed piece by piece (sectors, blocks).
    const best = scored[0]?.r;
    const has = (r: AreaRow, t: string) => r.tokens.includes(t) || (t.length >= 3 && r.tokens.some((x) => x.startsWith(t)));
    const members = best
      ? rows.filter((r) => !r.mergedInto && r.cityId === best.cityId && placeTok.every((t) => has(r, t))).sort((x, y) => x.tokens.length - y.tokens.length || y.listings - x.listings)
      : [];
    // Only for a whole name: an area called exactly that exists ("bahria" alone
    // would also sweep in Bahria Orchard).
    const exact = members.find((r) => r.tokens.length === placeTok.length && placeTok.every((t) => r.tokens.includes(t)));
    const group =
      best && exact && members.length > 1
        ? {
            name: titleCase(exact.name),
            city: titleCase(best.city),
            cityId: best.cityId,
            ids: members.map((r) => r._id),
            listings: members.reduce((n, r) => n + (r.parent && members.some((x) => x._id === r.parent) ? 0 : r.listings), 0),
          }
        : null;
    return {
      places,
      group,
      cities: cityHits.map((c) => ({ id: c._id, name: titleCase(c.name), listings: c.listings })),
    };
  }

  /** The area ids a search covers: the places, their phases, and areas merged into them. */
  private async scope(input: { placeIds?: string[]; cityId?: string }) {
    const { rows } = await this.allAreas();
    const want = new Set((input.placeIds || []).filter((id) => Types.ObjectId.isValid(id)));
    if (want.size) {
      for (const r of rows) if ((r.parent && want.has(r.parent)) || (r.mergedInto && want.has(r.mergedInto))) want.add(r._id);
    } else if (input.cityId && Types.ObjectId.isValid(input.cityId)) {
      for (const r of rows) if (r.cityId === input.cityId) want.add(r._id);
    }
    return want.size ? [...want].flatMap((id) => [new Types.ObjectId(id), id]) : null;
  }

  private baseFilter(input: SearchInput, scope: unknown[] | null) {
    const f: Record<string, any> = {
      status: 'approved',
      $or: [{ availability: { $nin: ['sold', 'rented'] } }, { availability: { $exists: false } }],
    };
    if (scope) f.area = { $in: scope };
    if (input.purpose === 'sale' || input.purpose === 'rent') f.listingType = input.purpose;
    const types = [...new Set((input.types || []).flatMap((t) => TYPE_ALIASES[String(t).toLowerCase()] || [String(t).toLowerCase()]))];
    if (types.length) f.propertyType = { $in: types.map((t) => new RegExp(`^${t}$`, 'i')) };
    if (input.minPrice || input.maxPrice) {
      f.price = {};
      if (input.minPrice) f.price.$gte = Number(input.minPrice);
      if (input.maxPrice) f.price.$lte = Number(input.maxPrice);
    }
    if (input.minBeds) f.bedrooms = { $gte: Number(input.minBeds) };
    return f;
  }

  /** The best matching live listings, with how many match in all. */
  async search(input: SearchInput) {
    const scope = await this.scope(input);
    const filter = this.baseFilter(input, scope);
    const rows: any[] = await this.properties.collection
      .find(filter, {
        projection: { title: 1, slug: 1, price: 1, listingType: 1, propertyType: 1, marla: 1, kanal: 1, areaSize: 1, marlaSqft: 1, bedrooms: 1, bathrooms: 1, area: 1, mainPhotoUrl: 1, isFeatured: 1, owner: 1, createdAt: 1, location: 1, description: 1 },
      })
      .sort({ isFeatured: -1, createdAt: -1 })
      .limit(600)
      .toArray();

    const kw = tokens(input.keywords || '');
    let list = rows
      .map((p) => ({ p, m: marlaOf(p) }))
      .filter(({ m }) => (!input.minMarla || m >= Number(input.minMarla) * 0.97) && (!input.maxMarla || (m > 0 && m <= Number(input.maxMarla) * 1.03)));
    if (kw.length) {
      list = list
        .map((x) => ({ ...x, k: kw.filter((t) => tokens(`${x.p.title} ${x.p.description || ''}`).includes(t)).length }))
        .filter((x: any) => x.k > 0) as any;
    }

    // "Best": closest to the middle of the budget and size asked for, newer and featured first.
    const mid = input.minPrice && input.maxPrice ? (Number(input.minPrice) + Number(input.maxPrice)) / 2 : Number(input.maxPrice) || 0;
    const score = (x: { p: any; m: number }) => {
      let s = 0;
      if (mid) s -= Math.abs(x.p.price - mid) / mid;
      if (input.minMarla) s -= Math.abs(x.m - Number(input.minMarla)) / Math.max(1, Number(input.minMarla)) * 0.5;
      s += x.p.isFeatured ? 0.15 : 0;
      s += Math.max(0, 1 - (Date.now() - new Date(x.p.createdAt || 0).getTime()) / (60 * 86_400_000)) * 0.2;
      s += x.p.mainPhotoUrl ? 0.1 : 0;
      return s;
    };
    const sort = input.sort || 'best';
    list.sort((a, b) =>
      sort === 'cheapest' ? a.p.price - b.p.price
        : sort === 'expensive' ? b.p.price - a.p.price
        : sort === 'newest' ? new Date(b.p.createdAt).getTime() - new Date(a.p.createdAt).getTime()
        : sort === 'largest' ? b.m - a.m
        : score(b) - score(a),
    );

    const { byId } = await this.allAreas();
    const verified = await this.agency.verifiedIds().catch(() => new Set<string>());
    const limit = Math.max(1, Math.min(8, Number(input.limit) || 6));
    const prices = list.map((x) => x.p.price).filter((n) => n > 0);
    // Where "see all" goes: the place searched (or its city) on the site's own results page.
    const first = (input.placeIds || []).map((id) => byId.get(String(id))).find(Boolean);
    const cityOnly = !first && input.cityId ? [...byId.values()].find((r) => r.cityId === input.cityId) : undefined;
    const link = first ? { citySlug: slugify(first.city), areaSlug: first.slug } : cityOnly ? { citySlug: slugify(cityOnly.city), areaSlug: '' } : null;
    return {
      total: list.length,
      capped: rows.length >= 600,
      link,
      priceRange: prices.length ? { min: pkr(Math.min(...prices)), max: pkr(Math.max(...prices)) } : null,
      listings: list.slice(0, limit).map(({ p, m }) => {
        const a = byId.get(String(p.area));
        return {
          id: String(p._id),
          title: p.title,
          url: `/properties/${p.slug}`,
          price: p.price,
          priceText: pkr(p.price) + (p.listingType === 'rent' ? ' / month' : ''),
          purpose: p.listingType,
          type: p.propertyType,
          size: sizeText(m),
          beds: p.bedrooms || 0,
          baths: p.bathrooms || 0,
          place: titleCase([a?.name || p.location, a?.city].filter(Boolean).join(', ')),
          photo: p.mainPhotoUrl || null,
          featured: !!p.isFeatured,
          verified: verified.has(String(p.owner)),
          listed: p.createdAt,
        };
      }),
    };
  }

  /**
   * What things cost in a place, from its live listings: median price, the
   * middle half, and price per marla — overall and for the commonest sizes.
   */
  async market(input: SearchInput) {
    const scope = await this.scope(input);
    const out: any[] = [];
    for (const purpose of input.purpose ? [input.purpose] : (['sale', 'rent'] as const)) {
      const rows: any[] = await this.properties.collection
        .find(this.baseFilter({ ...input, purpose, minPrice: undefined, maxPrice: undefined }, scope), { projection: { price: 1, marla: 1, kanal: 1, areaSize: 1, marlaSqft: 1 } })
        .limit(3000)
        .toArray();
      const withSize = rows.map((p) => ({ price: Number(p.price) || 0, m: marlaOf(p) })).filter((x) => x.price > 0);
      const sized = withSize.filter((x) => x.m >= 1 && x.m <= 400);
      const filtered = sized.filter((x) => (!input.minMarla || x.m >= input.minMarla * 0.97) && (!input.maxMarla || x.m <= input.maxMarla * 1.03));
      const base = input.minMarla || input.maxMarla ? filtered : withSize;
      if (!base.length) {
        out.push({ purpose, listings: 0 });
        continue;
      }
      const prices = base.map((x) => x.price);
      const perMarla = (input.minMarla || input.maxMarla ? filtered : sized).map((x) => x.price / x.m);
      const bySize = new Map<string, number[]>();
      for (const x of sized) {
        const k = sizeText(Math.round(x.m * 2) / 2);
        bySize.set(k, [...(bySize.get(k) || []), x.price]);
      }
      out.push({
        purpose,
        listings: base.length,
        median: pkr(median(prices)) + (purpose === 'rent' ? ' / month' : ''),
        typicalRange: `${pkr(pct(prices, 25))} – ${pkr(pct(prices, 75))}`,
        cheapest: pkr(Math.min(...prices)),
        highest: pkr(Math.max(...prices)),
        perMarla: perMarla.length >= 3 ? pkr(median(perMarla)) + (purpose === 'rent' ? ' / month' : '') : null,
        bySize: [...bySize.entries()]
          .filter(([, v]) => v.length >= 2)
          .sort((a, b) => b[1].length - a[1].length)
          .slice(0, 5)
          .map(([size, v]) => ({ size, listings: v.length, median: pkr(median(v)) })),
      });
    }
    const { byId } = await this.allAreas();
    const first = (input.placeIds || []).map((id) => byId.get(String(id))).find(Boolean);
    const cityOnly = !first && input.cityId ? [...byId.values()].find((r) => r.cityId === input.cityId) : undefined;
    const link = first ? { citySlug: slugify(first.city), areaSlug: first.slug } : cityOnly ? { citySlug: slugify(cityOnly.city), areaSlug: '' } : null;
    return { basedOn: 'Live listings on the site right now', market: out, link };
  }
}

/** "dha phase 6" → "DHA Phase 6": title case, with the short names in capitals. */
const ACRONYMS = new Set(['dha', 'lda', 'cda', 'rda', 'fda', 'mda', 'eme', 'paf', 'ruda', 'wapda', 'pia', 'nfc', 'pcsir', 'ptcl', 'cbd', 'gor', 'pechs', 'kda', 'bzu']);
export function titleCase(s: string): string {
  return String(s || '').replace(/[A-Za-z]+/g, (w) => (ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w[0]!.toUpperCase() + w.slice(1)));
}

function slugify(s: string) {
  return String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

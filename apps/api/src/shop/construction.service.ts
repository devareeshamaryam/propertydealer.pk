import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { ShopService, type ShopProduct } from './shop.service';

/*
 * The construction cost calculator's numbers — worked out on their own, so
 * the office only steps in when it wants to.
 *
 *  - Material prices: the shop's live products, typos and stray items left
 *    out; a city with its own products gets its own prices.
 *  - Cities: every city on the site. Its cost factor comes from its own
 *    material prices when it has enough of them, else from typical city
 *    levels, else from its province.
 *  - Finishing and other works: follow material prices (a market index), so
 *    they stay current without anyone retyping them.
 *
 * Anything typed on the dashboard wins over the automatic value; a blank box
 * means "automatic".
 */

export const CONSTRUCTION_MATERIALS = [
  'cement',
  'steel',
  'bricks',
  'sand',
  'crush',
] as const;
export type ConstructionMaterial = (typeof CONSTRUCTION_MATERIALS)[number];

type Quality = 'economy' | 'standard' | 'premium' | 'luxury';

export const GREY_WORKS = [
  'excavation',
  'shuttering',
  'waterproofing',
  'plumbing',
  'electrical',
] as const;
export type GreyWork = (typeof GREY_WORKS)[number];

export interface ConstructionConfig {
  /** Material per square foot of covered area, grey structure. */
  qty: Record<ConstructionMaterial, number>;
  /** Rates typed by the office; 0 = automatic (the shop's). */
  rates: Record<ConstructionMaterial, number>;
  /** Used only when neither the office nor the shop has a rate. */
  fallback: Record<ConstructionMaterial, number>;
  /** Grey-structure works besides the five materials, Rs per sq ft. */
  greyWorks: Record<GreyWork, number>;
  /** Labour-only contract, Rs per sq ft (standard quality). */
  labour: { grey: number; finishing: number };
  /** Finishing materials per sq ft by quality — without bathrooms and kitchens. */
  finishing: Record<Quality, number>;
  /** How that finishing money is usually spent (percent). */
  finishSplit: { key: string; label: string; pct: number; shop?: string }[];
  /** Fittings for one bathroom, by quality. */
  bathroom: Record<Quality, number>;
  /** One kitchen — cabinets, counter, sink, hood and hob — by quality. */
  kitchen: Record<Quality, number>;
  /** A contractor's overhead and profit on a full (material + labour) contract. */
  contractorPct: number;
  /** Kept aside for wastage, transport and small extras, so the estimate errs high. */
  contingencyPct: number;
  /** A basement costs this much more per sq ft (retaining walls, waterproofing, digging). */
  basementFactor: number;
  /** City factors the office typed. Every other city is worked out. */
  cities: { name: string; factor: number }[];
  /** Finishing and other works follow material prices. */
  autoIndex: boolean;
  /** Material cost per sq ft when finishing / other works were last typed. */
  basket?: number;
  updatedAt?: Date;
}

/*
 * Defaults, checked against what Pakistani builders and portals publish:
 *  - Quantities: a 5 marla double storey (~2,000 sq ft) takes ~500 bags of
 *    cement, ~3 tons of steel, 50–60 thousand bricks (Zameen, Graana).
 *  - Grey labour ~Rs 500/sq ft (Zameen, Oct 2026: 16.94 lakh on 3,375 sq ft).
 *  - Grey structure Rs 2,800–3,800/sq ft; complete Rs 4,650 (economical,
 *    Zameen) to Rs 7,500 (standard, Lahore developers) per sq ft.
 */
export const CONSTRUCTION_DEFAULTS: ConstructionConfig = {
  qty: { cement: 0.27, steel: 1.6, bricks: 27, sand: 1.6, crush: 0.75 },
  rates: { cement: 0, steel: 0, bricks: 0, sand: 0, crush: 0 },
  fallback: { cement: 1600, steel: 270, bricks: 18, sand: 70, crush: 125 },
  greyWorks: {
    excavation: 110,
    shuttering: 170,
    waterproofing: 45,
    plumbing: 300,
    electrical: 100,
  },
  labour: { grey: 480, finishing: 200 },
  finishing: { economy: 900, standard: 1350, premium: 2400, luxury: 4200 },
  finishSplit: [
    { key: 'tiles', label: 'Tiles, marble & flooring', pct: 30, shop: 'tile' },
    { key: 'doors', label: 'Doors & windows', pct: 20, shop: 'door' },
    { key: 'electrical', label: 'Wiring, switches, lights & fans', pct: 15 },
    { key: 'paint', label: 'Paint & ceilings', pct: 15 },
    { key: 'wardrobes', label: 'Wardrobes & woodwork', pct: 10, shop: 'wood' },
    { key: 'metal', label: 'Railings, grills, gate & metal works', pct: 10 },
  ],
  bathroom: {
    economy: 60_000,
    standard: 100_000,
    premium: 220_000,
    luxury: 450_000,
  },
  kitchen: {
    economy: 100_000,
    standard: 180_000,
    premium: 450_000,
    luxury: 900_000,
  },
  contractorPct: 10,
  contingencyPct: 5,
  basementFactor: 1.35,
  cities: [],
  autoIndex: true,
};

/**
 * Material cost per sq ft (Rs) of the market the default figures were set in
 * — October 2026, Lahore (cement 1,610, steel 272/kg, bricks 19, sand 65,
 * crush 125).
 */
const BASE_BASKET = 1580;

/** Typical building cost of a city against Lahore. */
const KNOWN_CITIES: [string, number][] = [
  ['Lahore', 1],
  ['Karachi', 1.05],
  ['Islamabad', 1.1],
  ['Rawalpindi', 1.05],
  ['Faisalabad', 0.93],
  ['Multan', 0.92],
  ['Peshawar', 1],
  ['Gujranwala', 0.95],
  ['Sialkot', 0.97],
  ['Hyderabad', 0.97],
  ['Quetta', 1.05],
  ['Bahawalpur', 0.9],
];

/** For any other city: its province. */
const PROVINCES: [RegExp, number][] = [
  [/islamabad|capital|ict/i, 1.1],
  [/punjab/i, 0.96],
  [/sindh/i, 1],
  [/khyber|kpk|^kp$|pakhtun/i, 0.98],
  [/baloch/i, 1.03],
  [/gilgit|azad|ajk|kashmir/i, 1.05],
];

export type CitySource =
  | 'office'
  | 'market'
  | 'typical'
  | 'province'
  | 'default';

/** The shop product type each material is bought as, and the unit it is priced per. */
const SHOP: Record<
  ConstructionMaterial,
  { type: string; unit: string; min: number; max: number; bulk?: number }
> = {
  // Prices outside [min, max] in the base unit are typos — or, at bulk× the
  // range, a price per ton / per thousand, which is divided back down.
  cement: { type: 'cement', unit: 'bag (50 kg)', min: 700, max: 4000 },
  steel: { type: 'steel', unit: 'kg', min: 100, max: 800, bulk: 1000 },
  bricks: { type: 'bricks', unit: 'brick', min: 5, max: 80, bulk: 1000 },
  sand: { type: 'sand', unit: 'cft', min: 15, max: 400 },
  crush: { type: 'bajri', unit: 'cft', min: 40, max: 600 },
};

export interface LiveRate {
  material: ConstructionMaterial;
  unit: string;
  /** Cheaper / typical / better — the 25th, 50th and 75th percentile. */
  low: number;
  mid: number;
  high: number;
  source: 'office' | 'shop' | 'default';
  count: number;
  href: string;
  updatedAt?: Date;
}

type ShopRate = Omit<LiveRate, 'source'>;

const DOC_ID = 'construction';
/** A city needs this many usable products of a material to have its own price. */
const MIN_CITY_PRODUCTS = 2;

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return Math.round(sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (i - lo));
}

const num = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
};

const key = (s: string) => s.trim().toLowerCase();
const scale = <T extends Record<string, number>>(o: T, by: number) =>
  Object.fromEntries(
    Object.entries(o).map(([k, v]) => [k, Math.round(v * by)]),
  ) as T;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** One material's price from a set of products, or null when none is usable. */
function rateFrom(
  material: ConstructionMaterial,
  products: ShopProduct[],
): ShopRate | null {
  const spec = SHOP[material];
  const list = products.filter((p) => p.type === spec.type && p.price > 0);
  const prices: number[] = [];
  for (const p of list) {
    let price = p.price;
    if (
      spec.bulk &&
      price >= spec.min * spec.bulk &&
      price <= spec.max * spec.bulk
    )
      price /= spec.bulk;
    if (price >= spec.min && price <= spec.max) prices.push(price);
  }
  prices.sort((a, b) => a - b);
  // Then anything far from the typical price (a stray tile among bricks).
  const median = percentile(prices, 0.5);
  const clean = prices.filter((p) => p >= median * 0.5 && p <= median * 2);
  if (!clean.length) return null;
  const updated = list.reduce<Date | undefined>(
    (m, p) => (p.updatedAt && (!m || p.updatedAt > m) ? p.updatedAt : m),
    undefined,
  );
  return {
    material,
    unit: spec.unit,
    low: percentile(clean, 0.25),
    mid: percentile(clean, 0.5),
    high: percentile(clean, 0.75),
    count: clean.length,
    href: list[0]?.href.split('/').slice(0, 2).join('/') || '/',
    updatedAt: updated,
  };
}

@Injectable()
export class ConstructionService {
  private cache: {
    at: number;
    data: Awaited<ReturnType<ConstructionService['compute']>>;
  } | null = null;

  constructor(
    private readonly shop: ShopService,
    @InjectConnection() private readonly conn: Connection,
  ) {}

  private get store() {
    return this.conn.db!.collection<
      { _id: string } & Partial<ConstructionConfig>
    >('tool_config');
  }

  /** The saved settings over the defaults, section by section. */
  async config(): Promise<ConstructionConfig> {
    const saved: Partial<ConstructionConfig> =
      (await this.store.findOne({ _id: DOC_ID })) ?? {};
    const d = CONSTRUCTION_DEFAULTS;
    return {
      qty: { ...d.qty, ...(saved.qty ?? {}) },
      rates: { ...d.rates, ...(saved.rates ?? {}) },
      fallback: { ...d.fallback, ...(saved.fallback ?? {}) },
      greyWorks: { ...d.greyWorks, ...(saved.greyWorks ?? {}) },
      labour: { ...d.labour, ...(saved.labour ?? {}) },
      finishing: { ...d.finishing, ...(saved.finishing ?? {}) },
      bathroom: { ...d.bathroom, ...(saved.bathroom ?? {}) },
      kitchen: { ...d.kitchen, ...(saved.kitchen ?? {}) },
      contractorPct: saved.contractorPct ?? d.contractorPct,
      contingencyPct: saved.contingencyPct ?? d.contingencyPct,
      finishSplit: saved.finishSplit?.length
        ? saved.finishSplit
        : d.finishSplit,
      basementFactor: saved.basementFactor ?? d.basementFactor,
      cities: saved.cities ?? d.cities,
      autoIndex: saved.autoIndex ?? d.autoIndex,
      basket: saved.basket,
      updatedAt: saved.updatedAt,
    };
  }

  /** Material cost per sq ft of covered area at these rates. */
  private basket(config: ConstructionConfig, rates: LiveRate[]): number {
    return CONSTRUCTION_MATERIALS.reduce(
      (s, m) =>
        s + config.qty[m] * (rates.find((r) => r.material === m)?.mid ?? 0),
      0,
    );
  }

  /** Everything worked out: rates, city rates and factors, the market index. */
  private async compute() {
    const [config, products, siteCities] = await Promise.all([
      this.config(),
      this.shop.listProducts(),
      this.conn
        .db!.collection('cities')
        .find({}, { projection: { name: 1, state: 1 } })
        .toArray()
        .catch(() => [] as { name?: string; state?: string }[]),
    ]);

    const shop = Object.fromEntries(
      CONSTRUCTION_MATERIALS.map((m) => [m, rateFrom(m, products)]),
    ) as Record<ConstructionMaterial, ShopRate | null>;

    const officeRate = (m: ConstructionMaterial) =>
      Number(config.rates[m]) || 0;
    const rates = CONSTRUCTION_MATERIALS.map((material): LiveRate => {
      const spec = SHOP[material];
      const office = officeRate(material);
      const live = shop[material];
      if (office > 0) {
        return {
          material,
          unit: spec.unit,
          low: office,
          mid: office,
          high: office,
          source: 'office',
          count: live?.count ?? 0,
          href: live?.href ?? '/',
          updatedAt: config.updatedAt,
        };
      }
      if (live) return { ...live, source: 'shop' };
      const f = config.fallback[material];
      return {
        material,
        unit: spec.unit,
        low: f,
        mid: f,
        high: f,
        source: 'default',
        count: 0,
        href: '/',
      };
    });

    // A city's own prices, where it has enough products (and the office has
    // not fixed the rate).
    const byCity = new Map<string, ShopProduct[]>();
    for (const p of products) {
      if (!p.city?.trim()) continue;
      const k = key(p.city);
      byCity.set(k, [...(byCity.get(k) ?? []), p]);
    }
    const cityRates = new Map<string, LiveRate[]>();
    for (const [k, list] of byCity) {
      const own = CONSTRUCTION_MATERIALS.flatMap((m): LiveRate[] => {
        if (officeRate(m) > 0) return [];
        const r = rateFrom(m, list);
        return r && r.count >= MIN_CITY_PRODUCTS
          ? [{ ...r, source: 'shop' }]
          : [];
      });
      if (own.length) cityRates.set(k, own);
    }

    // Every city on the site, then the typical ones, then the office's.
    const names = new Map<string, { name: string; state?: string }>();
    for (const c of siteCities) {
      const name = String(c.name ?? '').trim();
      if (name)
        names.set(key(name), {
          name,
          state: c.state ? String(c.state) : undefined,
        });
    }
    for (const [name] of KNOWN_CITIES)
      if (!names.has(key(name))) names.set(key(name), { name });
    for (const c of config.cities)
      if (!names.has(key(c.name))) names.set(key(c.name), { name: c.name });

    const national = this.basket(config, rates);
    const known = new Map(KNOWN_CITIES.map(([n, f]) => [key(n), f]));
    const order = new Map(KNOWN_CITIES.map(([n], i) => [key(n), i]));
    const cities = [...names.entries()]
      .map(([k, c]) => {
        const office = config.cities.find((x) => key(x.name) === k);
        const own = cityRates.get(k);
        let factor = 1;
        let source: CitySource = 'default';
        if (office) {
          factor = office.factor;
          source = 'office';
        } else if (own && own.length >= 3 && national > 0) {
          // Its own material prices, against the country's.
          const mixed = rates.map(
            (r) => own.find((o) => o.material === r.material) ?? r,
          );
          factor = round2(
            Math.min(1.5, Math.max(0.7, this.basket(config, mixed) / national)),
          );
          source = 'market';
        } else if (known.has(k)) {
          factor = known.get(k)!;
          source = 'typical';
        } else {
          const p = PROVINCES.find(([re]) => c.state && re.test(c.state));
          if (p) {
            factor = p[1];
            source = 'province';
          }
        }
        // Proper-case a name stored in lower case.
        const name =
          c.name === c.name.toLowerCase()
            ? c.name.replace(/\b\w/g, (ch) => ch.toUpperCase())
            : c.name;
        return { name, factor, source, ownRates: own?.length ?? 0 };
      })
      .sort(
        (a, b) =>
          (order.get(key(a.name)) ?? 999) - (order.get(key(b.name)) ?? 999) ||
          a.name.localeCompare(b.name),
      );

    // Finishing and other works follow material prices from when they were set.
    const base = config.basket || BASE_BASKET;
    const index =
      config.autoIndex && national > 0
        ? round2(Math.min(1.6, Math.max(0.7, national / base)))
        : 1;

    return { config, shop, rates, cityRates, cities, national, index };
  }

  /** Everything the calculator needs, cached for five minutes. */
  async publicData() {
    if (!this.cache || Date.now() - this.cache.at > 5 * 60_000) {
      this.cache = { at: Date.now(), data: await this.compute() };
    }
    const { config, rates, cityRates, cities, index } = this.cache.data;
    const cityName = new Map(cities.map((c) => [key(c.name), c.name]));
    return {
      config: {
        qty: config.qty,
        labour: config.labour,
        // Material-led figures follow material prices; labour does not.
        greyWorks: scale(config.greyWorks, index),
        finishing: scale(config.finishing, index),
        bathroom: scale(config.bathroom, index),
        kitchen: scale(config.kitchen, index),
        contractorPct: config.contractorPct,
        contingencyPct: config.contingencyPct,
        finishSplit: config.finishSplit,
        basementFactor: config.basementFactor,
        cities: cities.map(({ name, factor, source }) => ({
          name,
          factor,
          source,
        })),
        updatedAt: config.updatedAt,
      },
      rates,
      cityRates: Object.fromEntries(
        [...cityRates.entries()].map(([k, list]) => [
          cityName.get(k) ?? k,
          list,
        ]),
      ),
      index,
      generatedAt: new Date(),
    };
  }

  /** For the dashboard: the settings, the defaults and what is worked out today. */
  async adminData() {
    const data = await this.compute();
    return {
      config: data.config,
      defaults: CONSTRUCTION_DEFAULTS,
      shop: data.shop,
      auto: {
        index: data.index,
        basket: Math.round(data.national),
        baseBasket: Math.round(data.config.basket || BASE_BASKET),
        cities: data.cities,
      },
    };
  }

  async save(input: Partial<ConstructionConfig>) {
    const d = CONSTRUCTION_DEFAULTS;
    const block = <K extends string>(
      src: unknown,
      defaults: Record<K, number>,
      max: number,
      allowZero = false,
    ) => {
      const o = (src ?? {}) as Record<string, unknown>;
      return Object.fromEntries(
        (Object.keys(defaults) as K[]).map((k) => [
          k,
          num(o[k], allowZero ? 0 : 0.0001, max, defaults[k]),
        ]),
      ) as Record<K, number>;
    };
    const split = Array.isArray(input.finishSplit)
      ? input.finishSplit
          .map((s) => ({
            key:
              String(s?.key ?? '')
                .replace(/[^a-z0-9-]/gi, '')
                .slice(0, 30) || 'item',
            label: String(s?.label ?? '')
              .replace(/[<>]/g, '')
              .trim()
              .slice(0, 60),
            pct: num(s?.pct, 0, 100, 0),
            ...(s?.shop
              ? {
                  shop: String(s.shop)
                    .replace(/[^a-z0-9-]/gi, '')
                    .slice(0, 40),
                }
              : {}),
          }))
          .filter((s) => s.label && s.pct > 0)
          .slice(0, 20)
      : d.finishSplit;
    // Only the cities the office fixed; the rest stay automatic.
    const cities = Array.isArray(input.cities)
      ? input.cities
          .map((c) => ({
            name: String(c?.name ?? '')
              .replace(/[<>]/g, '')
              .trim()
              .slice(0, 40),
            factor: num(c?.factor, 0.5, 2, 0),
          }))
          .filter((c) => c.name && c.factor > 0)
          .slice(0, 200)
      : [];
    if (!split.length)
      throw new BadRequestException('Add at least one finishing item.');

    const prev = await this.config();
    const greyWorks = block(input.greyWorks, d.greyWorks, 50_000, true);
    const finishing = block(input.finishing, d.finishing, 100_000);
    const bathroom = block(input.bathroom, d.bathroom, 50_000_000, true);
    const kitchen = block(input.kitchen, d.kitchen, 50_000_000, true);
    // Typing new finishing / other-works figures means "these are today's":
    // the market index starts again from today's material prices.
    const retyped =
      JSON.stringify([greyWorks, finishing, bathroom, kitchen]) !==
      JSON.stringify([
        prev.greyWorks,
        prev.finishing,
        prev.bathroom,
        prev.kitchen,
      ]);
    const basket = retyped
      ? Math.round((await this.compute()).national) || prev.basket
      : prev.basket;

    const doc: ConstructionConfig = {
      qty: block(input.qty, d.qty, 100),
      rates: block(input.rates, d.rates, 1_000_000, true),
      fallback: block(input.fallback, d.fallback, 1_000_000),
      labour: block(input.labour, d.labour, 50_000, true),
      greyWorks,
      finishing,
      bathroom,
      kitchen,
      contractorPct: num(input.contractorPct, 0, 40, d.contractorPct),
      contingencyPct: num(input.contingencyPct, 0, 25, d.contingencyPct),
      finishSplit: split,
      basementFactor: num(input.basementFactor, 1, 3, d.basementFactor),
      cities,
      autoIndex: input.autoIndex !== false,
      ...(basket ? { basket } : {}),
      updatedAt: new Date(),
    };
    await this.store.updateOne(
      { _id: DOC_ID },
      { $set: doc, ...(basket ? {} : { $unset: { basket: '' } }) },
      { upsert: true },
    );
    this.cache = null;
    return this.adminData();
  }

  /** Back to automatic everything. */
  async reset() {
    await this.store.deleteOne({ _id: DOC_ID });
    this.cache = null;
    return this.adminData();
  }
}

/*
 * Property tools: the list, and the sums behind them. Kept free of React so
 * every number can be checked on its own.
 */

export interface ToolInfo {
  slug: string;
  title: string;
  short: string;
  description: string;
  icon: 'ruler' | 'hammer' | 'landmark' | 'calendar' | 'trending';
}

export const TOOLS: ToolInfo[] = [
  {
    slug: 'area-unit-converter',
    title: 'Area Unit Converter',
    short: 'Marla, kanal, sq ft, sq yd, acre — and plot length × width',
    description: 'Convert marla, kanal, square feet, square yards, square metres, acres and more — on the 225, 250 or 272.25 sq ft marla.',
    icon: 'ruler',
  },
  {
    slug: 'construction-cost-calculator',
    title: 'Construction Cost Calculator',
    short: "Grey structure or a complete house, on today's material rates",
    description: "Estimate the cost of building a house in Pakistan from today's cement, steel, bricks, sand and crush rates — grey structure or complete.",
    icon: 'hammer',
  },
  {
    slug: 'home-loan-calculator',
    title: 'Home Loan Calculator',
    short: 'Monthly instalment, total interest and the income banks ask for',
    description: 'Work out the monthly instalment on a home loan, the interest you pay over its life and the income a bank will want to see.',
    icon: 'landmark',
  },
  {
    slug: 'installment-plan-calculator',
    title: 'Plot Installment Plan',
    short: 'Down payment, monthly or quarterly instalments and balloon payments',
    description: 'Lay out a plot or house instalment plan: down payment, monthly, quarterly or half-yearly instalments, balloon and possession payments.',
    icon: 'calendar',
  },
  {
    slug: 'rental-yield-calculator',
    title: 'Rental Yield & ROI',
    short: 'Is the rent worth the price? Yield, payback and return',
    description: 'Gross and net rental yield, payback years and total return with price growth — and how it compares with a bank deposit.',
    icon: 'trending',
  },
];

export const toolBySlug = (slug: string) => TOOLS.find((t) => t.slug === slug)!;

/** "Rs 1.12 Crore", "Rs 85 Thousand". */
export function rsShort(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return 'Rs 0';
  if (n < 1000) return `Rs ${Math.round(n)}`;
  const units: [number, string][] = [
    [1e9, 'Arab'],
    [1e7, 'Crore'],
    [1e5, 'Lakh'],
    [1e3, 'Thousand'],
  ];
  const [d, w] = units.find(([d]) => n >= d)!;
  return `Rs ${Number((n / d).toFixed(2))} ${w}`;
}

/** Rs 1,23,45,678 — the Pakistani grouping. */
export function rupees(n: number): string {
  if (!Number.isFinite(n)) return 'Rs 0';
  return `Rs ${Math.round(n).toLocaleString('en-PK')}`;
}

/* ───────────────────── Construction cost ───────────────────── */

export type Material = 'cement' | 'steel' | 'bricks' | 'sand' | 'crush';
export type Quality = 'economy' | 'standard' | 'premium' | 'luxury';
export type GreyWork = 'excavation' | 'shuttering' | 'waterproofing' | 'plumbing' | 'electrical';

export interface MaterialRate {
  material: Material;
  unit: string;
  low: number;
  mid: number;
  high: number;
  source: 'office' | 'shop' | 'default';
  count: number;
  href: string;
  updatedAt?: string;
}

export interface ConstructionData {
  config: {
    qty: Record<Material, number>;
    greyWorks: Record<GreyWork, number>;
    labour: { grey: number; finishing: number };
    finishing: Record<Quality, number>;
    finishSplit: { key: string; label: string; pct: number; shop?: string }[];
    bathroom: Record<Quality, number>;
    kitchen: Record<Quality, number>;
    contractorPct: number;
    basementFactor: number;
    cities: { name: string; factor: number; source?: string }[];
    updatedAt?: string;
  };
  rates: MaterialRate[];
  /** A city's own material prices, where its shops list enough products. */
  cityRates?: Record<string, MaterialRate[]>;
  /** How far material prices have moved since the per-sq-ft figures were set. */
  index?: number;
  generatedAt?: string;
}

/** Used when the API cannot be reached — the calculator still works. */
export const CONSTRUCTION_FALLBACK: ConstructionData = {
  config: {
    qty: { cement: 0.27, steel: 1.6, bricks: 27, sand: 1.6, crush: 0.75 },
    greyWorks: { excavation: 110, shuttering: 150, waterproofing: 45, plumbing: 260, electrical: 100 },
    labour: { grey: 480, finishing: 450 },
    finishing: { economy: 1400, standard: 2250, premium: 3600, luxury: 5900 },
    finishSplit: [
      { key: 'tiles', label: 'Tiles, marble & flooring', pct: 30, shop: 'tile' },
      { key: 'doors', label: 'Doors & windows', pct: 20, shop: 'door' },
      { key: 'electrical', label: 'Wiring, switches, lights & fans', pct: 15 },
      { key: 'paint', label: 'Paint & ceilings', pct: 15 },
      { key: 'wardrobes', label: 'Wardrobes & woodwork', pct: 10, shop: 'wood' },
      { key: 'metal', label: 'Railings, grills, gate & metal works', pct: 10 },
    ],
    bathroom: { economy: 70000, standard: 140000, premium: 300000, luxury: 600000 },
    kitchen: { economy: 150000, standard: 350000, premium: 800000, luxury: 1500000 },
    contractorPct: 10,
    basementFactor: 1.35,
    cities: [
      { name: 'Lahore', factor: 1 },
      { name: 'Karachi', factor: 1.05 },
      { name: 'Islamabad', factor: 1.1 },
      { name: 'Rawalpindi', factor: 1.05 },
    ],
  },
  rates: [
    { material: 'cement', unit: 'bag (50 kg)', low: 1600, mid: 1600, high: 1600, source: 'default', count: 0, href: '/today-cement-rate-in-pakistan' },
    { material: 'steel', unit: 'kg', low: 270, mid: 270, high: 270, source: 'default', count: 0, href: '/today-steel-rate-in-pakistan' },
    { material: 'bricks', unit: 'brick', low: 18, mid: 18, high: 18, source: 'default', count: 0, href: '/today-bricks-rate-in-pakistan' },
    { material: 'sand', unit: 'cft', low: 70, mid: 70, high: 70, source: 'default', count: 0, href: '/today-sand-rate-in-pakistan' },
    { material: 'crush', unit: 'cft', low: 125, mid: 125, high: 125, source: 'default', count: 0, href: '/today-bajri-rate-in-pakistan' },
  ],
};

/**
 * The API's data over the built-in figures, section by section — so an older
 * or partial response (e.g. while a deploy is half done) still gives a full,
 * working calculator.
 */
export function withDefaults(raw: Partial<ConstructionData> | null | undefined): ConstructionData {
  const d = CONSTRUCTION_FALLBACK;
  const c = (raw?.config ?? {}) as Partial<ConstructionData['config']>;
  const n = <T extends Record<string, number>>(base: T, over: unknown): T => {
    const o = (over ?? {}) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(base).map(([k, v]) => [k, Number.isFinite(Number(o[k])) && o[k] !== null && o[k] !== '' ? Number(o[k]) : v])) as T;
  };
  return {
    config: {
      qty: n(d.config.qty, c.qty),
      greyWorks: n(d.config.greyWorks, c.greyWorks),
      labour: n(d.config.labour, c.labour),
      finishing: n(d.config.finishing, c.finishing),
      finishSplit: Array.isArray(c.finishSplit) && c.finishSplit.length ? c.finishSplit : d.config.finishSplit,
      bathroom: n(d.config.bathroom, c.bathroom),
      kitchen: n(d.config.kitchen, c.kitchen),
      contractorPct: Number.isFinite(Number(c.contractorPct)) ? Number(c.contractorPct) : d.config.contractorPct,
      basementFactor: Number(c.basementFactor) > 0 ? Number(c.basementFactor) : d.config.basementFactor,
      cities: Array.isArray(c.cities) && c.cities.length ? c.cities : d.config.cities,
      updatedAt: c.updatedAt,
    },
    rates: Array.isArray(raw?.rates) && raw.rates.length ? raw.rates : d.rates,
    cityRates: raw?.cityRates ?? {},
    index: raw?.index,
    generatedAt: raw?.generatedAt,
  };
}

export const MATERIAL_LABEL: Record<Material, string> = {
  cement: 'Cement',
  steel: 'Steel (sarya)',
  bricks: 'Bricks',
  sand: 'Sand (ret)',
  crush: 'Crush (bajri)',
};

export const GREY_WORK_LABEL: Record<GreyWork, string> = {
  excavation: 'Digging, earth filling & compaction',
  shuttering: 'Shuttering & formwork',
  waterproofing: 'Waterproofing, termite proofing & roof insulation',
  plumbing: 'Water, sewerage & gas pipes, tanks and pumps',
  electrical: 'Electrical conduits & switch boxes',
};

export const QUALITY: { key: Quality; label: string; hint: string }[] = [
  { key: 'economy', label: 'Economy', hint: 'C/B class bricks, local fittings, basic tiles, distemper' },
  { key: 'standard', label: 'Standard', hint: 'A class bricks, good local brands — what most homes use' },
  { key: 'premium', label: 'Premium', hint: 'A+ bricks, imported tiles, branded fittings, solid wood' },
  { key: 'luxury', label: 'Luxury', hint: 'Marble, imported fittings, designer finish' },
];

const TIER: Record<Quality, { rate: 'low' | 'mid' | 'high'; grey: number; flabour: number }> = {
  economy: { rate: 'low', grey: 0.95, flabour: 0.85 },
  standard: { rate: 'mid', grey: 1, flabour: 1 },
  premium: { rate: 'high', grey: 1.08, flabour: 1.25 },
  luxury: { rate: 'high', grey: 1.15, flabour: 1.6 },
};

export interface FloorPlan {
  floors: number; // storeys above ground: 1 single, 2 double, 3 triple
  basement: boolean;
}

/**
 * Share of the plot one floor usually covers once setbacks are left — the
 * covered areas Pakistani portals quote (5 marla double storey ≈ 2,025 sq ft,
 * 10 marla ≈ 3,375, 1 kanal ≈ 6,300).
 */
export function groundCoverage(plotSqft: number): number {
  const marla = plotSqft / 225;
  if (marla <= 5.01) return 0.9;
  if (marla <= 8.01) return 0.85;
  if (marla <= 10.01) return 0.75;
  if (marla <= 20.01) return 0.7;
  return 0.62;
}

/** Covered area, floor by floor. */
export function coveredAreas(plotSqft: number, plan: FloorPlan): { label: string; sqft: number; basement?: boolean }[] {
  if (plotSqft <= 0) return [];
  const floor = Math.round(plotSqft * groundCoverage(plotSqft));
  const names = ['Ground floor', 'First floor', 'Second floor', 'Third floor'];
  const rows: { label: string; sqft: number; basement?: boolean }[] = [];
  if (plan.basement) rows.push({ label: 'Basement', sqft: floor, basement: true });
  for (let i = 0; i < plan.floors; i++) rows.push({ label: names[i] ?? `Floor ${i + 1}`, sqft: floor });
  return rows;
}

/** Bathrooms and kitchens a house of this size usually has. */
export function usualRooms(area: number, floors: number): { bathrooms: number; kitchens: number; bedrooms: number } {
  if (area <= 0) return { bathrooms: 1, kitchens: 1, bedrooms: 1 };
  const bedrooms = Math.min(7, Math.max(1, Math.round(area / 800)));
  return { bedrooms, bathrooms: bedrooms + 1, kitchens: floors >= 2 && area >= 1800 ? 2 : 1 };
}

export interface EstimateInput {
  covered: number; // sq ft above ground
  basement: number; // sq ft below ground
  kind: 'grey' | 'complete';
  quality: Quality;
  /** full: the contractor buys material too (and adds his margin); labour: you buy material. */
  mode: 'full' | 'labour';
  cityFactor: number;
  /** The city's own material prices, where it has them. */
  cityRates?: MaterialRate[];
  bathrooms: number;
  kitchens: number;
}

export interface EstimateLine {
  key: string;
  label: string;
  qty?: number;
  unit?: string;
  rate?: number;
  amount: number;
  href?: string;
  source?: MaterialRate['source'];
  labour?: boolean;
}

export interface EstimateGroup {
  key: string;
  title: string;
  total: number;
  lines: EstimateLine[];
}

export interface EstimatePart {
  key: 'grey' | 'finishing' | 'labour' | 'contractor';
  title: string;
  /** What it covers, in plain words. */
  blurb: string;
  amount: number;
  lines: EstimateLine[];
}

export interface Estimate {
  area: number;
  groups: EstimateGroup[];
  /** Where the money goes: grey material, finishing material, labour, contractor. */
  parts: EstimatePart[];
  materials: number;
  labour: number;
  contractor: number;
  greyTotal: number;
  finishingTotal: number;
  total: number;
  perSqft: number;
  low: number;
  high: number;
  stages: { label: string; amount: number }[];
  months: { grey: number; finishing: number };
}

const sum = (lines: EstimateLine[]) => lines.reduce((s, l) => s + l.amount, 0);

/**
 * The estimate. The five structure materials are priced from today's rates
 * (the city's own where it has them; cheaper, typical or better products by
 * quality); other works, labour and finishing are per square foot and follow
 * the city; bathrooms and kitchens are priced per room. A basement's grey
 * structure costs `basementFactor` times more per sq ft.
 */
export function estimate(input: EstimateInput, data: ConstructionData): Estimate {
  const c = data.config;
  const t = TIER[input.quality];
  const above = Math.max(0, input.covered);
  const below = Math.max(0, input.basement);
  const area = above + below;
  const greyArea = (above + below * c.basementFactor) * t.grey;
  const f = input.cityFactor || 1;

  const rateOf = (m: Material) =>
    input.cityRates?.find((r) => r.material === m) ??
    data.rates.find((r) => r.material === m) ??
    CONSTRUCTION_FALLBACK.rates.find((r) => r.material === m)!;

  const structure: EstimateLine[] = (['cement', 'steel', 'bricks', 'sand', 'crush'] as Material[]).map((m) => {
    const rate = rateOf(m);
    const qty = Math.round(c.qty[m] * greyArea);
    const price = rate[t.rate];
    return { key: m, label: MATERIAL_LABEL[m], qty, unit: rate.unit, rate: price, amount: qty * price, href: rate.href, source: rate.source };
  });
  for (const w of ['excavation', 'shuttering', 'waterproofing'] as GreyWork[]) {
    structure.push({ key: w, label: GREY_WORK_LABEL[w], amount: Math.round(c.greyWorks[w] * greyArea * f) });
  }
  structure.push({ key: 'glabour', label: 'Labour — masons, steel fixers, shuttering', amount: Math.round(c.labour.grey * greyArea * f), labour: true });

  const services: EstimateLine[] = (['plumbing', 'electrical'] as GreyWork[]).map((w) => ({
    key: w,
    label: GREY_WORK_LABEL[w],
    amount: Math.round(c.greyWorks[w] * greyArea * f),
  }));

  const groups: EstimateGroup[] = [
    { key: 'structure', title: 'Foundation & structure', total: sum(structure), lines: structure },
    { key: 'services', title: 'Plumbing & electrical (inside the walls)', total: sum(services), lines: services },
  ];
  const greyTotal = groups.reduce((s, g) => s + g.total, 0);

  if (input.kind === 'complete') {
    const pot = c.finishing[input.quality] * area * f;
    const pctSum = c.finishSplit.reduce((s, x) => s + x.pct, 0) || 100;
    const finishing: EstimateLine[] = c.finishSplit.map((x) => ({
      key: x.key,
      label: x.label,
      amount: Math.round((pot * x.pct) / pctSum),
      href: x.shop ? `/today-${x.shop}-rate-in-pakistan` : undefined,
    }));
    finishing.push({
      key: 'flabour',
      label: 'Labour — tile fixers, carpenters, painters, electricians, plumbers',
      amount: Math.round(c.labour.finishing * area * t.flabour * f),
      labour: true,
    });
    const baths = Math.max(0, Math.round(input.bathrooms));
    const kitchens = Math.max(0, Math.round(input.kitchens));
    const fittings: EstimateLine[] = [
      { key: 'bath', label: 'Bathroom fittings — WC, basin, shower, taps, geyser', qty: baths, unit: 'bathroom', rate: c.bathroom[input.quality], amount: baths * c.bathroom[input.quality] },
      { key: 'kitchen', label: 'Kitchen — cabinets, counter, sink, hood & hob', qty: kitchens, unit: 'kitchen', rate: c.kitchen[input.quality], amount: kitchens * c.kitchen[input.quality] },
    ];
    groups.push({ key: 'finishing', title: 'Finishing', total: sum(finishing), lines: finishing });
    groups.push({ key: 'fittings', title: 'Bathrooms & kitchens', total: sum(fittings), lines: fittings });
  }
  const finishingTotal = groups.filter((g) => g.key === 'finishing' || g.key === 'fittings').reduce((s, g) => s + g.total, 0);

  const all = groups.flatMap((g) => g.lines);
  const labour = sum(all.filter((l) => l.labour));
  const materials = sum(all) - labour;
  const contractor = input.mode === 'full' ? Math.round(((materials + labour) * c.contractorPct) / 100) : 0;
  const total = materials + labour + contractor;
  const share = (n: number) => (greyTotal + finishingTotal ? n * (total / (greyTotal + finishingTotal)) : 0);

  const pick = (keys: string[], labour: boolean) =>
    groups.filter((g) => keys.includes(g.key)).flatMap((g) => g.lines).filter((l) => !!l.labour === labour);
  const greyLines = pick(['structure', 'services'], false);
  const finLines = pick(['finishing', 'fittings'], false);
  const labLines = groups.flatMap((g) => g.lines).filter((l) => l.labour);
  const parts: EstimatePart[] = [
    {
      key: 'grey',
      title: 'Grey structure material',
      blurb: 'Cement, steel, bricks, sand and crush, digging, shuttering, waterproofing, and the pipes and conduits inside the walls.',
      amount: sum(greyLines),
      lines: greyLines,
    },
    ...(finLines.length
      ? [
          {
            key: 'finishing' as const,
            title: 'Finishing material',
            blurb: 'Tiles, doors and windows, wiring, lights and fans, paint, woodwork, bathrooms and kitchens.',
            amount: sum(finLines),
            lines: finLines,
          },
        ]
      : []),
    {
      key: 'labour',
      title: 'Labour',
      blurb: input.kind === 'complete' ? 'Masons, steel fixers and shuttering crew, then tile fixers, carpenters, painters, electricians and plumbers.' : 'Masons, steel fixers and the shuttering crew.',
      amount: labour,
      lines: labLines,
    },
    ...(contractor
      ? [
          {
            key: 'contractor' as const,
            title: "Contractor's margin",
            blurb: `His overhead and profit on a full contract (${c.contractorPct}%). On a labour contract you buy the material yourself and keep this.`,
            amount: contractor,
            lines: [],
          },
        ]
      : []),
  ];

  return {
    area,
    groups,
    parts,
    materials,
    labour,
    contractor,
    greyTotal,
    finishingTotal,
    total,
    perSqft: area ? total / area : 0,
    // Prices move and every house differs: a range is the honest answer.
    low: total * 0.93,
    high: total * 1.08,
    stages: [
      { label: 'Digging, foundation & plinth', amount: share(greyTotal * 0.25) },
      { label: 'Columns, beams & roof slabs', amount: share(greyTotal * 0.4) },
      { label: 'Brick walls', amount: share(greyTotal * 0.2) },
      { label: 'Plaster, pipes & conduits', amount: share(greyTotal * 0.15) },
      ...(finishingTotal ? [{ label: 'Finishing, bathrooms & kitchens', amount: share(finishingTotal) }] : []),
    ],
    months: {
      grey: area ? Math.max(3, Math.round(2.5 + area / 1200)) : 0,
      finishing: area && input.kind === 'complete' ? Math.max(2, Math.round(2 + area / 1500)) : 0,
    },
  };
}

/* ───────────────────── Loans and plans ───────────────────── */

/** Monthly instalment on a reducing-balance loan. */
export function emi(principal: number, annualRate: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  const r = annualRate / 100 / 12;
  if (r === 0) return principal / months;
  const k = Math.pow(1 + r, months);
  return (principal * r * k) / (k - 1);
}

/** Year by year: what was paid, how much of it was interest, what is left. */
export function amortisation(principal: number, annualRate: number, months: number) {
  const pay = emi(principal, annualRate, months);
  const r = annualRate / 100 / 12;
  let balance = principal;
  const years: { year: number; paid: number; interest: number; principal: number; balance: number }[] = [];
  for (let m = 1; m <= months; m++) {
    const interest = balance * r;
    const toPrincipal = Math.min(balance, pay - interest);
    balance = Math.max(0, balance - toPrincipal);
    const y = Math.ceil(m / 12);
    const row = years[y - 1] ?? (years[y - 1] = { year: y, paid: 0, interest: 0, principal: 0, balance: 0 });
    row.paid += pay;
    row.interest += interest;
    row.principal += toPrincipal;
    row.balance = balance;
  }
  return years;
}

export type Frequency = 1 | 3 | 6;

export interface PlanInput {
  price: number;
  downPct: number;
  months: number;
  every: Frequency;
  balloons: number; // extra lump sums, spread evenly through the plan
  balloonPct: number; // of the price, each
  possessionPct: number; // due at possession, at the end
  start: Date;
}

export interface PlanRow {
  n: number;
  date: Date;
  label: string;
  amount: number;
  paid: number;
}

export function installmentPlan(p: PlanInput): { rows: PlanRow[]; instalment: number; count: number; down: number; possession: number; balloon: number; error?: string } {
  const down = (p.price * p.downPct) / 100;
  const possession = (p.price * p.possessionPct) / 100;
  const balloon = (p.price * p.balloonPct) / 100;
  const count = Math.max(1, Math.floor(p.months / p.every));
  const rest = p.price - down - possession - balloon * p.balloons;
  if (p.price <= 0) return { rows: [], instalment: 0, count, down, possession, balloon };
  if (rest < 0) return { rows: [], instalment: 0, count, down, possession, balloon, error: 'Down payment, balloons and possession add up to more than the price.' };
  const instalment = rest / count;

  const rows: PlanRow[] = [];
  let paid = down;
  const at = (months: number) => {
    const d = new Date(p.start);
    d.setMonth(d.getMonth() + months);
    return d;
  };
  rows.push({ n: 0, date: at(0), label: 'Down payment', amount: down, paid });
  // Balloons fall at even points of the plan, on an instalment date.
  const balloonAt = new Set<number>();
  for (let b = 1; b <= p.balloons; b++) balloonAt.add(Math.max(1, Math.round((count * b) / (p.balloons + 1))));
  for (let i = 1; i <= count; i++) {
    paid += instalment;
    rows.push({ n: i, date: at(i * p.every), label: `Instalment ${i}`, amount: instalment, paid });
    if (balloonAt.has(i) && balloon > 0) {
      paid += balloon;
      rows.push({ n: i, date: at(i * p.every), label: 'Balloon payment', amount: balloon, paid });
    }
  }
  if (possession > 0) {
    paid += possession;
    rows.push({ n: count + 1, date: at(count * p.every), label: 'On possession', amount: possession, paid });
  }
  return { rows, instalment, count, down, possession, balloon };
}

export interface YieldInput {
  price: number;
  buyingCostPct: number; // transfer, taxes, commission
  rent: number; // per month
  vacancyMonths: number; // per year
  expenses: number; // per year: maintenance, property tax, insurance
  growthPct: number; // price growth per year
  rentGrowthPct: number; // rent rise per year
  years: number;
  bankPct: number; // what the money would earn in a bank instead
}

export function rentalYield(i: YieldInput) {
  const invested = i.price * (1 + i.buyingCostPct / 100);
  const grossYear = i.rent * 12;
  const netYear = i.rent * Math.max(0, 12 - i.vacancyMonths) - i.expenses;
  const gross = i.price ? (grossYear / i.price) * 100 : 0;
  const net = invested ? (netYear / invested) * 100 : 0;
  const payback = netYear > 0 ? invested / netYear : Infinity;

  let rentTotal = 0;
  let rent = i.rent;
  for (let y = 0; y < i.years; y++) {
    rentTotal += rent * Math.max(0, 12 - i.vacancyMonths) - i.expenses;
    rent *= 1 + i.rentGrowthPct / 100;
  }
  const value = i.price * Math.pow(1 + i.growthPct / 100, i.years);
  const gain = value - invested + rentTotal;
  const roi = invested ? (gain / invested) * 100 : 0;
  const yearly = invested && i.years ? (Math.pow(Math.max(0, (invested + gain) / invested), 1 / i.years) - 1) * 100 : 0;
  const bank = invested * (Math.pow(1 + i.bankPct / 100, i.years) - 1);
  return { invested, grossYear, netYear, gross, net, payback, rentTotal, value, gain, roi, yearly, bank };
}

/**
 * What the site assistant can look up and work out. Server only.
 *
 * Facts come from the live API (listings, places, market prices, material
 * rates, agents); sums come from the same functions the site's calculators
 * use (lib/tools.ts, lib/area-units.ts) — so an answer in the chat and the
 * calculator page always agree, and the model never does arithmetic itself.
 */
import { coveredAreas, emi, estimate, installmentPlan, rentalYield, roomLimits, roomMaxima, usualRooms, withDefaults, CONSTRUCTION_FALLBACK, type ConstructionData, type Quality } from "@/lib/tools";
import { convert, type UnitKey } from "@/lib/area-units";
import { searchUrl } from "@/lib/search";

const RAW = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3005";
const API = `${RAW.trim().replace(/\/$/, "")}/api`;

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`API ${res.status} for ${path}`);
  return res.json() as Promise<T>;
}

/** Cached for a few minutes: rates and the calculator settings change rarely. */
const memo = new Map<string, { at: number; v: unknown }>();
async function cached<T>(key: string, ms: number, fn: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < ms) return hit.v as T;
  const v = await fn();
  memo.set(key, { at: Date.now(), v });
  return v;
}

const rs = (n: number) => {
  const v = Math.round(Number(n) || 0);
  const t = (x: number) => String(Number(x.toFixed(2)));
  if (v >= 1e7) return `PKR ${t(v / 1e7)} Crore`;
  if (v >= 1e5) return `PKR ${t(v / 1e5)} Lakh`;
  return `PKR ${v.toLocaleString("en-PK")}`;
};

/* ── tool definitions (OpenAI-style function calling) ───────────────────── */

const num = (description: string) => ({ type: "number", description });
const str = (description: string, e?: string[]) => ({ type: "string", description, ...(e ? { enum: e } : {}) });

export const TOOL_DEFS = [
  {
    type: "function",
    function: {
      name: "find_places",
      description: "Find areas, societies, phases and cities by name (e.g. 'bahria town', 'dha phase 6 lahore', 'johar town'). Returns ids for search_listings / market_prices, listing counts, and society facts (developer, approval, possession, plot sizes).",
      parameters: { type: "object", properties: { query: str("The place as the user wrote it"), city: str("City, if the user said one") }, required: ["query"] },
    },
  },
  {
    type: "function",
    function: {
      name: "search_listings",
      description: "Search live listings. Matching listings are shown to the user as cards automatically; you only summarise. Pass place_ids / city_id from find_places, OR pass location / city directly.",
      parameters: {
        type: "object",
        properties: {
          place_ids: { type: "array", items: { type: "string" }, description: "Area/society ids from find_places" },
          city_id: str("City id from find_places, when searching a whole city"),
          location: str("Area, society or city name (e.g. 'Bahria Town Lahore', 'DHA Phase 6', 'Johar Town')"),
          city: str("City name (e.g. 'Lahore', 'Karachi', 'Islamabad')"),
          purpose: str("Buying or renting", ["sale", "rent"]),
          types: { type: "array", items: { type: "string", enum: ["house", "plot", "flat", "commercial", "shop", "office", "factory", "hotel", "restaurant"] }, description: "Property types" },
          min_price: num("Minimum price in PKR (rent: per month)"),
          max_price: num("Maximum price in PKR (rent: per month)"),
          min_marla: num("Minimum size in marla (1 kanal = 20 marla)"),
          max_marla: num("Maximum size in marla"),
          min_beds: num("Minimum bedrooms"),
          keywords: str("Words to look for in the listing, e.g. 'corner', 'furnished', 'park facing'"),
          sort: str("Order", ["best", "cheapest", "newest", "largest", "expensive"]),
        },
        required: ["purpose"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "market_prices",
      description: "What property actually costs in a place right now, from its live listings: median price, typical range, price per marla, and breakdown by marla/kanal size. Use for 'rates', 'what is the price of a 5 marla house in X', 'is this a good price', area comparisons.",
      parameters: {
        type: "object",
        properties: {
          place_ids: { type: "array", items: { type: "string" } },
          city_id: str("City id"),
          location: str("Area, society or city name (e.g. 'Bahria Town Lahore', 'DHA Lahore')"),
          city: str("City name (e.g. 'Lahore', 'Karachi', 'Islamabad')"),
          purpose: str("sale or rent; omit for both", ["sale", "rent"]),
          types: { type: "array", items: { type: "string" } },
          min_marla: num("Only this size and up (marla)"),
          max_marla: num("Only up to this size (marla)"),
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "material_rates",
      description: "Today's live construction material prices on the site (cement, steel/sarya, bricks, sand/ret, bajri/crush, tiles, wood, doors) including brand-wise rates. Call this immediately whenever the user asks about material rates, cement rate, steel rate, or construction rates.",
      parameters: { type: "object", properties: { material: str("Specific material or brand (e.g. 'cement', 'steel', 'bricks', 'sand', 'bajri', 'maple leaf'), or omit for full rates table") } },
    },
  },
  {
    type: "function",
    function: {
      name: "construction_cost",
      description: "Calculate the cost of building a house in Pakistan using today's live material & labour rates. Returns Grey Structure vs Complete House costs (Economy, Standard, Premium), stage-by-stage breakdown, and quick comparison across 3, 5, 10 Marla and 1 Kanal. Call immediately when the user asks about construction cost.",
      parameters: {
        type: "object",
        properties: {
          plot_marla: num("Plot size in marla (1 kanal = 20 marla; default 5 if user did not specify)"),
          floors: num("Storeys above ground: 1 single storey, 2 double storey (default 2), 3 triple"),
          basement: { type: "boolean" },
          kind: str("Grey structure only, or complete (finished) house", ["grey", "complete"]),
          quality: str("Finish quality", ["economy", "standard", "premium", "luxury"]),
          mode: str("'full': with material + labour; 'labour': labour-only contract", ["full", "labour"]),
          city: str("City name (default Lahore)"),
          bedrooms: num("Bedrooms, if the user said"),
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "home_loan",
      description: "Monthly instalment (EMI) of a home loan on a reducing balance, with down payment and total interest.",
      parameters: { type: "object", properties: { price: num("Property price PKR"), down_payment_percent: num("Down payment % (default 20)"), annual_rate: num("Interest % per year (default 20)"), years: num("Years (default 20)") }, required: ["price"] },
    },
  },
  {
    type: "function",
    function: {
      name: "installment_plan",
      description: "A builder/society installment plan: down payment, monthly/quarterly instalments, balloon payments, possession amount.",
      parameters: {
        type: "object",
        properties: { price: num("Total price PKR"), down_payment_percent: num("Down %"), months: num("Plan length in months"), every_months: num("1 monthly, 3 quarterly, 6 half-yearly"), balloons: num("Number of balloon payments"), balloon_percent: num("Each balloon, % of price"), possession_percent: num("Due on possession, % of price") },
        required: ["price"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "rental_yield",
      description: "Rental yield, payback period and 5-year return on a property bought to rent out.",
      parameters: {
        type: "object",
        properties: { price: num("Price PKR"), rent: num("Rent per month PKR"), buying_cost_percent: num("Transfer, tax, commission % (default 4)"), vacancy_months: num("Empty months a year (default 1)"), expenses_per_year: num("Maintenance etc. per year"), growth_percent: num("Price growth % a year (default 8)"), rent_growth_percent: num("Rent rise % a year (default 8)"), years: num("Years held (default 5)"), bank_percent: num("Bank profit % instead (default 11)") },
        required: ["price", "rent"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "convert_area",
      description: "Convert land sizes: marla, kanal, sqft, sqyd (gaz), sqm, acre, killa, murabba, sarsai, karam, hectare.",
      parameters: { type: "object", properties: { value: num("Amount"), from: str("Unit"), to: str("Unit"), marla_sqft: num("Square feet in one marla (225 default; 272.25 revenue marla; 250 in some areas)") }, required: ["value", "from", "to"] },
    },
  },
  {
    type: "function",
    function: {
      name: "find_agents",
      description: "Verified property dealers / agencies working in a city, with their profile links.",
      parameters: { type: "object", properties: { city_id: str("City id from find_places"), city: str("City name, e.g. 'Lahore', 'Karachi', 'Islamabad'") } },
    },
  },
] as const;

/** Short words for the "working on it" line the user sees. */
export function toolLabel(name: string, args: any): string {
  switch (name) {
    case "find_places":
      return `Looking up ${args?.query || "location"}`;
    case "search_listings":
      return `Finding ${args?.purpose === "rent" ? "rental properties" : "properties for sale"}`;
    case "market_prices":
      return "Checking market prices";
    case "material_rates":
      return "Loading today's material rates";
    case "construction_cost":
      return "Calculating construction cost";
    case "home_loan":
      return "Calculating loan instalments";
    case "installment_plan":
      return "Creating payment plan";
    case "rental_yield":
      return "Calculating rental return";
    case "convert_area":
      return "Converting area units";
    case "find_agents":
      return "Finding verified dealers";
    default:
      return "Loading details";
  }
}

const UNIT_ALIAS: Record<string, UnitKey> = {
  marla: "marla", marlas: "marla", kanal: "kanal", kanals: "kanal", sqft: "sqft", "sq ft": "sqft", feet: "sqft", "square feet": "sqft", ft: "sqft",
  sqyd: "sqyd", "sq yd": "sqyd", gaz: "sqyd", yard: "sqyd", yards: "sqyd", "square yards": "sqyd", sqm: "sqm", meter: "sqm", meters: "sqm", "square meters": "sqm", m2: "sqm",
  acre: "acre", acres: "acre", killa: "killa", kila: "killa", murabba: "murabba", sarsai: "sarsai", karam: "karam", hectare: "hectare", ha: "hectare",
};

const USUAL_MATERIAL_UNIT: Record<string, string> = {
  cement: "50 kg bag",
  steel: "kg",
  bricks: "brick",
  sand: "cft",
  bajri: "cft",
  crush: "cft",
  wood: "cft",
  door: "piece",
  tile: "sq ft",
};

function cleanMaterialUnit(rawUnit: unknown, type: string): string {
  const u = String(rawUnit ?? "").trim();
  const vague = !u || /^(per\s+)?(unit|units|item|pc)$/i.test(u);
  const unit = vague ? USUAL_MATERIAL_UNIT[type.toLowerCase()] || "unit" : u.replace(/^per\s+/i, "");
  return `per ${unit}`;
}

const pkrExact = (n: unknown) => `Rs ${Math.round(Number(n) || 0).toLocaleString("en-PK")}`;
const isObjectId = (s: unknown) => typeof s === "string" && /^[a-f0-9]{24}$/i.test(s.trim());

/** Automatically resolve location/city text into valid Mongo ObjectIds if the model didn't pass valid ids. */
async function resolveScope(a: any): Promise<{ placeIds?: string[]; cityId?: string }> {
  const validPlaces = Array.isArray(a.place_ids) ? a.place_ids.filter(isObjectId) : [];
  const validCity = isObjectId(a.city_id) ? String(a.city_id).trim() : undefined;
  if (validPlaces.length || validCity) return { placeIds: validPlaces.length ? validPlaces : undefined, cityId: validCity };

  const nonIdPlace = Array.isArray(a.place_ids) ? a.place_ids.find((x: any) => typeof x === "string" && x.trim()) : "";
  const nonIdCity = typeof a.city_id === "string" && !isObjectId(a.city_id) ? a.city_id.trim() : "";
  const q = String(a.location || nonIdPlace || a.city || nonIdCity || "").trim();
  const cityHint = String(a.city || nonIdCity || "").trim();
  if (!q) return {};

  try {
    const found = await api<{ places?: { id: string; name: string; cityId: string }[]; cities?: { id: string; name: string }[] }>(
      `/assistant/places?q=${encodeURIComponent(q)}${cityHint && cityHint.toLowerCase() !== q.toLowerCase() ? `&city=${encodeURIComponent(cityHint)}` : ""}`,
    );
    if (found?.places?.length) {
      return { placeIds: [found.places[0]!.id], cityId: found.places[0]!.cityId };
    }
    if (found?.cities?.length) {
      return { cityId: found.cities[0]!.id };
    }
  } catch {
    /* ignore */
  }
  return {};
}

/* ── running a tool ─────────────────────────────────────────────────────── */

export interface ToolResult {
  /** What the model reads (kept short). */
  forModel: unknown;
  /** Shown to the user as cards. */
  cards?: { kind: "listings"; total: number; items: any[]; moreUrl?: string };
}

const CITY_SLUG = (s: string) => String(s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export async function runTool(name: string, args: any): Promise<ToolResult> {
  const a = args || {};
  switch (name) {
    case "find_places": {
      const r = await api<any>(`/assistant/places?q=${encodeURIComponent(String(a.query || ""))}${a.city ? `&city=${encodeURIComponent(a.city)}` : ""}`);
      return { forModel: r };
    }
    case "search_listings": {
      const scope = await resolveScope(a);
      const r = await api<any>("/assistant/search", {
        placeIds: scope.placeIds,
        cityId: scope.cityId,
        purpose: a.purpose || "sale",
        types: a.types,
        minPrice: a.min_price,
        maxPrice: a.max_price,
        minMarla: a.min_marla,
        maxMarla: a.max_marla,
        minBeds: a.min_beds,
        keywords: a.keywords,
        sort: a.sort,
        limit: 6,
      });
      return {
        forModel: {
          total: r.total,
          shownAsCards: r.listings.length,
          priceRange: r.priceRange,
          listings: r.listings.map((l: any) => ({ title: l.title, price: l.priceText, size: l.size, beds: l.beds, place: l.place, verified: l.verified, url: l.url })),
        },
        cards: {
          kind: "listings",
          total: r.total,
          items: r.listings,
          // The same search on the site's results page, for "See all".
          moreUrl: searchUrl({
            purpose: a.purpose === "rent" ? "rent" : "sale",
            citySlug: r.link?.citySlug || "",
            areaSlug: r.link?.areaSlug || "",
            type: Array.isArray(a.types) && a.types.length === 1 ? (a.types[0] === "flat" ? "flat" : a.types[0]) : "",
            priceMin: a.min_price || undefined,
            priceMax: a.max_price || undefined,
            marlaMin: a.min_marla || undefined,
            marlaMax: a.max_marla || undefined,
            beds: a.min_beds || undefined,
          }),
        },
      };
    }
    case "market_prices": {
      const scope = await resolveScope(a);
      const r = await api<any>("/assistant/market", {
        placeIds: scope.placeIds,
        cityId: scope.cityId,
        purpose: a.purpose,
        types: a.types,
        minMarla: a.min_marla,
        maxMarla: a.max_marla,
      });
      return { forModel: r };
    }
    case "material_rates": {
      const [rows, products] = await Promise.all([
        cached("rates_summary", 5 * 60_000, () => api<{ data?: any[] }>("/shop/summary").then((x) => x?.data || []).catch(() => [])),
        cached("rates_products", 5 * 60_000, () => api<{ data?: any[] }>("/shop/products").then((x) => x?.data || []).catch(() => [])),
      ]);
      const rawWant = String(a.material || "").toLowerCase().trim();
      const normWant = rawWant
        .replace(/sarya|saria|sariya|iron|tmt/, "steel")
        .replace(/eent|eeint|int|ito/, "brick")
        .replace(/reti|ret/, "sand")
        .replace(/crush|rodi/, "bajri");

      const allSummary = (rows.length ? rows : CONSTRUCTION_FALLBACK.rates.map((f) => ({
        type: f.material,
        label: f.material.charAt(0).toUpperCase() + f.material.slice(1),
        unit: f.unit,
        from: f.low,
        to: f.high,
        products: f.count || 1,
        path: f.href,
      }))).map((r: any) => {
        const unit = cleanMaterialUnit(r.unit, r.type || r.label || "");
        const from = Number(r.from) || 0;
        const to = Number(r.to) || from;
        return {
          type: r.type,
          material: r.label,
          unit,
          rate: to > from ? `${pkrExact(from)} – ${pkrExact(to)}` : pkrExact(from),
          lowestRate: pkrExact(from),
          brandsCount: r.products || 1,
          pageUrl: r.path || "/today-cement-rate-in-pakistan",
        };
      });

      const filteredSummary = normWant
        ? allSummary.filter((r) => `${r.type} ${r.material}`.toLowerCase().includes(normWant))
        : allSummary;

      const matchingProducts = products
        .filter((p: any) => {
          if (!p || !(Number(p.price) > 0)) return false;
          if (!normWant) return true;
          const hay = `${p.type || ""} ${p.brand || ""} ${p.title || ""} ${p.category || ""}`.toLowerCase();
          return hay.includes(normWant) || (rawWant && hay.includes(rawWant));
        })
        .slice(0, normWant ? 14 : 10)
        .map((p: any) => ({
          material: p.type,
          brand: p.brand || p.title,
          product: p.title,
          price: pkrExact(p.price),
          unit: cleanMaterialUnit(p.unit, p.type || ""),
          city: p.city || "All Pakistan",
          url: p.path || `/${p.categorySlug || "today-cement-rate-in-pakistan"}`,
        }));

      return {
        forModel: {
          categories: filteredSummary.length ? filteredSummary : allSummary,
          brandsAndProducts: matchingProducts,
          calculatorUrl: "/tools/construction-cost-calculator",
          note: "Live rates from suppliers on PropertyDealer.pk today.",
        },
      };
    }
    case "construction_cost": {
      const data: ConstructionData = await cached("construction", 5 * 60_000, async () => {
        try {
          const raw = await api<any>("/tools/construction");
          return raw && Array.isArray(raw.rates) && raw.config ? withDefaults(raw) : CONSTRUCTION_FALLBACK;
        } catch {
          return CONSTRUCTION_FALLBACK;
        }
      });
      const marla = Math.max(1, Number(a.plot_marla) || 5);
      const plotSqft = marla * 225;
      const floors = Math.min(3, Math.max(1, Math.round(Number(a.floors) || 2)));
      const plan = coveredAreas(plotSqft, { floors, basement: !!a.basement });
      const above = plan.filter((f) => !f.basement).reduce((s, f) => s + f.sqft, 0);
      const below = plan.filter((f) => f.basement).reduce((s, f) => s + f.sqft, 0);
      const cityName = data.config.cities.find((c) => c.name.toLowerCase() === String(a.city || "").toLowerCase())?.name || data.config.cities[0]?.name || "Lahore";
      const cityFactor = data.config.cities.find((c) => c.name === cityName)?.factor ?? 1;
      const limits = roomLimits(above, floors);
      const bedrooms = Math.min(limits.maxBedrooms, Math.max(1, Number(a.bedrooms) || limits.usualBedrooms));
      const maxima = roomMaxima(bedrooms, floors);
      const quality: Quality = ["economy", "standard", "premium", "luxury"].includes(a.quality) ? a.quality : "standard";
      const kind = a.kind === "grey" ? "grey" : "complete";
      const baseInput = {
        covered: above,
        basement: below,
        mode: (a.mode === "labour" ? "labour" : "full") as "full" | "labour",
        cityFactor,
        cityRates: data.cityRates?.[cityName],
        bathrooms: Math.min(maxima.bathrooms, bedrooms + 1),
        kitchens: Math.min(maxima.kitchens, usualRooms(above, floors).kitchens),
        bedrooms,
        usualBedrooms: limits.usualBedrooms,
      };
      const e = estimate({ ...baseInput, kind, quality }, data);
      const greyEst = estimate({ ...baseInput, kind: "grey", quality: "standard" }, data);
      const econEst = estimate({ ...baseInput, kind: "complete", quality: "economy" }, data);
      const stdEst = estimate({ ...baseInput, kind: "complete", quality: "standard" }, data);
      const premEst = estimate({ ...baseInput, kind: "complete", quality: "premium" }, data);

      // Also provide a quick comparison table across standard plot sizes (3, 5, 10 Marla, 1 Kanal)
      const quickComparison = [3, 5, 10, 20].map((m) => {
        const pSqft = m * 225;
        const pl = coveredAreas(pSqft, { floors: 2, basement: false });
        const cov = pl.reduce((s, f) => s + f.sqft, 0);
        const lim = roomLimits(cov, 2);
        const mx = roomMaxima(lim.usualBedrooms, 2);
        const common = {
          covered: cov,
          basement: 0,
          mode: "full" as const,
          cityFactor,
          cityRates: data.cityRates?.[cityName],
          bathrooms: Math.min(mx.bathrooms, lim.usualBedrooms + 1),
          kitchens: Math.min(mx.kitchens, usualRooms(cov, 2).kitchens),
          bedrooms: lim.usualBedrooms,
          usualBedrooms: lim.usualBedrooms,
        };
        const g = estimate({ ...common, kind: "grey", quality: "standard" }, data);
        const c = estimate({ ...common, kind: "complete", quality: "standard" }, data);
        return {
          plotSize: m === 20 ? "1 Kanal (20 Marla)" : `${m} Marla`,
          coveredArea: `${cov.toLocaleString("en-PK")} sq ft`,
          greyStructure: rs(g.total),
          completeStandard: rs(c.total),
        };
      });

      const link = `/tools/construction-cost-calculator?city=${encodeURIComponent(cityName)}&size=${marla}&unit=marla&floors=${floors}&type=${kind}&quality=${quality}${a.basement ? "&basement=1" : ""}`;
      return {
        forModel: {
          city: cityName,
          plot: marla === 20 ? "1 Kanal (20 Marla)" : `${marla} Marla`,
          floors: `${floors} Storey (${floors === 1 ? "Single Storey" : floors === 2 ? "Double Storey" : "Triple Storey"})`,
          coveredSqft: `${e.area.toLocaleString("en-PK")} sq ft`,
          requestedType: kind === "grey" ? "Grey Structure" : `Complete House (${quality})`,
          estimatedTotal: rs(e.total),
          range: `${rs(e.low)} – ${rs(e.high)}`,
          perSqft: `Rs ${Math.round(e.perSqft).toLocaleString("en-PK")} / sq ft`,
          optionsForThisPlot: {
            greyStructure: rs(greyEst.total),
            completeEconomy: rs(econEst.total),
            completeStandard: rs(stdEst.total),
            completePremium: rs(premEst.total),
          },
          stageBreakdown: e.parts.map((p) => ({ stage: p.title, cost: rs(p.amount) })),
          quickSizeComparisonDoubleStorey: quickComparison,
          estimatedDurationMonths: e.months,
          calculatorLink: link,
        },
      };
    }
    case "home_loan": {
      const price = Number(a.price) || 0;
      const downPct = a.down_payment_percent ?? 20;
      const rate = a.annual_rate ?? 20;
      const years = a.years ?? 20;
      const principal = price * (1 - downPct / 100);
      const m = emi(principal, rate, years * 12);
      return {
        forModel: { price: rs(price), downPayment: rs(price - principal), loan: rs(principal), ratePercent: rate, years, monthly: rs(m), totalPaid: rs(m * years * 12), totalInterest: rs(m * years * 12 - principal), calculatorLink: "/tools/home-loan-calculator" },
      };
    }
    case "installment_plan": {
      const r = installmentPlan({
        price: Number(a.price) || 0,
        downPct: a.down_payment_percent ?? 20,
        months: a.months ?? 36,
        every: ([1, 3, 6].includes(a.every_months) ? a.every_months : 1) as 1 | 3 | 6,
        balloons: a.balloons ?? 0,
        balloonPct: a.balloon_percent ?? 0,
        possessionPct: a.possession_percent ?? 0,
        start: new Date(),
      });
      return { forModel: r.error ? { error: r.error } : { downPayment: rs(r.down), instalment: rs(r.instalment), instalments: r.count, every: `${a.every_months || 1} month(s)`, balloon: r.balloon ? rs(r.balloon) : null, onPossession: r.possession ? rs(r.possession) : null, calculatorLink: "/tools/installment-plan-calculator" } };
    }
    case "rental_yield": {
      const r = rentalYield({
        price: Number(a.price) || 0,
        rent: Number(a.rent) || 0,
        buyingCostPct: a.buying_cost_percent ?? 4,
        vacancyMonths: a.vacancy_months ?? 1,
        expenses: a.expenses_per_year ?? 0,
        growthPct: a.growth_percent ?? 8,
        rentGrowthPct: a.rent_growth_percent ?? 8,
        years: a.years ?? 5,
        bankPct: a.bank_percent ?? 11,
      });
      return {
        forModel: { grossYieldPercent: +r.gross.toFixed(2), netYieldPercent: +r.net.toFixed(2), paybackYears: Number.isFinite(r.payback) ? +r.payback.toFixed(1) : null, valueAfter: rs(r.value), totalReturnPercent: +r.roi.toFixed(1), yearlyReturnPercent: +r.yearly.toFixed(1), bankInstead: rs(r.bank), calculatorLink: "/tools/rental-yield-calculator" },
      };
    }
    case "convert_area": {
      const from = UNIT_ALIAS[String(a.from || "").toLowerCase().trim()];
      const to = UNIT_ALIAS[String(a.to || "").toLowerCase().trim()];
      if (!from || !to) return { forModel: { error: "Unknown unit" } };
      const marla = Number(a.marla_sqft) || 225;
      const v = convert(Number(a.value) || 0, from, to, marla);
      return { forModel: { result: +v.toFixed(4), from, to, marlaSqft: marla, calculatorLink: "/tools/area-unit-converter" } };
    }
    case "find_agents": {
      const scope = await resolveScope(a);
      const cityId = scope.cityId || String(a.city_id || "");
      const rows = await api<any[]>(`/agents/city/${encodeURIComponent(cityId)}`).catch(() => []);
      return { forModel: { agents: (rows || []).slice(0, 8).map((r: any) => ({ name: r.name, listings: r.listings, verified: r.verified, profile: `/agents/${CITY_SLUG(r.name)}-${r._id}` })), directory: "/property-dealers" } };
    }
    default:
      return { forModel: { error: `Unknown tool ${name}` } };
  }
}

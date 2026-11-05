/**
 * What the site assistant can look up and work out. Server only.
 *
 * Facts come from the live API (listings, places, market prices, material
 * rates, agents); sums come from the same functions the site's calculators
 * use (lib/tools.ts, lib/area-units.ts) — so an answer in the chat and the
 * calculator page always agree, and the model never does arithmetic itself.
 */
import { boundaryLength, brickwork, concrete as concreteMix, plaster as plasterMix, rateOf, rateRange, roomsWallLength, CONCRETE_MIXES, PLOTS, type ConcreteMix } from "@/lib/tools";
import { coveredAreas, emi, estimate, installmentPlan, rentalYield, roomLimits, roomMaxima, usualRooms, withDefaults, CONSTRUCTION_FALLBACK, type ConstructionData, type Quality } from "@/lib/tools";
import { convert, type UnitKey } from "@/lib/area-units";
import { searchUrl } from "@/lib/search";
import type { Visual } from "./types";
import { dealerHref, dealersCityPath } from "@/lib/dealers";

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
      name: "site_search",
      description: "Search the WHOLE site at once — listings, areas/societies, dealers and articles — for any words. Use first when a question is broad, vague, or you're not sure which lookup fits (a name, a project, a landmark, a topic).",
      parameters: { type: "object", properties: { query: str("What to look for, in the user's words"), city: str("City, only if the user said one") }, required: ["query"] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_listing",
      description: "Full public details of ONE listing: price, size, beds/baths, features, description, who posted it (verified or not), when, status, and how its price compares with similar listings nearby. Use when the user asks about a specific property, or says 'this property / is property / yeh wala' while viewing a listing page (pass that page's slug).",
      parameters: { type: "object", properties: { ref: str("The listing's slug or URL (/properties/...) or id") }, required: ["ref"] },
    },
  },
  {
    type: "function",
    function: {
      name: "list_areas",
      description: "The areas and societies of a city with the most live listings — for 'which areas are there in X', 'where should I look in X', 'popular societies in X'.",
      parameters: { type: "object", properties: { city: str("City name") }, required: ["city"] },
    },
  },
  {
    type: "function",
    function: {
      name: "site_overview",
      description: "The site in numbers right now: total live listings, by type and buy/rent, and the busiest cities.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "read_article",
      description: "Read one of the site's articles (blog) to answer from it — pass its URL or slug from site_guides/site_search.",
      parameters: { type: "object", properties: { ref: str("Article URL (/blog/...) or slug") }, required: ["ref"] },
    },
  },
  {
    type: "function",
    function: {
      name: "dealer_profile",
      description: "One dealer or agency's public profile: city, experience, verified, live listings, rating and reviews summary, profile link. Never phone numbers. Pass a name (searched across all cities) or a profile URL.",
      parameters: { type: "object", properties: { name: str("Dealer/agency name"), url: str("Profile URL (/agents/...)") } },
    },
  },
  {
    type: "function",
    function: {
      name: "site_info",
      description: "About the site itself: 'contact' (the site's own phone/WhatsApp/email), 'plans' (packages for agents and their prices/limits), or a page: 'about', 'terms', 'privacy-policy', or any static page slug (how to post, policies…).",
      parameters: { type: "object", properties: { topic: str("contact | plans | about | terms | privacy-policy | another page slug") }, required: ["topic"] },
    },
  },
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
      name: "bricks_calculator",
      description: "How many bricks a job needs, with cement and sand for the mortar and today's cost. Pakistani standard: 1,350 bricks per 100 cft of brickwork. Pick the job: 'room' (L×W rooms — 'kamre ke liye kitni eenten'), 'boundary' (boundary wall round a plot — 'chaar diwari'), 'house' (whole house by plot size and storeys), 'wall' (any wall by length).",
      parameters: {
        type: "object",
        properties: {
          job: str("What is being built (default: room if room size given, boundary if 'boundary/chaar diwari', house if plot size + house, else wall)", ["room", "boundary", "house", "wall"]),
          room_length_ft: num("room: length of a room, feet"),
          room_width_ft: num("room: width of a room, feet"),
          rooms: num("room: how many rooms of that size (default 1)"),
          plot: str("boundary/house: plot size like '5 marla', '10 marla', '1 kanal'"),
          plot_front_ft: num("boundary: plot front, feet (if not a standard plot)"),
          plot_depth_ft: num("boundary: plot depth, feet"),
          sides: num("boundary: 4 (all, default), 3 (back shared) or 1 (front only)"),
          gate_ft: num("boundary: gate opening, feet (default 10)"),
          floors: num("house: storeys 1–3 (default 2)"),
          wall_length_ft: num("wall: total length of walls, feet"),
          wall_height_ft: num("Height, feet (default 10; boundary 7)"),
          wall_area_sqft: num("wall: or the wall face area directly, sq ft"),
          thickness_in: num("4.5, 9 (default) or 13.5 inches"),
          doors: num("Doors to subtract (per room for job room; about 21 sq ft each)"),
          windows: num("Windows to subtract (per room for job room; about 16 sq ft each)"),
          mortar: num("Mortar 1:N — 4, 5 or 6 (default 6)"),
          quality: str("Brick quality (default first)", ["first", "second"]),
          city: str("City for rates (default Lahore)"),
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cement_calculator",
      description: "Cement bags (50 kg), sand, crush and water with today's cost. Jobs: 'roof' (lenter/slab of a room or of a whole floor by plot size), 'plaster' (a room's walls ± ceiling, or an area), 'floor' (PCC base under tiles), 'concrete' (columns, beams, footings or any volume), 'brick_mortar', 'house' (whole house by plot size and storeys). Use for 'lenter ke liye kitne bag', 'kamre ka plaster', '5 marla ghar mein kitna cement'.",
      parameters: {
        type: "object",
        properties: {
          work: str("What is being made", ["roof", "plaster", "floor", "concrete", "brick_mortar", "house"]),
          room_length_ft: num("roof/plaster/floor: room length, feet"),
          room_width_ft: num("roof/plaster/floor: room width, feet"),
          room_height_ft: num("plaster: room height, feet (default 10)"),
          rooms: num("How many rooms of that size (default 1)"),
          plot: str("roof (whole floor) / house: plot size like '5 marla', '1 kanal'"),
          floors: num("house: storeys 1–3 (default 2)"),
          ceiling: str("plaster: include the ceiling (default yes)", ["yes", "no"]),
          beams: str("roof: include beams under the slab, +12% (default yes)", ["yes", "no"]),
          length_ft: num("concrete: length/height of each piece, feet; brick_mortar: wall length"),
          width_ft: num("concrete: width, feet; brick_mortar: wall height"),
          depth_ft: num("concrete: depth of each piece, feet (column/beam: e.g. 1.25)"),
          thickness_in: num("Slab 4–6 (default 5), floor 3, plaster 0.5; wall thickness for brick_mortar (4.5/9/13.5)"),
          count: num("How many identical pieces (columns, beams, footings)"),
          volume_cft: num("concrete: or the volume directly, cft"),
          area_sqft: num("plaster: area, sq ft (instead of a room)"),
          mix: str("Concrete '1:2:4' (default), '1:1.5:3', '1:3:6', '1:4:8'; plaster/mortar '1:4', '1:6'…"),
          city: str("City for rates (default Lahore)"),
        },
        required: ["work"],
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
      name: "show_search_form",
      description: "Show the user a one-step search form (buy/rent, city, area, type, size, budget, bedrooms) prefilled with whatever they already said. Use this when someone wants to buy or rent but has not given BOTH a location and a budget or size — instead of asking questions one by one.",
      parameters: {
        type: "object",
        properties: {
          purpose: str("Buying or renting", ["sale", "rent"]),
          city: str("City, if said"),
          location: str("Area or society, if said"),
          type: str("Property type, if said", ["house", "plot", "flat", "commercial"]),
          marla: num("Size in marla, if said"),
          max_price: num("Budget in PKR, if said"),
          beds: num("Bedrooms, if said"),
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "contact_support",
      description: "Show the site team's WhatsApp, call and 'find it for me' options. Use when the user wants to talk to a person, asks for a contact/helpline, is unhappy or stuck, or you cannot help with something.",
      parameters: { type: "object", properties: { topic: str("What they need help with, in a few words, in their language") } },
    },
  },
  {
    type: "function",
    function: {
      name: "find_agents",
      description: "Find property dealers / agencies / agents. With `name`: searches EVERY city for a dealer by that name (close spellings too) — use for 'is there a dealer named X', 'X estate', 'find agent X'. With only `city`: the dealers in that city, verified first. Never invent a city the user didn't say. Shown as dealer cards with profile links (never phone numbers).",
      parameters: { type: "object", properties: { name: str("Dealer, agent or agency name, if the user gave one"), city: str("City, ONLY if the user said one") } },
    },
  },
  {
    type: "function",
    function: {
      name: "society_info",
      description: "Everything about one housing society: developer, approval (LDA/RDA/CDA), possession, plot sizes, total area, payment plan, amenities, nearby places, live listings count, and links to its guide page, map and listings. Shown as a society card. Use for any question about a society (e.g. 'is Park View City approved', 'Etihad Town details').",
      parameters: { type: "object", properties: { name: str("Society name as the user wrote it"), city: str("City, if known") }, required: ["name"] },
    },
  },
  {
    type: "function",
    function: {
      name: "site_guides",
      description: "Articles on PropertyDealer.pk that explain property topics: transfer process, taxes (FBR, stamp duty, CVT), documents, fard, registry, intiqal, NOC, buying tips, investment. Shown as article links. Use for 'how to', process, legal or tax questions, then give a short answer yourself.",
      parameters: { type: "object", properties: { query: str("Topic in a few English words, e.g. 'property transfer process', 'stamp duty punjab'") }, required: ["query"] },
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
    case "bricks_calculator":
      return "Counting bricks";
    case "cement_calculator":
      return "Working out cement bags";
    case "installment_plan":
      return "Creating payment plan";
    case "rental_yield":
      return "Calculating rental return";
    case "convert_area":
      return "Converting area units";
    case "find_agents":
      return args?.name ? `Searching dealers named “${args.name}”` : `Finding dealers in ${args?.city || "your city"}`;
    case "society_info":
      return `Looking up ${args?.name || "the society"}`;
    case "site_guides":
      return "Finding guides";
    case "contact_support":
      return "Connecting you with our team";
    case "site_search":
      return `Searching the site for “${String(args?.query || "").slice(0, 40)}”`;
    case "get_listing":
      return "Opening the property";
    case "list_areas":
      return `Checking areas in ${args?.city || "the city"}`;
    case "site_overview":
      return "Counting live listings";
    case "read_article":
      return "Reading the guide";
    case "dealer_profile":
      return `Opening ${args?.name || "the dealer"}'s profile`;
    case "site_info":
      return "Checking site details";
    case "show_search_form":
      return "Opening search";
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
async function resolveScope(a: any): Promise<{ placeIds?: string[]; cityId?: string; label?: string }> {
  const validPlaces = Array.isArray(a.place_ids) ? a.place_ids.filter(isObjectId) : [];
  const validCity = isObjectId(a.city_id) ? String(a.city_id).trim() : undefined;
  const given = [a.location, a.city].filter((x) => typeof x === "string" && x.trim()).join(", ") || undefined;
  if (validPlaces.length || validCity) return { placeIds: validPlaces.length ? validPlaces : undefined, cityId: validCity, label: given };

  const nonIdPlace = Array.isArray(a.place_ids) ? a.place_ids.find((x: any) => typeof x === "string" && x.trim()) : "";
  const nonIdCity = typeof a.city_id === "string" && !isObjectId(a.city_id) ? a.city_id.trim() : "";
  const q = String(a.location || nonIdPlace || a.city || nonIdCity || "").trim();
  const cityHint = String(a.city || nonIdCity || "").trim();
  if (!q) return {};

  try {
    const found = await api<{ places?: { id: string; name: string; cityId: string }[]; group?: { name: string; city: string; cityId: string; ids: string[] } | null; cities?: { id: string; name: string }[] }>(
      `/assistant/places?q=${encodeURIComponent(q)}${cityHint && cityHint.toLowerCase() !== q.toLowerCase() ? `&city=${encodeURIComponent(cityHint)}` : ""}`,
    );
    if (found?.group?.ids?.length) {
      const g = found.group;
      return { placeIds: g.ids, cityId: g.cityId, label: `${g.name}, ${g.city}` };
    }
    if (found?.places?.length) {
      const p = found.places[0]! as any;
      return { placeIds: [p.id], cityId: p.cityId, label: [p.name, p.city].filter(Boolean).join(", ") };
    }
    if (found?.cities?.length) {
      return { cityId: found.cities[0]!.id, label: found.cities[0]!.name };
    }
  } catch {
    /* ignore */
  }
  return {};
}

/* ── understanding a typed search ("dha 6 mein 10 marla ghar 3 crore tak") ── */

const MONEY_RE = /(\d+(?:\.\d+)?)\s*(crore|crores|cr|karor|karod|lakh|lakhs|lac|lacs|l|thousand|hazar|hazaar|k|arab)\b/gi;
function moneyOf(n: string, unit: string): number {
  const u = unit.toLowerCase();
  const m = /^(crore|crores|cr|karor|karod)$/.test(u) ? 1e7 : /^(lakh|lakhs|lac|lacs|l)$/.test(u) ? 1e5 : /^(thousand|hazar|hazaar|k)$/.test(u) ? 1e3 : u === "arab" ? 1e9 : 1;
  return Math.round(Number(n) * m);
}

/** Purpose, type, size, budget, bedrooms and extras from a sentence. */
export function readSearch(text: string) {
  const t = ` ${text.toLowerCase().replace(/[,]/g, " ").replace(/\s+/g, " ")} `;
  const purpose: "sale" | "rent" = /\b(rent|rental|kiraya|kiraye|kiray|kirae|lease|on rent)\b/.test(t) ? "rent" : "sale";
  const type = /\b(plot|plots|zameen|land)\b/.test(t)
    ? "plot"
    : /\b(flat|flats|apartment|apartments)\b/.test(t)
      ? "flat"
      : /\b(shop|shops|dukan|dukaan|office|offices|commercial|plaza|warehouse)\b/.test(t)
        ? /\boffice/.test(t) ? "office" : /\bshop|dukan|dukaan/.test(t) ? "shop" : "commercial"
        : /\b(ghar|house|houses|home|makan|makaan|bungalow|villa|portion)\b/.test(t)
          ? "house"
          : "";
  const size = /(\d+(?:\.\d+)?)\s*(marla|marle|marly|kanal|kanaal|knal)\b/.exec(t);
  const marla = size ? Number(size[1]) * (/^k/.test(size[2]!) ? 20 : 1) : undefined;
  // "2 se 3 crore", "2 to 3 crore", "2-3 crore": the unit belongs to both numbers.
  const span = /(\d+(?:\.\d+)?)\s*(?:se|to|-|–|and|aur)\s*(\d+(?:\.\d+)?)\s*(crore|crores|cr|karor|karod|lakh|lakhs|lac|lacs|thousand|hazar|hazaar|k)(?![a-z])/i.exec(t);
  const amounts = span
    ? [moneyOf(span[1]!, span[3]!), moneyOf(span[2]!, span[3]!)]
    : [...t.matchAll(MONEY_RE)].map((m) => moneyOf(m[1]!, m[2]!)).filter((v) => v >= 5000);
  let minPrice: number | undefined;
  let maxPrice: number | undefined;
  if (amounts.length >= 2) [minPrice, maxPrice] = [Math.min(...amounts), Math.max(...amounts)];
  else if (amounts.length === 1) {
    if (/\b(above|over|se zyada|se ziada|se upar|minimum|min|at least|kam az kam)\b/.test(t)) minPrice = amounts[0];
    else maxPrice = amounts[0];
  }
  const bedsM = /(\d)\s*(bed|beds|bedroom|bedrooms|bed room|kamre|kamray|kamra|rooms?)\b/.exec(t);
  const extras = ["corner", "park facing", "furnished", "main boulevard", "brand new", "double storey", "single storey"].filter((k) => t.includes(` ${k}`));
  const priceQuestion = /\b(price|prices|rate|rates|qeemat|keemat|kimat|kitne ka|kitny ka|kitne ki|worth|market value)\b/.test(t) && !/\b(lena|leni|khareed|kharidna|buy|chahiye|chahye|chahiyay|dikhao|dikhayen|show|find|dhoond|dhundo|search|available)\b/.test(t);
  return { purpose, type, marla, minPrice, maxPrice, beds: bedsM ? Number(bedsM[1]) : undefined, extras, priceQuestion };
}

/* ── running a tool ─────────────────────────────────────────────────────── */

export interface ToolResult {
  /** What the model reads (kept short). */
  forModel: unknown;
  /** Shown to the user as cards. */
  cards?: Visual;
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
          q: { ...a, place_ids: scope.placeIds, city_id: scope.cityId },
          total: r.total,
          items: r.listings,
          label: scope.label,
          priceRange: r.priceRange,
          // The same search on the site's results page, for "See all".
          // Several areas under one name ("Bahria Town"): the city page, searched by that name.
          moreExact: !(scope.placeIds && scope.placeIds.length > 1),
          moreUrl: searchUrl({
            purpose: a.purpose === "rent" ? "rent" : "sale",
            citySlug: r.link?.citySlug || "",
            areaSlug: scope.placeIds && scope.placeIds.length > 1 ? "" : r.link?.areaSlug || "",
            search: scope.placeIds && scope.placeIds.length > 1 ? scope.label?.split(",")[0] : undefined,
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
      const place = scope.label || "All Pakistan";
      return {
        forModel: { place, ...r, shownAsCard: true },
        cards: { kind: "market", q: { ...a, place_ids: scope.placeIds, city_id: scope.cityId }, place, market: r.market || [], url: r.link ? searchUrl({ purpose: a.purpose === "rent" ? "rent" : "sale", citySlug: r.link.citySlug, areaSlug: r.link.areaSlug, type: "" }) : undefined },
      };
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

      const categories = filteredSummary.length ? filteredSummary : allSummary;
      return {
        forModel: {
          categories,
          brandsAndProducts: matchingProducts,
          calculatorUrl: "/tools/construction-cost-calculator",
          note: "Live rates from suppliers on PropertyDealer.pk today. Already shown to the user as a table card.",
        },
        cards: {
          kind: "rates",
          q: { material: rawWant || undefined },
          focus: rawWant || undefined,
          rows: categories.map((c) => ({ material: c.material, unit: c.unit, rate: c.rate, url: c.pageUrl })),
          brands: rawWant ? matchingProducts : [],
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
      const askedCity = String(a.city || "").trim().toLowerCase();
      const cityName =
        data.config.cities.find((c) => c.name.toLowerCase() === askedCity)?.name ||
        data.config.cities.find((c) => askedCity && (c.name.toLowerCase().startsWith(askedCity) || askedCity.startsWith(c.name.toLowerCase())))?.name ||
        data.config.cities[0]?.name ||
        "Lahore";
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

      const options = [
        { key: "grey", label: "Grey structure", total: rs(greyEst.total) },
        { key: "economy", label: "Complete · Economy", total: rs(econEst.total) },
        { key: "standard", label: "Complete · Standard", total: rs(stdEst.total) },
        { key: "premium", label: "Complete · Premium", total: rs(premEst.total) },
      ];
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
          shownAsCard: true,
        },
        cards: {
          kind: "construction",
          q: { plot_marla: marla, floors, city: cityName, kind, quality, basement: !!a.basement },
          city: cityName,
          plot: marla === 20 ? "1 Kanal" : marla % 20 === 0 ? `${marla / 20} Kanal` : `${marla} Marla`,
          floors: floors === 1 ? "Single storey" : floors === 2 ? "Double storey" : "Triple storey",
          covered: `${e.area.toLocaleString("en-PK")} sq ft`,
          perSqft: `Rs ${Math.round(e.perSqft).toLocaleString("en-PK")} / sq ft`,
          months: kind === "grey" ? e.months.grey : e.months.grey + e.months.finishing,
          selected: kind === "grey" ? "grey" : quality === "luxury" ? "premium" : quality,
          options,
          stages: e.parts.map((p) => ({ stage: p.title, cost: rs(p.amount), amount: Math.round(p.amount) })),
          link,
          input: { marla, floors, city: cityName },
          cities: data.config.cities.map((c) => c.name),
        },
      };
    }
    case "site_search": {
      const q = String(a.query || "").slice(0, 120);
      const city = String(a.city || "").trim();
      const [places, listings, dealers, guides] = await Promise.all([
        api<any>(`/assistant/places?q=${encodeURIComponent(q)}${city ? `&city=${encodeURIComponent(city)}` : ""}`).catch(() => null),
        api<any>("/assistant/search", { keywords: q, limit: 5, ...(city ? {} : {}) }).catch(() => null),
        api<any>(`/dealers/search?q=${encodeURIComponent(q)}${city ? `&city=${encodeURIComponent(city)}` : ""}`).catch(() => null),
        api<any>(`/assistant/guides?q=${encodeURIComponent(q)}`).catch(() => null),
      ]);
      const ls = (listings?.listings || []).slice(0, 5);
      return {
        forModel: {
          places: (places?.places || []).slice(0, 5).map((p: any) => ({ name: p.name, city: p.city, kind: p.kind, listings: p.listings, listingsUrl: p.url, guideUrl: p.society?.url })),
          listingsMatchingWords: { total: listings?.total || 0, top: ls.map((l: any) => ({ title: l.title, price: l.priceText, size: l.size, place: l.place, url: l.url })) },
          dealers: (dealers?.dealers || []).slice(0, 5).map((d: any) => ({ name: d.name, city: d.city?.name, exactName: d.exact, listings: d.listings, verified: d.verified, profileUrl: dealerHref(d) })),
          articles: (guides?.guides || []).slice(0, 4).map((g: any) => ({ title: g.title, url: g.url })),
        },
        cards: ls.length ? { kind: "listings", total: listings.total, items: ls, label: `“${q}”`, q: { keywords: q } } : undefined,
      };
    }
    case "get_listing": {
      const r = await api<any>(`/assistant/listing?ref=${encodeURIComponent(String(a.ref || "").slice(0, 200))}`).catch(() => null);
      if (!r?.found) return { forModel: { found: false, note: "No live listing with that link — it may be sold, rented or removed." } };
      const { card, ...facts } = r;
      return { forModel: facts, cards: { kind: "listings", total: 1, items: [card], label: card.place } };
    }
    case "list_areas": {
      const r = await api<any>(`/assistant/areas?city=${encodeURIComponent(String(a.city || ""))}&limit=25`).catch(() => null);
      return { forModel: r || { areas: [] } };
    }
    case "site_overview": {
      return { forModel: await api<any>("/assistant/overview").catch(() => ({ error: "unavailable" })) };
    }
    case "read_article": {
      const slug = String(a.ref || "").replace(/^.*\/blog\//, "").replace(/[?#].*$/, "").replace(/\/$/, "").slice(0, 150);
      const b = await api<any>(`/blog/slug/${encodeURIComponent(slug)}`).catch(() => null);
      const blog = b?.data || b;
      if (!blog?.title) return { forModel: { found: false } };
      const text = String(blog.content || "").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
      return { forModel: { title: blog.title, url: `/blog/${blog.slug || slug}`, text: text.slice(0, 3500) }, cards: { kind: "guides", items: [{ title: blog.title, url: `/blog/${blog.slug || slug}`, excerpt: String(blog.excerpt || "").slice(0, 160), image: blog.featuredImage || "" }] } };
    }
    case "dealer_profile": {
      let id = /([a-f0-9]{24})(?:\/?$|[?#])/i.exec(String(a.url || ""))?.[1] || "";
      let city = "";
      let fromSearch: any = null;
      if (!id && a.name) {
        const s = await api<any>(`/dealers/search?q=${encodeURIComponent(String(a.name).slice(0, 60))}`).catch(() => null);
        const d = (s?.dealers || [])[0];
        if (!d) return { forModel: { found: false, note: `No dealer named ${a.name} on the site.` } };
        id = d._id;
        city = d.city?.name || "";
        fromSearch = d;
      }
      if (!id) return { forModel: { found: false } };
      const [p, rev] = await Promise.all([api<any>(`/agents/${id}`).catch(() => null), api<any>(`/agents/${id}/reviews/summary`).catch(() => null)]);
      const prof = p?.profile || p?.user || p;
      if (!prof?.name && !prof?.companyName) return { forModel: { found: false } };
      const name = String(prof.companyName || prof.name);
      const listings = Number(fromSearch?.listings ?? (Array.isArray(p?.listings) ? p.listings.length : p?.total ?? 0)) || 0;
      const summary = rev?.data || rev || {};
      const url = dealerHref({ _id: id, name: prof.name, companyName: prof.companyName, agency: null } as any);
      return {
        forModel: {
          name,
          city: city || prof.city?.name || "",
          about: String(prof.bio || "").replace(/<[^>]+>/g, " ").slice(0, 500),
          experienceYears: prof.experienceYears || fromSearch?.experienceYears || null,
          verified: !!(p?.verified || fromSearch?.verified),
          liveListings: listings,
          rating: summary.average ?? summary.avg ?? null,
          reviews: summary.count ?? summary.total ?? null,
          profileUrl: url,
          note: "Contact is on the profile page; never give numbers.",
        },
        cards: { kind: "agents", city: city || "", total: 1, items: [{ name, url, avatar: prof.avatarUrl || "", verified: !!(p?.verified || prof.verified), listings, years: prof.experienceYears || 0, isAgency: !!prof.companyName, agency: "", plan: "", city }], moreUrl: url, query: name, exact: 1 },
      };
    }
    case "site_info": {
      const topic = String(a.topic || "").toLowerCase().trim();
      if (/contact|phone|whatsapp|email|number/.test(topic)) {
        const s = await cached("site_settings", 5 * 60_000, () => api<any>("/site-settings").catch(() => ({})));
        const v = s?.data || s || {};
        return { forModel: { siteName: v.siteName, phone: v.contactPhone, whatsapp: v.contactWhatsapp || v.contactPhone, email: v.contactEmail, contactPage: "/contact" }, cards: { kind: "support" } };
      }
      if (/plan|package|price|pricing|subscription/.test(topic)) {
        const r = await cached("packages", 5 * 60_000, () => api<any>("/packages").catch(() => []));
        const list: any[] = Array.isArray(r) ? r : r?.data || r?.packages || [];
        const keep = (o: any) => Object.fromEntries(Object.entries(o).filter(([k, v]) => !k.startsWith("_") && !/At$|^id$|stripe|internal/i.test(k) && (typeof v !== "object" || Array.isArray(v))).map(([k, v]) => [k, Array.isArray(v) ? v.slice(0, 8) : v]));
        return { forModel: { plans: list.slice(0, 8).map(keep), page: "/packages" } };
      }
      const slug = topic.replace(/[^a-z0-9-]/g, "") || "about";
      const pg = await api<any>(`/page/slug/${encodeURIComponent(slug)}`).catch(() => null);
      const page = pg?.data || pg;
      if (!page?.title && !page?.content) return { forModel: { found: false, pages: ["about", "contact", "terms", "privacy-policy"] } };
      const text = String(page.content || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
      return { forModel: { title: page.title, url: `/${slug}`, text: text.slice(0, 3000) } };
    }
    case "smart_search": {
      const text = String(a.text || "").slice(0, 300);
      const want = readSearch(text);
      const where = await api<any>(`/assistant/match?text=${encodeURIComponent(text)}`).catch(() => null);
      const place = where?.place;
      const city = where?.city;
      // Nowhere named: the search form, already filled in with what they said.
      if (!place && !city) {
        return {
          forModel: { needsPlace: true },
          cards: { kind: "form", form: "search", prefill: { purpose: want.purpose, type: want.type || undefined, marla: want.marla, maxPrice: want.maxPrice } },
        };
      }
      const scope = place ? { place_ids: place.ids, city: place.city, city_id: place.cityId, location: place.name } : { city: city.name, city_id: city.id, location: city.name };
      if (want.priceQuestion) {
        return runTool("market_prices", { ...scope, purpose: want.purpose, types: want.type ? [want.type] : undefined, min_marla: want.marla, max_marla: want.marla });
      }
      const args = {
        ...scope,
        purpose: want.purpose,
        types: want.type ? [want.type] : undefined,
        min_marla: want.marla,
        max_marla: want.marla,
        min_price: want.minPrice,
        max_price: want.maxPrice,
        min_beds: want.beds,
        keywords: want.extras.length ? want.extras.join(" ") : undefined,
        sort: "best",
      };
      const r = await runTool("search_listings", args);
      if (r.cards?.kind !== "listings" || r.cards.total) return r;
      // Nothing matches everything: loosen one thing at a time and show the closest, saying what changed.
      const steps: { note: string; change: Record<string, unknown> }[] = [
        ...(args.keywords ? [{ note: `without "${args.keywords}"`, change: { keywords: undefined } }] : []),
        ...(args.min_beds ? [{ note: "any number of bedrooms", change: { keywords: undefined, min_beds: undefined } }] : []),
        ...(args.max_price || args.min_price
          ? [{ note: `a little over your budget`, change: { keywords: undefined, min_beds: undefined, min_price: undefined, max_price: args.max_price ? Math.round(Number(args.max_price) * 1.25) : undefined } }]
          : []),
        ...(args.min_marla ? [{ note: "other sizes", change: { keywords: undefined, min_beds: undefined, min_marla: undefined, max_marla: undefined } }] : []),
        ...(args.max_price || args.min_price ? [{ note: "any budget", change: { keywords: undefined, min_beds: undefined, min_price: undefined, max_price: undefined } }] : []),
        ...(args.types ? [{ note: "other property types", change: { keywords: undefined, min_beds: undefined, types: undefined } }] : []),
        { note: "nearby options in the area", change: { keywords: undefined, min_beds: undefined, min_price: undefined, max_price: undefined, min_marla: undefined, max_marla: undefined, types: undefined } },
      ];
      let change: Record<string, unknown> = {};
      const loosened: string[] = [];
      for (const s of steps) {
        change = { ...change, ...s.change };
        // Later steps include earlier ones ("any budget" replaces "a little over your budget").
        if (s.note === "any budget") {
          const i = loosened.indexOf("a little over your budget");
          if (i >= 0) loosened.splice(i, 1);
        }
        loosened.push(s.note);
        const near = await runTool("search_listings", { ...args, ...change });
        if (near.cards?.kind === "listings" && near.cards.total) {
          const said = loosened.length > 1 ? `${loosened.slice(0, -1).join(", ")} and ${loosened[loosened.length - 1]}` : loosened[0];
          const note = `No exact match right now — closest options with ${said}.`;
          return { forModel: { ...(near.forModel as object), exactMatches: 0, relaxed: s.note }, cards: { ...near.cards, note, q: { ...(near.cards.q || {}), wanted: args } } };
        }
      }
      return r;
    }
    case "contact_support": {
      return {
        forModel: { shown: "The team's WhatsApp and call buttons are on screen. Say one short, warm line; no phone numbers in text." },
        cards: { kind: "support", topic: String(a.topic || "").slice(0, 120) || undefined },
      };
    }
    case "show_search_form": {
      return {
        forModel: { shown: "A search form is now on screen, prefilled with what the user said. Say one short line inviting them to fill it in. Do not ask any questions." },
        cards: {
          kind: "form",
          form: "search",
          prefill: {
            purpose: a.purpose === "rent" ? "rent" : "sale",
            city: a.city || undefined,
            location: a.location || undefined,
            type: a.type || undefined,
            marla: Number(a.marla) || undefined,
            maxPrice: Number(a.max_price) || undefined,
            beds: Number(a.beds) || undefined,
          },
        },
      };
    }
    case "bricks_calculator":
    case "cement_calculator": {
      const data: ConstructionData = await cached("construction", 5 * 60_000, async () => {
        try {
          const raw = await api<any>("/tools/construction");
          return raw && Array.isArray(raw.rates) && raw.config ? withDefaults(raw) : CONSTRUCTION_FALLBACK;
        } catch {
          return CONSTRUCTION_FALLBACK;
        }
      });
      const m = data.config.masonry;
      const city = data.config.cities.find((c) => c.name.toLowerCase() === String(a.city || "").toLowerCase())?.name || data.config.cities[0]?.name || "Lahore";
      const cementRate = rateOf(data, "cement", city);
      const sandRate = rateOf(data, "sand", city);
      const n0 = (x: number) => Math.round(x).toLocaleString("en-PK");
      const ratio = (v: unknown, d: number) => {
        const t = String(v ?? "").split(":").map(Number);
        const n = t.length > 1 ? t[t.length - 1]! : Number(v);
        return n >= 2 && n <= 8 ? n : d;
      };

      // "5 marla", "10m", "1 kanal" → a plot (standard sizes, else a 1 : 1.8 rectangle).
      const plotOf = (v: unknown) => {
        const t = String(v ?? "").toLowerCase();
        const n = parseFloat(t);
        if (!Number.isFinite(n) || n <= 0) return null;
        const marla = /kanal|\dk\b/.test(t) ? n * 20 : n;
        const std = PLOTS.find((x) => x.marla === marla);
        if (std) return std;
        const front = Math.round(Math.sqrt((marla * 225) / 1.8));
        return { key: "", label: `${marla} Marla`, marla, front, depth: Math.round((marla * 225) / front) };
      };
      const storeys = Math.min(3, Math.max(1, Math.round(Number(a.floors) || 2)));
      const coveredOf = (marla: number, f: number) => coveredAreas(marla * 225, { floors: f, basement: false }).reduce((s, x) => s + x.sqft, 0);
      const yes = (v: unknown, d: boolean) => (v === undefined || v === null || v === "" ? d : !/^(no|false|0)$/i.test(String(v)));

      if (name === "bricks_calculator") {
        const mortar = ratio(a.mortar, 6);
        const plot = plotOf(a.plot);
        const job =
          a.job === "room" || a.job === "boundary" || a.job === "house" || a.job === "wall"
            ? a.job
            : Number(a.room_length_ft) && Number(a.room_width_ft)
              ? "room"
              : plot && !Number(a.wall_length_ft)
                ? "boundary"
                : "wall";
        const range = rateRange(data, "bricks", city);
        const second = a.quality === "second";
        const brickRate = second ? range.low : range.high;
        let r: { bricks: number; cementBags: number; sandCft: number; volumeCft: number };
        let title = "";
        if (job === "house") {
          if (!plot) return { forModel: { needInput: "Ask the plot size (e.g. 5 marla) and storeys in one short question." } };
          const covered = coveredOf(plot.marla, storeys);
          const bricks = Math.ceil(covered * data.config.qty.bricks);
          const vol = (bricks / (1 + m.brickWastagePct / 100) / m.bricksPer100Cft) * 100;
          const b = brickwork({ lengthFt: vol, heightFt: 1, thicknessIn: 12, openingsSqft: 0, mortar }, m);
          r = { ...b, bricks };
          title = `${plot.label} house, ${storeys} storey${storeys > 1 ? "s" : ""} · ${n0(covered)} sq ft covered`;
        } else {
          const thick = [4.5, 9, 13.5].includes(Number(a.thickness_in)) ? Number(a.thickness_in) : 9;
          const height = Math.max(1, Number(a.wall_height_ft) || (job === "boundary" ? 7 : 10));
          let length = 0;
          let openings = 0;
          if (job === "room") {
            const L = Number(a.room_length_ft) || 0;
            const W = Number(a.room_width_ft) || 0;
            if (!L || !W) return { forModel: { needInput: "Ask for the room size (length × width) in one short question." } };
            const n = Math.max(1, Math.round(Number(a.rooms) || 1));
            length = roomsWallLength(L, W, n, n > 1);
            // A door and a window per room unless told otherwise.
            const doors = a.doors === undefined ? 1 : Number(a.doors) || 0;
            const windows = a.windows === undefined ? 1 : Number(a.windows) || 0;
            openings = (doors * 21 + windows * 16) * n;
            title = `${n > 1 ? `${n} rooms of ` : ""}${L}' × ${W}'${n > 1 ? " side by side" : " room"}, ${height} ft high, ${thick}" walls`;
          } else if (job === "boundary") {
            const front = Number(a.plot_front_ft) || plot?.front || 0;
            const depth = Number(a.plot_depth_ft) || plot?.depth || 0;
            if (!front || !depth) return { forModel: { needInput: "Ask the plot size (e.g. 5 marla) in one short question." } };
            const sides = ([4, 3, 1] as const).find((x) => x === Number(a.sides)) ?? 4;
            length = boundaryLength(front, depth, sides, a.gate_ft === undefined ? 10 : Number(a.gate_ft) || 0);
            title = `Boundary wall, ${plot && plot.front === front && plot.depth === depth ? plot.label : `${front}' × ${depth}'`} plot, ${sides === 4 ? "all sides" : sides === 3 ? "3 sides" : "front only"}, ${height} ft high + foundation`;
          } else {
            length = Number(a.wall_length_ft) || (Number(a.wall_area_sqft) ? Number(a.wall_area_sqft) / height : 0);
            if (!length) return { forModel: { needInput: "Ask what they're building — a room (size), a boundary wall (plot size) or a wall (length) — in one short question." } };
            openings = (Number(a.doors) || 0) * 21 + (Number(a.windows) || 0) * 16;
            title = `${n0(length)} ft of ${thick}" wall, ${height} ft high`;
          }
          const w = brickwork({ lengthFt: length, heightFt: height, thicknessIn: thick, openingsSqft: openings, mortar }, m);
          if (job === "boundary") {
            // Foundation below ground: about 2 ft deep, 13.5" wide.
            const f = brickwork({ lengthFt: length, heightFt: 2, thicknessIn: 13.5, openingsSqft: 0, mortar }, m);
            r = { bricks: w.bricks + f.bricks, cementBags: w.cementBags + f.cementBags, sandCft: w.sandCft + f.sandCft, volumeCft: w.volumeCft + f.volumeCft };
          } else r = w;
        }
        const bags = Math.ceil(r.cementBags);
        const total = r.bricks * brickRate + bags * cementRate + r.sandCft * sandRate;
        return {
          forModel: { job, bricks: r.bricks, brickworkCft: Math.round(r.volumeCft), wastagePct: m.brickWastagePct, brickQuality: second ? "second class" : "first class", cementBags: bags, sandCft: Math.round(r.sandCft), totalCost: rs(total), city, shownAsCard: true },
          cards: {
            kind: "estimate",
            title: `${title} · 1:${mortar} mortar`,
            headline: n0(r.bricks),
            headlineLabel: "Bricks needed",
            rows: [
              { k: `Bricks (${second ? "second" : "first"} class)`, v: n0(r.bricks), note: `${rs(r.bricks * brickRate)} · ${rs(brickRate * 1000).replace("PKR ", "Rs ")} per 1,000` },
              { k: "Cement", v: `${bags} bags`, note: rs(bags * cementRate) },
              { k: "Sand", v: `${n0(r.sandCft)} cft`, note: rs(r.sandCft * sandRate) },
            ],
            total: `${rs(total)} in ${city} (material only)`,
            link: "/tools/bricks-calculator",
            linkLabel: "Open the bricks calculator",
          },
        };
      }

      const work = (["roof", "plaster", "floor", "concrete", "brick_mortar", "house"] as const).find((x) => x === a.work) ?? "concrete";
      const roomL = Number(a.room_length_ft) || 0;
      const roomW = Number(a.room_width_ft) || 0;
      const nRooms = Math.max(1, Math.round(Number(a.rooms) || 1));
      const roomText = `${nRooms > 1 ? `${nRooms} rooms of ` : ""}${roomL}' × ${roomW}'`;
      const mixOf = (d: ConcreteMix) => (CONCRETE_MIXES.find((x) => x.v === String(a.mix || "").replace(/\s/g, ""))?.v || d) as ConcreteMix;
      let r: { cementBags: number; sandCft: number; crushCft: number; waterLitres?: number };
      let title = "";
      if (work === "roof") {
        const plot = plotOf(a.plot);
        const area = roomL && roomW ? roomL * roomW * nRooms : plot ? coveredOf(plot.marla, 1) : 0;
        if (!area) return { forModel: { needInput: "Ask the room size (or plot size for a whole floor) in one short question." } };
        const t = Number(a.thickness_in) || 5;
        const beams = yes(a.beams, true);
        const mix = mixOf("1:2:4");
        // Beams under a slab add roughly an eighth to its concrete.
        r = concreteMix(area * (t / 12) * (beams ? 1.12 : 1), mix, m);
        title = `Roof (lenter) of ${roomL && roomW ? roomText : `a ${plot!.label} floor`} · ${n0(area)} sq ft × ${t}"${beams ? " + beams" : ""}, ${mix}`;
      } else if (work === "plaster") {
        let area = Number(a.area_sqft) || 0;
        const fromRoom = !area && !!roomL && !!roomW;
        if (fromRoom) {
          const h = Number(a.room_height_ft) || 10;
          // Four walls less a door and a window, plus the ceiling.
          area = (Math.max(0, 2 * (roomL + roomW) * h - 37) + (yes(a.ceiling, true) ? roomL * roomW : 0)) * nRooms;
        }
        if (!area) return { forModel: { needInput: "Ask the room size (or the area to plaster) in one short question." } };
        const t = Number(a.thickness_in) || 0.5;
        const mix = ratio(a.mix, 6);
        r = plasterMix(area, t, mix, m);
        title = `${fromRoom ? `Plaster of ${roomText} · ` : ""}${n0(area)} sq ft of ${t}" plaster, 1:${mix}`;
      } else if (work === "floor") {
        const area = roomL * roomW * nRooms || Number(a.area_sqft) || 0;
        if (!area) return { forModel: { needInput: "Ask the floor size in one short question." } };
        const t = Number(a.thickness_in) || 3;
        const mix = mixOf("1:4:8");
        r = concreteMix(area * (t / 12), mix, m);
        title = `Floor base (PCC) · ${n0(area)} sq ft × ${t}", ${mix}`;
      } else if (work === "house") {
        const plot = plotOf(a.plot);
        if (!plot) return { forModel: { needInput: "Ask the plot size (e.g. 5 marla) and storeys in one short question." } };
        const covered = coveredOf(plot.marla, storeys);
        const q = data.config.qty;
        r = { cementBags: covered * q.cement, sandCft: covered * q.sand, crushCft: covered * q.crush };
        title = `${plot.label} house, ${storeys} storey${storeys > 1 ? "s" : ""} · ${n0(covered)} sq ft covered (foundations to plaster)`;
      } else if (work === "concrete") {
        const mix = mixOf("1:2:4");
        const depth = Number(a.depth_ft) || (Number(a.thickness_in) || 5) / 12;
        const vol = Number(a.volume_cft) || (Number(a.length_ft) || 0) * (Number(a.width_ft) || 0) * depth * (Number(a.count) || 1);
        if (!vol) return { forModel: { needInput: "Ask for the size (length, width, depth) and how many, in one short question." } };
        r = concreteMix(vol, mix, m);
        title = `${n0(vol)} cft of ${mix} concrete`;
      } else {
        const thick = [4.5, 9, 13.5].includes(Number(a.thickness_in)) ? Number(a.thickness_in) : 9;
        const len = Number(a.length_ft) || 0;
        if (!len) return { forModel: { needInput: "Ask for the wall length and height in one short question." } };
        const mix = ratio(a.mix, 6);
        r = { ...brickwork({ lengthFt: len, heightFt: Number(a.width_ft) || 10, thicknessIn: thick, openingsSqft: 0, mortar: mix }, m) };
        title = `Mortar for ${n0(len)} ft × ${Number(a.width_ft) || 10} ft of ${thick}" wall, 1:${mix}`;
      }
      const bags = Math.ceil(r.cementBags);
      const crushRate = rateOf(data, "crush", city);
      const total = bags * cementRate + r.sandCft * sandRate + r.crushCft * crushRate;
      return {
        forModel: { work, cementBags: bags, sandCft: Math.round(r.sandCft), crushCft: Math.round(r.crushCft), waterLitres: r.waterLitres ? Math.round(r.waterLitres) : undefined, totalCost: rs(total), city, shownAsCard: true },
        cards: {
          kind: "estimate",
          title,
          headline: n0(bags),
          headlineLabel: "Cement bags (50 kg)",
          rows: [
            { k: "Cement", v: `${bags} bags`, note: rs(bags * cementRate) },
            { k: "Sand", v: `${n0(r.sandCft)} cft`, note: rs(r.sandCft * sandRate) },
            ...(r.crushCft ? [{ k: "Crush (bajri)", v: `${n0(r.crushCft)} cft`, note: rs(r.crushCft * crushRate) }] : []),
            ...(r.waterLitres ? [{ k: "Water", v: `${n0(r.waterLitres)} litres` }] : []),
          ],
          total: `${rs(total)} in ${city} (material only)`,
          link: "/tools/cement-bags-calculator",
          linkLabel: "Open the cement bags calculator",
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
      // A name: look in every city (or the one they said) — never in a guessed one.
      if (String(a.name || "").trim()) {
        const name = String(a.name).trim().slice(0, 60);
        const city = String(a.city || "").trim();
        const r = await api<any>(`/dealers/search?q=${encodeURIComponent(name)}${city ? `&city=${encodeURIComponent(city)}` : ""}`).catch(() => null);
        const found: any[] = r?.dealers || [];
        const items = found.map((d: any) => ({
          name: d.name,
          url: dealerHref(d),
          avatar: d.avatarUrl || "",
          verified: !!d.verified,
          listings: d.listings || 0,
          years: d.experienceYears || 0,
          isAgency: !!d.isAgency,
          agency: d.agency?.name ? `${d.agency.name}` : "",
          plan: d.plan || "",
          city: d.city?.name || "",
        }));
        const exact = r?.exact ?? 0;
        return {
          forModel: {
            searchedFor: name,
            inCity: city || "all cities",
            exactMatches: exact,
            similarNames: exact ? [] : items.map((d) => d.name),
            matches: items.map((d) => ({ name: d.name, city: d.city, verified: d.verified, listings: d.listings })),
            shownAsCard: items.length > 0,
          },
          cards: {
            kind: "agents",
            q: { name, city: city || undefined },
            city: city || "",
            query: name,
            exact,
            total: r?.total ?? items.length,
            items,
            moreUrl: city ? dealersCityPath(CITY_SLUG(city)) : "/property-dealers",
          },
        };
      }
      const city = String(a.city || "").trim();
      if (!city) return { forModel: { needCity: "Ask which city in one short line (offer Lahore, Karachi, Islamabad, Rawalpindi)." } };
      const slug = CITY_SLUG(city);
      const r = await api<any>(`/dealers/city/${encodeURIComponent(slug)}?limit=60${a.name ? `&q=${encodeURIComponent(String(a.name).slice(0, 40))}` : ""}`).catch(() => null);
      if (!r) return { forModel: { error: `No dealer directory for ${city}` }, cards: { kind: "agents", q: { city }, city, total: 0, items: [], moreUrl: "/property-dealers" } };
      const all = [...(r.agencies || []), ...(r.agents || [])].sort(
        (x: any, y: any) => Number(y.verified) - Number(x.verified) || (y.rank || 0) - (x.rank || 0) || (y.listings || 0) - (x.listings || 0),
      );
      const items = all.slice(0, 6).map((d: any) => ({
        name: d.name,
        url: dealerHref(d),
        avatar: d.avatarUrl || "",
        verified: !!d.verified,
        listings: d.listings || 0,
        years: d.experienceYears || 0,
        isAgency: !!d.isAgency,
        agency: d.agency?.name || "",
        // No phone numbers here, on purpose: the assistant must not become a
        // way to collect dealers' numbers in bulk. Contact is on the profile.
        plan: d.plan || "",
      }));
      const cityName = r.city?.name || city;
      const total = (r.found?.agencies ?? 0) + (r.found?.agents ?? 0);
      return {
        forModel: { city: cityName, total, shownAsCard: true, top: items.map((d) => ({ name: d.name, verified: d.verified, listings: d.listings, agency: d.isAgency })) },
        cards: { kind: "agents", q: { city: cityName, name: a.name }, city: cityName, total, items, moreUrl: dealersCityPath(r.city?.slug || slug) },
      };
    }
    case "society_info": {
      const r = await api<any>(`/assistant/places?q=${encodeURIComponent(String(a.name || ""))}${a.city ? `&city=${encodeURIComponent(a.city)}` : ""}`);
      const p = (r.places || []).find((x: any) => x.society) || r.places?.[0];
      if (!p) return { forModel: { error: "No society or area by that name on the site" } };
      const g = p.society || {};
      const approval = g.approval ? String(g.approval).replace(/\bnot-approved\b/i, "Not approved").replace(/\bin-process\b/i, "In process").replace(/\bapproved\b/, "Approved") : "";
      const facts = [
        { k: "Developer", v: g.developer },
        { k: "Approval", v: approval },
        { k: "Possession", v: g.possession },
        { k: "Plot sizes", v: g.plotSizes },
        { k: "Total area", v: g.totalArea },
        { k: "Launched", v: g.launched },
        { k: "Payment plan", v: g.paymentPlan },
        { k: "Location", v: g.address },
      ].filter((f) => f.v) as { k: string; v: string }[];
      const card: Visual = {
        kind: "society",
        q: { name: p.name, city: p.city, place_ids: r.group?.ids || [p.id] },
        name: p.name,
        city: p.city,
        image: g.image || undefined,
        tagline: g.tagline || undefined,
        overview: g.overview || undefined,
        facts,
        amenities: g.amenities || [],
        listings: r.group?.listings ?? p.listings ?? 0,
        links: { page: g.url, map: g.url ? g.mapUrl : undefined, listings: String(p.url || "") },
      };
      return { forModel: { name: p.name, city: p.city, hasGuide: !!p.society, facts, amenities: g.amenities, nearby: g.nearby, overview: g.overview, listings: (card as any).listings, shownAsCard: true }, cards: card };
    }
    case "site_guides": {
      const r = await api<any>(`/assistant/guides?q=${encodeURIComponent(String(a.query || ""))}`).catch(() => ({ guides: [] }));
      const items = r.guides || [];
      return { forModel: { articles: items.map((g: any) => ({ title: g.title, url: g.url, summary: g.excerpt })), shownAsCard: items.length > 0 }, cards: items.length ? { kind: "guides", items } : undefined };
    }
    default:
      return { forModel: { error: `Unknown tool ${name}` } };
  }
}

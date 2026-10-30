/**
 * What the assistant offers next, worked out from what is on screen — the
 * place, size, type, prices and options of the card just shown — so every
 * suggestion names the exact thing ("10 Marla houses under PKR 3 Crore",
 * "5 Marla grey structure only"), never a vague "Prices in Lahore".
 *
 * Also answers the plainest typed questions (a material's rate, the cost of
 * building N marla) straight away, without the model: instant and free.
 *
 * No model and no network here; it is all plain rules over the card's data.
 */
import type { QuickRequest, SearchPrefill, Visual } from "@/lib/assistant/types";
import { moneyText, sizeLabel } from "./AssistantCards";

export type Action = { type: "send"; text: string } | { type: "quick"; req: QuickRequest; say: string } | { type: "form"; card: Visual; say: string; intro: string };
export type Chip = { label: string; action: Action };

export const SEARCH_INTRO = "Fill in what you know — leave the rest on Any.";
export const searchForm = (prefill?: SearchPrefill): Visual => ({ kind: "form", form: "search", prefill });

const BUILD_CITIES = ["Lahore", "Karachi", "Islamabad", "Rawalpindi"];
const DEALER_CITIES = ["Lahore", "Karachi", "Islamabad", "Rawalpindi", "Faisalabad", "Multan", "Peshawar", "Gujranwala", "Sialkot", "Bahawalpur", "Hyderabad", "Quetta", "Sargodha", "Sahiwal", "Okara", "Kasur", "Sheikhupura"];
const PLOT_STEPS = [3, 5, 7, 10, 20, 40];

const quick = (label: string, tool: QuickRequest["tool"], args: Record<string, unknown>, say = label): Chip => ({ label, action: { type: "quick", req: { tool, args }, say } });

/** "houses", "plots", "flats", "properties". */
function typeWord(types: unknown, plural = true): string {
  const t = Array.isArray(types) && types.length === 1 ? String(types[0]) : "";
  const one = t === "house" ? "house" : t === "plot" ? "plot" : t === "flat" || t === "apartment" ? "flat" : t === "commercial" ? "commercial property" : t === "shop" ? "shop" : t === "office" ? "office" : "property";
  if (!plural) return one;
  return one === "property" ? "properties" : one === "commercial property" ? "commercial properties" : `${one}s`;
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "10 Marla" / "1 Kanal" → marla. */
function marlaOf(size: string): number {
  const m = /([\d.]+)\s*(marla|kanal)/i.exec(size || "");
  if (!m) return 0;
  return m[2]!.toLowerCase() === "kanal" ? Number(m[1]) * 20 : Number(m[1]);
}

/** A round budget a person would say: 3 Crore, 2.5 Crore, 85 Lakh, 60,000. */
function niceBudget(v: number): number {
  if (v >= 1e7) return Math.ceil(v / 5e6) * 5e6;
  if (v >= 1e6) return Math.ceil(v / 5e5) * 5e5;
  if (v >= 1e5) return Math.ceil(v / 5e4) * 5e4;
  return Math.ceil(v / 5e3) * 5e3;
}

function mostCommon<T>(list: T[]): { v: T; n: number } | null {
  const m = new Map<T, number>();
  for (const x of list) if (x) m.set(x, (m.get(x) || 0) + 1);
  let best: { v: T; n: number } | null = null;
  for (const [v, n] of m) if (!best || n > best.n) best = { v, n };
  return best;
}

const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)]! : 0;
};

const floorsWord = (f: number) => (f === 1 ? "single storey" : f === 3 ? "triple storey" : "double storey");

/** Follow-ups for a card. At most four, most useful first. */
export function chipsFor(card: Visual | null | undefined): Chip[] {
  if (!card) return [];
  const a: Record<string, any> = card.q || {};
  const scope = { place_ids: a.place_ids, city_id: a.city_id, location: a.location, city: a.city };
  const out: Chip[] = [];
  const push = (c: Chip | null | false | undefined) => {
    if (c && out.length < 4 && !out.some((x) => x.label === c.label)) out.push(c);
  };

  switch (card.kind) {
    case "listings": {
      const [place = "", city = a.city || ""] = (card.label || "").split(", ");
      const where = place || city;
      const T = typeWord(a.types);
      const rent = a.purpose === "rent";
      const prefill: SearchPrefill = {
        purpose: rent ? "rent" : "sale",
        city: city || a.city,
        location: place || undefined,
        placeId: Array.isArray(a.place_ids) && a.place_ids.length === 1 ? a.place_ids[0] : undefined,
        type: Array.isArray(a.types) ? a.types[0] : undefined,
        marla: a.min_marla,
        maxPrice: a.max_price,
        beds: a.min_beds,
      };
      const edit: Chip = { label: "Edit search", action: { type: "form", card: searchForm(prefill), say: "Edit search", intro: SEARCH_INTRO } };

      if (!card.total) {
        if (a.max_price) push(quick(`${cap(T)} at any budget${where ? ` in ${where}` : ""}`, "search_listings", { ...a, max_price: undefined }));
        if (a.min_marla) push(quick(`Any size ${T}${where ? ` in ${where}` : ""}`, "search_listings", { ...a, min_marla: undefined, max_marla: undefined }));
        if (place && city) push(quick(`${cap(T)} anywhere in ${city}`, "search_listings", { ...a, place_ids: undefined, location: undefined, city }));
        if (a.min_beds) push(quick(`Any bedrooms${where ? ` in ${where}` : ""}`, "search_listings", { ...a, min_beds: undefined }));
        push(edit);
        return out;
      }

      const items = card.items || [];
      // A size most of these are.
      if (!a.min_marla) {
        const s = mostCommon(items.map((i) => i.size).filter(Boolean));
        if (s && s.n >= 2 && marlaOf(s.v)) push(quick(`Only ${s.v} ${T}`, "search_listings", { ...a, min_marla: marlaOf(s.v), max_marla: marlaOf(s.v) }, `${s.v} ${T} ${rent ? "for rent" : "for sale"}${where ? ` in ${where}` : ""}`));
      }
      // A budget a little under the middle of these.
      if (!a.max_price && items.length >= 3) {
        const prices = items.map((i: any) => Number(i.price) || 0).filter((n) => n > 0);
        if (prices.length >= 3) {
          const b = niceBudget(median(prices));
          if (b < Math.max(...prices)) push(quick(`${cap(T)} under PKR ${moneyText(b)}`, "search_listings", { ...a, max_price: b }, `${cap(T)} under PKR ${moneyText(b)}${where ? ` in ${where}` : ""}`));
        }
      }
      // Several areas under one name: the part most of these are in.
      if (Array.isArray(a.place_ids) && a.place_ids.length > 1) {
        const sub = mostCommon(items.map((i) => (i.place || "").split(",")[0]!.trim()).filter((p) => p && p.toLowerCase() !== place.toLowerCase()));
        if (sub && sub.n >= 2) push(quick(`Only in ${sub.v}`, "search_listings", { ...a, place_ids: undefined, city_id: undefined, location: sub.v, city }, `${cap(T)} in ${sub.v}`));
      }
      // What these cost there, for exactly this size and type.
      if (where) {
        const size = a.min_marla && a.min_marla === a.max_marla ? `${sizeLabel(a.min_marla)} ` : "";
        push(quick(cap(`${size}${typeWord(a.types, false)} prices in ${where}`), "market_prices", { ...scope, purpose: a.purpose, types: a.types, min_marla: a.min_marla, max_marla: a.max_marla }));
      }
      if (card.total > items.length && a.sort !== "cheapest") push(quick(`Cheapest ${T} first`, "search_listings", { ...a, sort: "cheapest" }));
      if (where) push(quick(`${cap(T)} for ${rent ? "sale" : "rent"} in ${where}`, "search_listings", { ...a, purpose: rent ? "sale" : "rent", max_price: undefined, sort: "best" }));
      if (out.length < 4) push(edit);
      return out;
    }

    case "market": {
      const m = card.market.find((x) => x.listings > 0);
      const place = card.place.split(", ")[0] || card.place;
      const city = card.place.split(", ")[1] || a.city || "";
      if (!m) {
        if (city && city !== place) push(quick(`Prices in all of ${city}`, "market_prices", { city }));
        push({ label: "Check another area", action: { type: "form", card: { kind: "form", form: "market", prefill: { city } }, say: "Check another area", intro: "Which area would you like to check?" } });
        return out;
      }
      const rent = m.purpose === "rent";
      const T = typeWord(a.types);
      const sizes = (m.bySize || []).slice(0, 2);
      for (const s of sizes) {
        const mm = marlaOf(s.size);
        if (mm) push(quick(`${s.size} ${T} ${rent ? "for rent" : "for sale"} here`, "search_listings", { ...scope, purpose: m.purpose, types: a.types, min_marla: mm, max_marla: mm }, `${s.size} ${T} ${rent ? "for rent" : "for sale"} in ${place}`));
      }
      const top = marlaOf(sizes[0]?.size || "");
      if (top && top <= 40 && !rent) push(quick(`Cost to build ${sizeLabel(top)} house`, "construction_cost", { plot_marla: top, floors: 2, city: BUILD_CITIES.includes(city) ? city : "Lahore" }));
      push({ label: "Compare another area", action: { type: "form", card: { kind: "form", form: "market", prefill: { city } }, say: "Compare another area", intro: "Which area would you like to compare?" } });
      return out;
    }

    case "rates": {
      const f = String(card.focus || a.material || "");
      if (!/cement/.test(f)) push(quick("Cement prices by brand", "material_rates", { material: "cement" }));
      if (!/steel|sar/.test(f)) push(quick("Steel (sarya) prices by brand", "material_rates", { material: "steel" }));
      if (f && !/brick/.test(f)) push(quick("Bricks rate today", "material_rates", { material: "bricks" }));
      push(quick("5 Marla grey structure cost", "construction_cost", { plot_marla: 5, floors: 2, kind: "grey" }));
      push(quick("10 Marla complete house cost", "construction_cost", { plot_marla: 10, floors: 2, kind: "complete" }));
      return out;
    }

    case "construction": {
      const inp = card.input || { marla: 5, floors: 2, city: card.city };
      const base = { plot_marla: inp.marla, floors: inp.floors, city: inp.city };
      const plot = sizeLabel(inp.marla) || card.plot;
      if (card.selected === "grey") push(quick(`${plot} complete house cost`, "construction_cost", { ...base, kind: "complete", quality: "standard" }));
      else push(quick(`${plot} grey structure only`, "construction_cost", { ...base, kind: "grey" }));
      const otherFloors = inp.floors === 2 ? 1 : 2;
      push(quick(`${plot} ${floorsWord(otherFloors)} cost`, "construction_cost", { ...base, floors: otherFloors, kind: card.selected === "grey" ? "grey" : "complete", quality: card.selected === "grey" ? "standard" : card.selected }));
      push(quick(`${plot} plots for sale in ${inp.city}`, "search_listings", { purpose: "sale", city: inp.city, location: inp.city, types: ["plot"], min_marla: inp.marla, max_marla: inp.marla }));
      const next = PLOT_STEPS.find((s) => s > inp.marla);
      if (next) push(quick(`${sizeLabel(next)} ${floorsWord(inp.floors)} cost`, "construction_cost", { ...base, plot_marla: next }));
      push(quick("Today's cement & steel rates", "material_rates", {}));
      return out;
    }

    case "agents": {
      const city = card.city;
      push(quick(`Houses for sale in ${city}`, "search_listings", { purpose: "sale", city, location: city, types: ["house"] }));
      push(quick(`Plots for sale in ${city}`, "search_listings", { purpose: "sale", city, location: city, types: ["plot"] }));
      push(quick(`Property prices in ${city}`, "market_prices", { city, location: city }));
      return out;
    }

    case "society": {
      const scope = { place_ids: a.place_ids, city: card.city };
      push(quick(`Plots for sale in ${card.name}`, "search_listings", { ...scope, purpose: "sale", types: ["plot"] }));
      push(quick(`Houses for sale in ${card.name}`, "search_listings", { ...scope, purpose: "sale", types: ["house"] }));
      push(quick(`Prices in ${card.name}`, "market_prices", scope));
      push(quick(`Dealers in ${card.city}`, "find_agents", { city: card.city }));
      return out;
    }

    default:
      return [];
  }
}

/* ── plain questions answered without the model ─────────────────────────── */

const MATERIALS: [RegExp, string][] = [
  [/\b(cement|siment|seement)\b|سیمنٹ/, "cement"],
  [/\b(steel|sarya|saria|sariya|sariye|sarye|rebar|tmt)\b|سریا/, "steel"],
  [/\b(bricks?|eent|eint|int|inten|eenten|eentein)\b|اینٹ/, "bricks"],
  [/\b(sand|ret|reti|rait)\b|ریت/, "sand"],
  [/\b(bajri|bajree|crush|rodi|bajar)\b|بجری/, "bajri"],
];
const PRICE_WORD = /\b(rate|rates|price|prices|qeemat|keemat|qimat|bhao|bhaav|kitne|kitna|kya hai|aaj|today|brand)\b|ریٹ|قیمت|بھاؤ/;
const BUILD_WORD = /\b(construction|constuction|tameer|tamir|banane|banana|banwane|bnane|bnana|banwana|build|building|grey structure|gray structure|structure|kharcha|kharch)\b|تعمیر|بنانے|خرچ/;
/** Anything that needs thinking, comparing or explaining goes to the model. */
const NEEDS_MODEL = /\b(compare|vs|versus|difference|farq|fark|better|behtar|kaun sa|konsa|which|why|kyun|kyon|should|chahiye|loan|emi|installment|qist|rent|kiraya|plot|buy|khareed|sell|bech)\b|\?.*\?/;

/** A typed message the app can answer itself, or null to ask the model. */
export function localRoute(text: string): QuickRequest | null {
  const t = ` ${text.toLowerCase().replace(/[^\p{L}\p{N}\s.]/gu, " ").replace(/\s+/g, " ")} `;
  if (t.length > 90) return null;
  const build = BUILD_WORD.test(t);

  // "dealers in lahore", "karachi property agent", "lahore ke dealer"
  if (/\b(dealer|dealers|agent|agents|agency|agencies|broker|brokers)\b|ڈیلر|ایجنٹ/.test(t) && !/\b(compare|best|why|kyun|fee|commission|how|kaise)\b/.test(t)) {
    const city = DEALER_CITIES.find((c) => t.includes(` ${c.toLowerCase()} `));
    if (city) return { tool: "find_agents", args: { city } };
  }
  const material = MATERIALS.find(([re]) => re.test(t))?.[1];

  if (material && !build && PRICE_WORD.test(t) && !NEEDS_MODEL.test(t)) return { tool: "material_rates", args: { material } };
  if (!material && !build && /\b(material|materials)\b/.test(t) && PRICE_WORD.test(t)) return { tool: "material_rates", args: {} };

  if (build && !material && !/\b(compare|vs|difference|farq|fark|loan|emi|why|kyun)\b/.test(t)) {
    const size = /(\d+(?:\.\d+)?)\s*(marla|marle|kanal|kanaal)/.exec(t);
    const marla = size ? Number(size[1]) * (/^kana/.test(size[2]!) ? 20 : 1) : 5;
    if (!(marla >= 1 && marla <= 200)) return null;
    const floors = /\b(single|ek manzil|one storey|1 storey|1 story|single story)\b/.test(t) ? 1 : /\b(triple|teen manzil|3 storey|3 story)\b/.test(t) ? 3 : 2;
    const kind = /\b(grey|gray|structure|dhancha)\b/.test(t) ? "grey" : "complete";
    const quality = /\b(premium|luxury|high end)\b/.test(t) ? "premium" : /\b(economy|sasta|budget|cheap)\b/.test(t) ? "economy" : "standard";
    const city = BUILD_CITIES.find((c) => t.includes(` ${c.toLowerCase()} `)) || "Lahore";
    return { tool: "construction_cost", args: { plot_marla: marla, floors, kind, quality, city } };
  }
  return null;
}

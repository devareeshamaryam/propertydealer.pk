/**
 * Pakistani property conventions: money in lakh/crore, land in marla/kanal.
 *
 * Nobody here quotes a house as "15,500,000 rupees, 1125 square feet" — it is
 * "1 crore 55 lakh, 5 marla". The database keeps the canonical numbers (rupees,
 * square feet) so nothing already stored has to change; these helpers are the
 * translation layer the forms and cards use on top.
 */

/* ────────────────────────────── Money ────────────────────────────── */

export const THOUSAND = 1_000;
export const LAKH = 100_000;
export const CRORE = 10_000_000;
export const ARAB = 1_000_000_000;

/**
 * "1 Crore 55 Lakh" — the full breakdown, for confirming what was typed.
 *
 * Deliberately exact rather than rounded: this sits under a price box so
 * someone can see at a glance that the zeros they typed mean what they think.
 */
export function amountInWords(value: number | string | null | undefined): string {
  const amount = typeof value === "string" ? Number(value.replace(/[,\s]/g, "")) : value;
  if (amount === null || amount === undefined || !Number.isFinite(amount) || amount <= 0) {
    return "";
  }

  let left = Math.round(amount);
  const parts: string[] = [];

  for (const [unit, label] of [
    [ARAB, "Arab"],
    [CRORE, "Crore"],
    [LAKH, "Lakh"],
    [THOUSAND, "Thousand"],
  ] as const) {
    const count = Math.floor(left / unit);
    if (count > 0) {
      parts.push(`${count} ${label}`);
      left -= count * unit;
    }
  }

  if (left > 0) parts.push(String(left));

  return parts.join(" ");
}

/**
 * "1.55 Crore" — the short form used on cards and in search results, the way
 * Zameen and OLX print a price.
 */
export function amountShort(value: number | string | null | undefined): string {
  const amount = typeof value === "string" ? Number(value.replace(/[,\s]/g, "")) : value;
  if (amount === null || amount === undefined || !Number.isFinite(amount) || amount <= 0) {
    return "";
  }

  const trim = (n: number) => String(Number(n.toFixed(2)));

  if (amount >= ARAB) return `${trim(amount / ARAB)} Arab`;
  if (amount >= CRORE) return `${trim(amount / CRORE)} Crore`;
  if (amount >= LAKH) return `${trim(amount / LAKH)} Lakh`;
  if (amount >= THOUSAND) return `${trim(amount / THOUSAND)} Thousand`;
  return String(Math.round(amount));
}

/** Digits with separators, e.g. "15,500,000". */
export function amountWithSeparators(value: number | string | null | undefined): string {
  const amount = typeof value === "string" ? Number(value.replace(/[,\s]/g, "")) : value;
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return "";
  return amount.toLocaleString("en-PK");
}

/* ────────────────────────────── Area ────────────────────────────── */

export type AreaUnit = "marla" | "kanal" | "sqft" | "sqyd" | "acre";

/**
 * Square feet per unit, on the standard 1 Kanal = 20 Marla = 4,500 sq ft scale
 * that Zameen, Graana and the DHA/Bahria societies all quote.
 *
 * (Old Lahore's 272.25 sq ft "marla" still exists in some paperwork, but no
 * portal lists on it, and mixing the two would make sizes incomparable.)
 */
export const SQFT_PER_UNIT: Record<AreaUnit, number> = {
  marla: 225,
  kanal: 4500,
  sqft: 1,
  sqyd: 9,
  acre: 43560,
};

export const AREA_UNITS: { value: AreaUnit; label: string; short: string }[] = [
  { value: "marla", label: "Marla", short: "marla" },
  { value: "kanal", label: "Kanal", short: "kanal" },
  { value: "sqft", label: "Square Feet", short: "sq ft" },
  { value: "sqyd", label: "Square Yards", short: "sq yd" },
  { value: "acre", label: "Acre", short: "acre" },
];

export function unitLabel(unit: AreaUnit): string {
  return AREA_UNITS.find((entry) => entry.value === unit)?.short ?? unit;
}

export function toSquareFeet(value: number | string, unit: AreaUnit): number {
  const size = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(size) || size <= 0) return 0;
  return Math.round(size * SQFT_PER_UNIT[unit]);
}

export function fromSquareFeet(sqft: number | string, unit: AreaUnit): number {
  const size = typeof sqft === "string" ? Number(sqft) : sqft;
  if (!Number.isFinite(size) || size <= 0) return 0;
  // Two decimals: 1,130 sq ft is 5.02 marla, and rounding it to 5 would quietly
  // change the listing's size.
  return Number((size / SQFT_PER_UNIT[unit]).toFixed(2));
}

/**
 * Pick the unit a size is most naturally quoted in — how a Pakistani listing
 * would print it. Used when an existing listing only has square feet stored.
 */
export function naturalAreaUnit(sqft: number): AreaUnit {
  if (!Number.isFinite(sqft) || sqft <= 0) return "marla";
  if (sqft >= SQFT_PER_UNIT.acre) return "acre";
  if (sqft % SQFT_PER_UNIT.kanal === 0 && sqft >= SQFT_PER_UNIT.kanal) return "kanal";
  if (sqft >= SQFT_PER_UNIT.kanal * 2) return "kanal";
  if (sqft % SQFT_PER_UNIT.marla === 0) return "marla";
  return "marla";
}

/** "5 Marla · 1,125 sq ft" for display next to an input. */
export function areaInWords(sqft: number): string {
  if (!Number.isFinite(sqft) || sqft <= 0) return "";

  const unit = naturalAreaUnit(sqft);
  const size = fromSquareFeet(sqft, unit);
  const name = AREA_UNITS.find((entry) => entry.value === unit)?.label ?? unit;

  if (unit === "sqft") return `${sqft.toLocaleString("en-PK")} sq ft`;
  return `${size} ${name} · ${sqft.toLocaleString("en-PK")} sq ft`;
}

/**
 * The marla / kanal columns the schema keeps alongside areaSize, so the
 * existing size filters and area pages ("5 marla houses in DHA") keep working.
 */
export function marlaKanalFor(sqft: number): { marla: number; kanal: number } {
  if (!Number.isFinite(sqft) || sqft <= 0) return { marla: 0, kanal: 0 };
  const kanal = sqft / SQFT_PER_UNIT.kanal;
  return {
    marla: Number((sqft / SQFT_PER_UNIT.marla).toFixed(2)),
    // Only a whole-kanal plot is described in kanal; 7 marla is not "0.35 kanal".
    kanal: Number.isInteger(kanal) ? kanal : 0,
  };
}

/**
 * How a listing's size should read on a card: "5 Marla", "1 Kanal", "1,800 sq ft".
 *
 * Prefers the stored marla/kanal columns and falls back to converting the
 * square footage, so legacy listings that only ever had sq ft still read the
 * way a buyer here expects rather than as a raw number of square feet.
 */
export function propertySizeLabel(
  property: { marla?: number | null; kanal?: number | null; areaSize?: number | null },
  style: "long" | "short" = "long",
): string {
  const kanal = Number(property.kanal) || 0;
  const marla = Number(property.marla) || 0;
  const sqft = Number(property.areaSize) || 0;

  const say = (size: number, unit: "Marla" | "Kanal") =>
    style === "short" ? `${size}${unit[0]}` : `${size} ${unit}`;

  if (kanal >= 1) return say(Number(kanal.toFixed(2)), "Kanal");
  if (marla > 0) {
    // 20 marla is a kanal, and that is how it would be advertised.
    if (marla % 20 === 0) return say(marla / 20, "Kanal");
    return say(Number(marla.toFixed(2)), "Marla");
  }

  if (sqft > 0) {
    const unit = naturalAreaUnit(sqft);
    if (unit === "sqft") {
      return style === "short"
        ? `${sqft.toLocaleString("en-PK")}sqft`
        : `${sqft.toLocaleString("en-PK")} sq ft`;
    }
    const size = fromSquareFeet(sqft, unit);
    return say(size, unit === "kanal" ? "Kanal" : "Marla");
  }

  return "—";
}

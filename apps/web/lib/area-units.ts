/*
 * Land and floor area, the way it is measured in Pakistan — one place for the
 * unit converter, the "show sizes in" setting and every size on the site.
 *
 * The one unit that is not fixed is the marla:
 *   225 sq ft     — societies, DHA, Bahria, LDA/CDA schemes, and every portal
 *                   (Zameen, Graana, this site). 1 Kanal = 4,500 sq ft.
 *   250 sq ft     — used in parts of some cities.
 *   272.25 sq ft  — the revenue (patwari) marla: old city areas, farmland and
 *                   land records. 9 sarsai of 30.25 sq ft; 160 marla = 1 acre.
 * Kanal (20 marla) and sarsai (1/9 marla) follow whichever marla is in use.
 * Square feet, yards, metres, acres and hectares never change.
 */

export const MARLA_STANDARDS = [
  { sqft: 225, label: '225 sq ft', hint: 'Societies, DHA, Bahria, LDA/CDA — the portal standard' },
  { sqft: 250, label: '250 sq ft', hint: 'Used in parts of some cities' },
  { sqft: 272.25, label: '272.25 sq ft', hint: 'Revenue (patwari) marla — old city areas and land records' },
] as const;

export const DEFAULT_MARLA_SQFT = 225;

export type UnitKey =
  | 'sqft'
  | 'sqyd'
  | 'sqm'
  | 'marla'
  | 'kanal'
  | 'sarsai'
  | 'karam'
  | 'acre'
  | 'killa'
  | 'murabba'
  | 'hectare'
  | 'sqkm';

export interface UnitDef {
  key: UnitKey;
  label: string;
  short: string;
  /** Square feet in one unit (for the given marla). */
  sqft: (marla: number) => number;
  /** Follows the marla standard. */
  local?: boolean;
  hint?: string;
}

export const UNITS: UnitDef[] = [
  { key: 'sqft', label: 'Square Feet', short: 'sq ft', sqft: () => 1 },
  { key: 'sqyd', label: 'Square Yards', short: 'sq yd', sqft: () => 9, hint: 'Gaz — how Karachi sizes plots' },
  { key: 'sqm', label: 'Square Meters', short: 'm²', sqft: () => 10.7639104 },
  { key: 'marla', label: 'Marla', short: 'marla', sqft: (m) => m, local: true },
  { key: 'kanal', label: 'Kanal', short: 'kanal', sqft: (m) => m * 20, local: true, hint: '20 marla' },
  { key: 'sarsai', label: 'Sarsai', short: 'sarsai', sqft: (m) => m / 9, local: true, hint: '1/9 marla' },
  { key: 'karam', label: 'Square Karam', short: 'sq karam', sqft: () => 30.25, hint: 'A karam is 5.5 ft' },
  { key: 'acre', label: 'Acre', short: 'acre', sqft: () => 43560 },
  { key: 'killa', label: 'Killa', short: 'killa', sqft: () => 43560, hint: '1 acre — Punjab farmland' },
  { key: 'murabba', label: 'Murabba', short: 'murabba', sqft: () => 43560 * 25, hint: '25 acres' },
  { key: 'hectare', label: 'Hectare', short: 'ha', sqft: () => 107639.104 },
  { key: 'sqkm', label: 'Square Kilometers', short: 'km²', sqft: () => 10763910.4 },
];

export const unitDef = (key: UnitKey) => UNITS.find((u) => u.key === key)!;

/** Any size to any unit, through square feet. */
export function convert(value: number, from: UnitKey, to: UnitKey, marla = DEFAULT_MARLA_SQFT): number {
  if (!Number.isFinite(value)) return 0;
  return (value * unitDef(from).sqft(marla)) / unitDef(to).sqft(marla);
}

/** A readable number: no trailing zeros, sensible precision for its size. */
export function nice(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '0';
  const abs = Math.abs(n);
  const digits = abs >= 1000 ? 0 : abs >= 100 ? 1 : abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6;
  return Number(n.toFixed(digits)).toLocaleString('en-PK', { maximumFractionDigits: digits });
}

/* ── "Show sizes in" — the visitor's choice, kept in this browser ── */

export type DisplayUnit = 'auto' | 'sqft' | 'sqyd' | 'sqm' | 'marla' | 'kanal';

export const DISPLAY_UNITS: { key: DisplayUnit; label: string; hint?: string }[] = [
  { key: 'auto', label: 'As listed', hint: 'Marla or Kanal — how the agent advertised it' },
  { key: 'sqft', label: 'Square Feet' },
  { key: 'sqyd', label: 'Square Yards' },
  { key: 'sqm', label: 'Square Meters' },
  { key: 'marla', label: 'Marla' },
  { key: 'kanal', label: 'Kanal' },
];

export interface SizedListing {
  /** Square feet, as stored. */
  areaSize?: number | string | null;
  marla?: number | null;
  kanal?: number | null;
  /** The marla this listing was entered in (its city's); 225 when not stored. */
  marlaSqft?: number | null;
}

const say = (n: number, unit: string, style: 'long' | 'short') => (style === 'short' ? `${nice(n)}${unit === 'Marla' || unit === 'Kanal' ? unit[0] : ` ${unit}`}` : `${nice(n)} ${unit}`);

/**
 * A listing's size in the visitor's unit.
 *
 * Marla and Kanal are the listing's own — "5 Marla" stays 5 Marla in a city
 * whose marla is 272.25 sq ft — while square feet, yards and metres come
 * from its real square footage, so a 5 marla plot there reads 1,361 sq ft,
 * not 1,125. Nothing is read twice or re-based: a listing without a stored
 * marla standard was entered on the 225 sq ft one and is shown on it.
 */
export function sizeIn(p: SizedListing, unit: DisplayUnit, style: 'long' | 'short' = 'long'): string {
  const marlaSqft = Number(p.marlaSqft) > 0 ? Number(p.marlaSqft) : DEFAULT_MARLA_SQFT;
  const storedMarla = (Number(p.kanal) || 0) * 20 || Number(p.marla) || 0;
  const sqft = Number(p.areaSize) || storedMarla * marlaSqft;
  const marla = storedMarla || sqft / marlaSqft;
  if (!sqft && !marla) return '—';

  switch (unit) {
    case 'sqft':
      return style === 'short' ? `${nice(sqft)} sqft` : `${nice(sqft)} sq ft`;
    case 'sqyd':
      return style === 'short' ? `${nice(sqft / 9)} sqyd` : `${nice(sqft / 9)} sq yd`;
    case 'sqm':
      return `${nice(sqft / 10.7639104)} m²`;
    case 'marla':
      return say(marla, 'Marla', style);
    case 'kanal':
      return say(marla / 20, 'Kanal', style);
    default: {
      // As advertised — the same rules the site has always used.
      const kanal = Number(p.kanal) || 0;
      const m = Number(p.marla) || 0;
      if (kanal >= 1) return say(kanal, 'Kanal', style);
      if (m > 0) return m % 20 === 0 ? say(m / 20, 'Kanal', style) : say(m, 'Marla', style);
      const kanalSqft = marlaSqft * 20;
      if (sqft >= kanalSqft * 2 || (sqft >= kanalSqft && sqft % kanalSqft === 0)) return say(sqft / kanalSqft, 'Kanal', style);
      return say(sqft / marlaSqft, 'Marla', style);
    }
  }
}

/** "1 Marla = 272.25 sq ft here" — shown when a listing's marla is not the usual one. */
export function marlaNote(p: SizedListing): string | null {
  const m = Number(p.marlaSqft);
  return m > 0 && m !== DEFAULT_MARLA_SQFT ? `1 Marla = ${nice(m)} sq ft here` : null;
}

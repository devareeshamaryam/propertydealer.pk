/*
 * Ready-made construction cost pages: one per plot size, city and kind —
 * "/tools/construction-cost-calculator/5-marla-house-construction-cost-lahore"
 * and "…/5-marla-grey-structure-cost-lahore". Each shows a standard
 * double-storey house on today's rates, with the calculator set up for it.
 */

import { coveredAreas, estimate, usualRooms, type ConstructionData, type Quality } from './tools';

export const CC_BASE = '/tools/construction-cost-calculator';

export interface CcSize {
  key: string;
  label: string;
  v: number;
  u: 'marla' | 'kanal';
  sqft: number;
}

export const CC_SIZES: CcSize[] = [
  ...[3, 4, 5, 6, 7, 8, 10].map((v) => ({ key: `${v}-marla`, label: `${v} Marla`, v, u: 'marla' as const, sqft: v * 225 })),
  ...[1, 2].map((v) => ({ key: `${v}-kanal`, label: `${v} Kanal`, v, u: 'kanal' as const, sqft: v * 4500 })),
];

export type CcKind = 'house' | 'grey';
const KIND_SLUG: Record<CcKind, string> = { house: 'house-construction-cost', grey: 'grey-structure-cost' };

export const citySlug = (name: string) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const ccHref = (size: CcSize, kind: CcKind, city: string) => `${CC_BASE}/${size.key}-${KIND_SLUG[kind]}-${citySlug(city)}`;

/** "5-marla-house-construction-cost-lahore" → its size, kind and city slug. */
export function parseCcSlug(slug: string): { size: CcSize; kind: CcKind; city: string } | null {
  const m = /^(\d+-(?:marla|kanal))-(house-construction-cost|grey-structure-cost)-([a-z0-9-]+)$/.exec(slug);
  if (!m) return null;
  const size = CC_SIZES.find((s) => s.key === m[1]);
  if (!size) return null;
  return { size, kind: m[2] === 'grey-structure-cost' ? 'grey' : 'house', city: m[3]! };
}

/** The cities that get ready-made pages (and sitemap entries): the ones with known cost levels first. */
export function pageCities(data: ConstructionData, limit = 12) {
  return data.config.cities.slice(0, limit);
}

/** A double-storey house of this plot size in this city — the house every ready-made page describes. */
export function sampleHouse(
  data: ConstructionData,
  plotSqft: number,
  kind: CcKind,
  cityName: string,
  quality: Quality = 'standard',
  mode: 'full' | 'labour' = 'full',
) {
  const covered = coveredAreas(plotSqft, { floors: 2, basement: false }).reduce((s, f) => s + f.sqft, 0);
  const rooms = usualRooms(covered, 2);
  const city = data.config.cities.find((c) => c.name === cityName);
  return estimate(
    {
      covered,
      basement: 0,
      kind: kind === 'grey' ? 'grey' : 'complete',
      quality,
      mode,
      cityFactor: city?.factor ?? 1,
      cityRates: data.cityRates?.[cityName],
      bathrooms: rooms.bathrooms,
      kitchens: rooms.kitchens,
    },
    data,
  );
}

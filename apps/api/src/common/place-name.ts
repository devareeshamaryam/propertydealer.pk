import { BadRequestException } from '@nestjs/common';

/**
 * A city or area name typed by an agent while listing: trimmed, single
 * spaces, at most 60 characters — and a name, not a sentence: no phone
 * numbers, links, or "near …" addresses, which made the old area list a
 * mess of duplicates. Returns the clean name in lower case (how areas are
 * stored) or throws with a message the form shows.
 */
export function cleanPlaceName(raw: unknown, what: 'city' | 'area'): string {
  const name = String(raw ?? '')
    .replace(/[\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (name.length < 2) throw new BadRequestException(`Enter the ${what} name`);
  if (name.length > 60) throw new BadRequestException(`Keep the ${what} name short — just its name, up to 60 characters`);
  if (/\d{6,}|https?:|www\.|@/i.test(name)) throw new BadRequestException(`Enter only the ${what} name — no phone numbers or links`);
  if (/\b(near|opposite|opp|behind|street no|house no|plot no)\b/i.test(name)) {
    throw new BadRequestException(`Enter only the ${what}'s name (e.g. "DHA Phase 6"); write the exact address in the listing`);
  }
  if (!/[a-z]/i.test(name)) throw new BadRequestException(`Enter the ${what} name in English letters`);
  return name.toLowerCase();
}

import { toTitleCase } from "@/lib/utils";

/**
 * A society's name for headings, without the city said twice.
 *
 * Area names carry the city in different ways — "dha multan", "royal orchard,
 * multan", "city housing" — and the pages add the city after the name, which
 * made "Royal Orchard, Multan Multan". `short` drops a trailing ", <city>";
 * `full` adds the city only when the name does not already say it.
 */
export function societyName(rawName: string, cityName: string): { short: string; full: string } {
  const city = cityName.trim();
  const esc = city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const short = toTitleCase(rawName).replace(new RegExp(`\\s*,\\s*${esc}\\s*$`, "i"), "").trim();
  const full = new RegExp(`\\b${esc}\\b`, "i").test(short) ? short : `${short} ${city}`;
  return { short, full };
}

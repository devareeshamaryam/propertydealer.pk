import Link from "next/link";
import { ChevronRight, Map as MapIcon } from "lucide-react";
import MapExplorerClient from "@/components/map/MapExplorerClient";
import SocietyMapGrid from "@/components/society-map/SocietyMapGrid";
import { getMapPlaces, getSocietyMaps } from "@/lib/society-map";
import { CITIES } from "./cities-data";

/*
 * The property map of Pakistan: every live listing, pinned — then the cities
 * (each opens its own map with the city selected) and the society master
 * plans.
 */
export default async function EmapPage() {
  const places = CITIES.map(({ slug, name, lat, lng, zoom }) => ({ slug, name, lat, lng, zoom }));
  const [maps, cityRows] = await Promise.all([getSocietyMaps(), getMapPlaces()]);

  // Cities with a page: the hand-placed list, plus any city the API knows with listings.
  const known = new Map(CITIES.map((c) => [c.slug, { slug: c.slug, name: c.name, listings: 0, societies: c.areas.length, maps: 0 }]));
  for (const r of cityRows) {
    const k = known.get(r.slug);
    known.set(r.slug, { slug: r.slug, name: k?.name ?? r.name, listings: r.listings ?? 0, societies: Math.max(k?.societies ?? 0, r.societies ?? 0), maps: 0 });
  }
  for (const m of maps) {
    const k = known.get(m.citySlug);
    if (k) k.maps++;
  }
  const cities = [...known.values()].sort((a, b) => b.maps - a.maps || b.listings - a.listings || a.name.localeCompare(b.name));
  const pictured = maps.filter((m) => m.kind === "plan" || m.kind === "document");

  return (
    <>
      <MapExplorerClient places={places} mode="page" />
      <section className="container mx-auto max-w-6xl pb-28 pt-5 lg:pb-12">
        <h1 className="text-[24px] font-bold tracking-tight text-slate-900 sm:text-[30px]">Housing Society Maps in Pakistan</h1>
        <p className="mt-1 max-w-3xl text-[15px] text-slate-600">
          Choose a city to open its map — every society with its outline, blocks, landmarks and approval status, official master and layout plans, plot finder, and the properties for sale and rent.
        </p>

        <h2 className="mt-6 text-[18px] font-bold text-slate-900 sm:text-[20px]">Cities</h2>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {cities.map((c) => (
            <li key={c.slug}>
              <Link href={`/emap/${c.slug}`} className="group flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white p-3 transition-colors hover:border-primary">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <MapIcon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold text-slate-900 group-hover:text-primary">{c.name} Map</span>
                  <span className="block truncate text-[12px] text-slate-500">
                    {[c.maps ? `${c.maps} society maps` : "", c.listings ? `${c.listings.toLocaleString("en-PK")} listings` : ""].filter(Boolean).join(" · ") || "Societies on the map"}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 text-slate-300" />
              </Link>
            </li>
          ))}
        </ul>

        {pictured.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-3 text-[18px] font-bold text-slate-900 sm:text-[20px]">Master plans &amp; approved layout plans</h2>
            <SocietyMapGrid items={pictured} showCity />
          </div>
        )}
      </section>
    </>
  );
}

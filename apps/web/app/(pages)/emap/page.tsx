import Link from "next/link";
import MapExplorerClient from "@/components/map/MapExplorerClient";
import SocietyMapGrid from "@/components/society-map/SocietyMapGrid";
import { getMapPlaces, getSocietyMaps } from "@/lib/society-map";
import { CITIES } from "./cities-data";
import { serverApi } from "@/lib/server-api";

/*
 * The property map of Pakistan: every live listing, pinned — then the cities
 * (each opens its own map with the city selected) and the society master
 * plans.
 */
export default async function EmapPage() {
  const places = CITIES.map(({ slug, name, lat, lng, zoom }) => ({ slug, name, lat, lng, zoom }));
  const [maps, cityRows, page] = await Promise.all([
    getSocietyMaps(),
    getMapPlaces(),
    // The admin's text for this page: Dashboard → Static Pages, slug "emap".
    serverApi.getPageBySlug("emap").catch(() => null) as Promise<{ title?: string; content?: string } | null>,
  ]);

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
        <h1 className="text-[24px] font-bold tracking-tight text-slate-900 sm:text-[30px]">{page?.title || "Housing Society Maps in Pakistan"}</h1>
        {page?.content && (
          <div className="prose prose-slate mt-2 max-w-3xl text-[15px] leading-relaxed prose-a:text-primary" dangerouslySetInnerHTML={{ __html: page.content }} />
        )}

        <h2 className="mt-6 text-[18px] font-bold text-slate-900 sm:text-[20px]">Cities</h2>
        <ul className="mt-3 grid overflow-hidden rounded-lg border border-slate-300 bg-white sm:grid-cols-2 lg:grid-cols-3">
          {cities.map((c) => (
            <li key={c.slug} className="border-b border-slate-200 sm:border-r">
              <Link href={`/emap/${c.slug}`} className="group flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold text-slate-900 group-hover:underline">{c.name} Map</span>
                  <span className="block truncate text-[13px] text-slate-600">
                    {[c.maps ? `${c.maps} society maps` : "", c.listings ? `${c.listings.toLocaleString("en-PK")} listings` : ""].filter(Boolean).join(" · ") || "Societies on the map"}
                  </span>
                </span>
                <span aria-hidden className="text-[20px] leading-none text-slate-400 group-hover:text-slate-900">›</span>
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

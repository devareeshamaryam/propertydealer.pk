import Link from "next/link";
import MapExplorerClient from "@/components/map/MapExplorerClient";
import SocietyMapGrid from "@/components/society-map/SocietyMapGrid";
import { getMapPlaces, getSocietyMaps } from "@/lib/society-map";
import { CITIES } from "../cities-data";

/*
 * /emap/<city>: the map opened on that city with the city selected — its
 * societies listed beside the map — and below it every society map of the
 * city, then the other societies, linked to their property pages.
 */
export default async function EmapClient({
  focusedSlug,
  city,
}: {
  focusedSlug: string;
  city: { name: string; lat: number; lng: number; zoom: number };
}) {
  const places = CITIES.map(({ slug, name, lat, lng, zoom }) => ({ slug, name, lat, lng, zoom }));
  const [maps, all] = await Promise.all([getSocietyMaps(focusedSlug), getMapPlaces(focusedSlug)]);
  const focus = { lat: city.lat, lng: city.lng, zoom: city.zoom };
  const name = city.name;

  const pictured = maps.filter((m) => m.kind === "plan" || m.kind === "document");
  const outlines = maps.filter((m) => m.kind !== "plan" && m.kind !== "document");
  const withMap = new Set(maps.map((m) => m.slug));
  const others = all.filter((p) => !withMap.has(p.slug) && p.listings > 0).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <MapExplorerClient places={places} focus={focus} city={{ slug: focusedSlug, name }} mode="page" />
      <section className="container mx-auto max-w-6xl pb-28 pt-5 lg:pb-12">
        <h1 className="text-[24px] font-bold tracking-tight text-slate-900 sm:text-[30px]">{name} Map — Housing Societies &amp; Plots</h1>
        <p className="mt-1 max-w-3xl text-[15px] text-slate-600">
          {maps.length
            ? `${maps.length} ${maps.length === 1 ? "society" : "societies"} of ${name} on the map${pictured.length ? `, ${pictured.length} with an official master or layout plan` : ""} — with their blocks, landmarks, approval status and the properties for sale and rent in each.`
            : `Every society of ${name} on the map, with the properties for sale and rent in each. Tap a society to open it.`}
        </p>

        {pictured.length > 0 && (
          <div className="mt-5">
            <h2 className="mb-3 text-[18px] font-bold text-slate-900 sm:text-[20px]">Master plans &amp; approved layout plans</h2>
            <SocietyMapGrid items={pictured} />
          </div>
        )}

        {outlines.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-1 text-[18px] font-bold text-slate-900 sm:text-[20px]">More society maps in {name}</h2>
            <p className="mb-2 text-[13.5px] text-slate-500">Outline, blocks and landmarks of each society on the satellite map.</p>
            <SocietyMapGrid items={outlines} list />
          </div>
        )}

        {others.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-2 text-[18px] font-bold text-slate-900 sm:text-[20px]">Other areas with listings in {name}</h2>
            <ul className="flex flex-wrap gap-2">
              {others.slice(0, 200).map((p) => (
                <li key={p.slug}>
                  <Link
                    href={`/properties/sale/${focusedSlug}/${p.slug}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-700 hover:border-primary hover:text-primary"
                  >
                    {p.name}
                    <span className="text-[11.5px] text-slate-400">{p.listings}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </>
  );
}

import MapExplorerClient from "@/components/map/MapExplorerClient";
import { CITIES, getCityBySlug } from "../cities-data";

/* /emap/<city>: the property map, opened on that city. */
export default function EmapClient({ focusedSlug }: { focusedSlug: string }) {
  const city = getCityBySlug(focusedSlug);
  const places = CITIES.map(({ slug, name, lat, lng, zoom }) => ({ slug, name, lat, lng, zoom }));
  return <MapExplorerClient places={places} focus={city ? { lat: city.lat, lng: city.lng, zoom: city.zoom } : null} />;
}

import MapExplorerClient from "@/components/map/MapExplorerClient";
import { CITIES } from "./cities-data";

/* The property map: every live listing, pinned. */
export default function EmapPage() {
  const places = CITIES.map(({ slug, name, lat, lng, zoom }) => ({ slug, name, lat, lng, zoom }));
  return <MapExplorerClient places={places} />;
}

 "use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

type Area = { name: string; lat: number; lng: number; boundary?: any };
type City = { slug: string; name: string };

interface Props {
  city: City;
  area: Area;
}

const LANDUSE_COLORS: Record<string, string> = {
  residential:       "#f2dad9",
  commercial:        "#f5d6b0",
  retail:            "#ffc04d",
  industrial:        "#dfcce0",
  construction:      "#c6b39a",
  farmland:          "#eef0d5",
  grass:             "#cdebb0",
  meadow:            "#cdebb0",
  forest:            "#aed1a0",
  park:              "#c8facc",
  garden:            "#c8facc",
  recreation_ground: "#c8facc",
  cemetery:          "#b9d9b9",
  school:            "#f0f0d8",
  university:        "#f0f0d8",
  hospital:          "#f0d8d8",
  place_of_worship:  "#e8e0f0",
  parking:           "#eeeeee",
};

const BUILDING_COLOR = "#d9b8a0";

const ROAD_COLORS: Record<string, string> = {
  motorway:     "#e892a2",
  trunk:        "#f9b29c",
  primary:      "#fcd6a4",
  secondary:    "#f7fabf",
  tertiary:     "#ffffff",
  residential:  "#ffffff",
  service:      "#ffffff",
  unclassified: "#ffffff",
  footway:      "#f5c7c7",
  path:         "#f5c7c7",
};

function buildOverpassQuery(lat: number, lng: number, radius = 1200): string {
  return `[out:json][timeout:30];(way["landuse"](around:${radius},${lat},${lng});way["leisure"](around:${radius},${lat},${lng});way["amenity"](around:${radius},${lat},${lng});way["building"](around:${radius},${lat},${lng});way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|service|unclassified|footway|path)$"](around:${radius},${lat},${lng}););out geom qt;`;
}

function getFeatureStyle(tags: Record<string, string>) {
  if (tags.building) {
    return { color: "#c0997a", weight: 0.5, fillColor: BUILDING_COLOR, fillOpacity: 0.85 };
  }
  if (tags.highway) {
    const roadColor = ROAD_COLORS[tags.highway] || "#ffffff";
    const weight = ["motorway", "trunk", "primary"].includes(tags.highway) ? 4
                 : ["secondary", "tertiary"].includes(tags.highway) ? 2.5 : 1.5;
    return { color: roadColor, weight, fillOpacity: 0, opacity: 1 };
  }
  const luKey = tags.landuse || tags.leisure || tags.amenity || "";
  const fillColor = LANDUSE_COLORS[luKey] || "#f0ede8";
  return { color: "#bbb", weight: 0.6, fillColor, fillOpacity: 0.75 };
}

export default function AreaMapClient({ city, area }: Props) {
  const mapRef  = useRef<HTMLDivElement>(null);
  const mapInst = useRef<any>(null);
  const router  = useRouter();

  useEffect(() => {
    if (!mapRef.current) return;

    if (mapInst.current) {
      mapInst.current.remove();
      mapInst.current = null;
    }

    const container = mapRef.current as any;
    if (container._leaflet_id != null) {
      container._leaflet_id = null;
    }

    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    let destroyed = false;

    import("leaflet").then(async (L) => {
      if (destroyed) return;
      if (!mapRef.current) return;

      const el = mapRef.current as any;
      if (el._leaflet_id != null) el._leaflet_id = null;

      delete (L.Icon.Default.prototype as any)._getIconUrl;

      const map = L.map(mapRef.current, {
        center: [area.lat, area.lng],
        zoom: 16,
        zoomControl: true,
        attributionControl: true,
      });

      mapInst.current = map;

      const baseTile = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        {
          attribution: '&copy; <a href="https://carto.com">CARTO</a> &copy; <a href="https://openstreetmap.org">OSM</a>',
          maxZoom: 21,
          subdomains: "abcd",
        }
      );

      const satelliteTile = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { attribution: '&copy; <a href="https://www.esri.com">Esri</a>', maxZoom: 21 }
      );

      // Default: Satellite
      satelliteTile.addTo(map);

      // Loading spinner
      const loadingDiv = document.createElement("div");
      loadingDiv.id = "map-loader";
      loadingDiv.style.cssText = `
        position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
        z-index:9999;pointer-events:none;
      `;
      loadingDiv.innerHTML = `
        <div style="
          width:42px;height:42px;
          border:4px solid rgba(255,255,255,0.3);
          border-top:4px solid #fff;
          border-radius:50%;
          animation:spin 0.8s linear infinite;
          box-shadow:0 2px 12px rgba(0,0,0,0.4);
        "></div>
        <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
      `;
      mapRef.current.appendChild(loadingDiv);

      // Overpass API fetch
      try {
        const query = buildOverpassQuery(area.lat, area.lng, 1200);
        const res = await fetch("https://overpass-api.de/api/interpreter", {
          method: "POST",
          body: "data=" + encodeURIComponent(query),
        });

        if (destroyed) return;

        const data = await res.json();

        const osmLayer = L.geoJSON(null, {
          style: (feature: any) => getFeatureStyle(feature?.properties?.tags || {}),
          onEachFeature: (feature: any, layer: any) => {
            const name = feature?.properties?.tags?.name || "";
            if (name) layer.bindTooltip(name, { sticky: true, opacity: 0.85 });
          },
        });

        data.elements?.forEach((el: any) => {
          if (el.type !== "way" || !el.geometry) return;
          const coords = el.geometry.map((p: any) => [p.lon, p.lat]);
          if (coords.length < 2) return;

          const tags = el.tags || {};
          const isPolygon =
            !tags.highway &&
            coords[0][0] === coords[coords.length - 1][0] &&
            coords[0][1] === coords[coords.length - 1][1];

          osmLayer.addData({
            type: "Feature",
            properties: { tags },
            geometry: {
              type: isPolygon ? "Polygon" : "LineString",
              coordinates: isPolygon ? [coords] : coords,
            },
          } as any);
        });

        if (!destroyed) {
          osmLayer.addTo(map);
          loadingDiv.remove();
        }
      } catch {
        if (!destroyed) loadingDiv.remove();
      }

      // Society marker
      const icon = L.divIcon({
        className: "",
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;pointer-events:none">
            <div style="
              background:#111;color:#fff;border-radius:8px;
              padding:5px 12px;font-size:13px;font-weight:700;
              box-shadow:0 3px 12px rgba(0,0,0,0.35);white-space:nowrap;
              font-family:'Segoe UI',system-ui,sans-serif;position:relative;
            ">
              ${area.name}
              <div style="
                position:absolute;bottom:-7px;left:50%;transform:translateX(-50%);
                width:0;height:0;
                border-left:7px solid transparent;border-right:7px solid transparent;
                border-top:8px solid #111;
              "></div>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 44 54"
              style="margin-top:0px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4))">
              <ellipse cx="22" cy="50" rx="8" ry="3" fill="rgba(0,0,0,0.2)"/>
              <path d="M22 2C13.163 2 6 9.163 6 18c0 11 16 32 16 32S38 29 38 18C38 9.163 30.837 2 22 2z"
                fill="#111" stroke="#fff" stroke-width="2.5"/>
              <circle cx="22" cy="18" r="7" fill="#fff"/>
              <circle cx="22" cy="18" r="4" fill="#111"/>
            </svg>
          </div>`,
        iconSize: [160, 80],
        iconAnchor: [80, 80],
      });
      L.marker([area.lat, area.lng], { icon }).addTo(map);

      // ✅ Toggle button — L.Control.extend use karo (TypeScript fix)
      const ToggleControl = L.Control.extend({
        onAdd() {
          const div = document.createElement("div");
          div.innerHTML = `
            <div style="
              background:#fff;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.2);
              overflow:hidden;display:flex;font-family:'Segoe UI',sans-serif;
              font-size:12px;font-weight:600;
            ">
              <button id="btn-map" style="padding:7px 14px;background:#fff;color:#333;border:none;cursor:pointer;">🗺 Map</button>
              <button id="btn-sat" style="padding:7px 14px;background:#111;color:#fff;border:none;cursor:pointer;">🛰 Satellite</button>
            </div>`;
          div.style.cursor = "default";

          const btnMap = div.querySelector("#btn-map") as HTMLElement;
          const btnSat = div.querySelector("#btn-sat") as HTMLElement;

          btnMap.addEventListener("click", () => {
            map.removeLayer(satelliteTile);
            if (!map.hasLayer(baseTile)) baseTile.addTo(map);
            btnMap.style.cssText = "padding:7px 14px;background:#111;color:#fff;border:none;cursor:pointer;";
            btnSat.style.cssText = "padding:7px 14px;background:#fff;color:#333;border:none;cursor:pointer;";
          });

          btnSat.addEventListener("click", () => {
            map.removeLayer(baseTile);
            if (!map.hasLayer(satelliteTile)) satelliteTile.addTo(map);
            btnSat.style.cssText = "padding:7px 14px;background:#111;color:#fff;border:none;cursor:pointer;";
            btnMap.style.cssText = "padding:7px 14px;background:#fff;color:#333;border:none;cursor:pointer;";
          });

          return div;
        },
      });

      new ToggleControl({ position: "topright" }).addTo(map);
    });

    return () => {
      destroyed = true;
      if (mapInst.current) {
        mapInst.current.remove();
        mapInst.current = null;
      }
    };
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <button
        onClick={() => router.push(`/emap/${city.slug}`)}
        style={{
          position: "absolute", top: "12px", left: "60px", zIndex: 1000,
          background: "#111", color: "#fff", border: "none", borderRadius: "8px",
          padding: "7px 14px", fontSize: "12px", fontWeight: 700, cursor: "pointer",
          boxShadow: "0 2px 8px rgba(0,0,0,0.25)", fontFamily: "'Segoe UI', sans-serif",
          display: "flex", alignItems: "center", gap: "5px",
        }}
      >
        ← {city.name} Map
      </button>
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
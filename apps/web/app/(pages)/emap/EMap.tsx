 "use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type Area = { name: string; lat: number; lng: number };
type City = {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  zoom: number;
  areas: Area[];
};

interface EMapProps {
  cities: City[];
  focusedSlug: string | null;
}

// ── Helper: area name → URL slug ────────────────────────────────────
function toSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")   // remove special chars
    .trim()
    .replace(/\s+/g, "-");           // spaces → hyphens
}

// ── Black pin SVG (exactly like the image) ──────────────────────────
const PIN_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="44" height="54" viewBox="0 0 44 54">
  <!-- Shadow ellipse -->
  <ellipse cx="22" cy="50" rx="9" ry="4" fill="#00000033"/>
  <!-- Pin body -->
  <path d="M22 2C13.163 2 6 9.163 6 18c0 11 16 32 16 32S38 29 38 18C38 9.163 30.837 2 22 2z"
    fill="#111" stroke="#fff" stroke-width="2"/>
  <!-- White circle inside -->
  <circle cx="22" cy="18" r="7" fill="#fff"/>
</svg>`;

// ── Speech bubble label ─────────────────────────────────────────────
function bubbleIcon(L: any, name: string, active: boolean) {
  const bg = active ? "#111" : "#fff";
  const color = active ? "#fff" : "#222";
  const border = active ? "#111" : "#ccc";
  const shadow = active ? "0 2px 8px #0005" : "0 1px 4px #0002";

  const html = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:0">
      <!-- Bubble -->
      <div style="
        background:${bg};color:${color};
        border:1.5px solid ${border};
        border-radius:10px;
        padding:5px 13px;
        font-size:13px;font-weight:700;
        box-shadow:${shadow};
        white-space:nowrap;
        font-family:'Segoe UI',sans-serif;
        position:relative;
      ">
        ${name}
        <!-- Bubble tail -->
        <div style="
          position:absolute;bottom:-8px;left:50%;transform:translateX(-50%);
          width:0;height:0;
          border-left:8px solid transparent;
          border-right:8px solid transparent;
          border-top:9px solid ${active ? "#111" : border};
        "></div>
      </div>
      <!-- Pin -->
      <div style="margin-top:1px">${PIN_SVG}</div>
    </div>`;

  return L.divIcon({
    className: "",
    html,
    iconSize: [120, 90],
    iconAnchor: [60, 90],
    popupAnchor: [0, -92],
  });
}

// ── Area marker: smaller bubble + smaller pin ───────────────────────
function areaBubbleIcon(L: any, name: string) {
  const html = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:0">
      <div style="
        background:#fff;color:#111;
        border:1.5px solid #bbb;
        border-radius:8px;
        padding:3px 10px;
        font-size:11px;font-weight:600;
        box-shadow:0 1px 5px #0003;
        white-space:nowrap;
        font-family:'Segoe UI',sans-serif;
        position:relative;
        cursor:pointer;
      ">
        ${name}
        <div style="
          position:absolute;bottom:-7px;left:50%;transform:translateX(-50%);
          width:0;height:0;
          border-left:6px solid transparent;
          border-right:6px solid transparent;
          border-top:7px solid #bbb;
        "></div>
      </div>
      <!-- Smaller pin -->
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="34" viewBox="0 0 44 54" style="margin-top:1px">
        <ellipse cx="22" cy="50" rx="9" ry="4" fill="#00000022"/>
        <path d="M22 2C13.163 2 6 9.163 6 18c0 11 16 32 16 32S38 29 38 18C38 9.163 30.837 2 22 2z"
          fill="#111" stroke="#fff" stroke-width="2"/>
        <circle cx="22" cy="18" r="7" fill="#fff"/>
      </svg>
    </div>`;

  return L.divIcon({
    className: "",
    html,
    iconSize: [100, 70],
    iconAnchor: [50, 70],
    popupAnchor: [0, -72],
  });
}

export default function EMap({ cities, focusedSlug }: EMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const router = useRouter();

  useEffect(() => {
    if (!mapRef.current) return;

    if (leafletMapRef.current) {
      leafletMapRef.current.remove();
      leafletMapRef.current = null;
    }

    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    import("leaflet").then((L) => {
      if ((mapRef.current as any)._leaflet_id) {
        (mapRef.current as any)._leaflet_id = null;
      }

      delete (L.Icon.Default.prototype as any)._getIconUrl;

      const focusedCity = focusedSlug
        ? cities.find((c) => c.slug === focusedSlug)
        : null;

      const center: [number, number] = focusedCity
        ? [focusedCity.lat, focusedCity.lng]
        : [30.3753, 69.3451];
      const zoom = focusedCity ? focusedCity.zoom : 6;

      const map = L.map(mapRef.current!, {
        center,
        zoom,
        zoomControl: true,
      });

      // Light/minimal tile style
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        {
          attribution: '&copy; <a href="https://carto.com">CARTO</a>',
          maxZoom: 19,
        }
      ).addTo(map);

      leafletMapRef.current = map;

      // ── City markers ──────────────────────────────────────────────
      cities.forEach((city) => {
        const isFocused = city.slug === focusedSlug;
        const icon = bubbleIcon(L, city.name, isFocused);

        const marker = L.marker([city.lat, city.lng], { icon }).addTo(map);

        marker.on("click", () => {
          router.push(`/emap/${city.slug}`);
        });

        // ── Area markers for focused city ────────────────────────
        if (isFocused) {
          city.areas.forEach((area) => {
            const am = L.marker([area.lat, area.lng], {
              icon: areaBubbleIcon(L, area.name),
            }).addTo(map);

            // ✅ CHANGE: Direct navigation to area map page (no popup)
            am.on("click", () => {
              router.push(`/emap/${city.slug}/${toSlug(area.name)}`);
            });
          });
        }
      });
    });

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {focusedSlug && (
        <button
          onClick={() => router.push("/emap")}
          style={{
            position: "absolute",
            top: "12px",
            left: "60px",
            zIndex: 1000,
            background: "#111",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            padding: "7px 14px",
            fontSize: "12px",
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 2px 8px #0004",
            fontFamily: "'Segoe UI', sans-serif",
          }}
        >
          ← Pakistan Map
        </button>
      )}
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

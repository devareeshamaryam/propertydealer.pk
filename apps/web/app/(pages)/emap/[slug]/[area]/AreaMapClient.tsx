 "use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

type Area = { name: string; lat: number; lng: number };
type City = { slug: string; name: string };

interface Props {
  city: City;
  area: Area;
}

export default function AreaMapClient({ city, area }: Props) {
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

      const map = L.map(mapRef.current!, {
        center: [area.lat, area.lng],
        zoom: 16,
        zoomControl: true,
      });

      // Detailed tile layer - shows buildings, roads with color
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        {
          attribution: '&copy; <a href="https://carto.com">CARTO</a>',
          maxZoom: 20,
        }
      ).addTo(map);

      // Shaded circle to highlight area boundary
      L.circle([area.lat, area.lng], {
        radius: 600,
        color: "#111",
        weight: 2,
        opacity: 0.7,
        fillColor: "#3b82f6",
        fillOpacity: 0.12,
        dashArray: "6 4",
      }).addTo(map);

      // Area label pin
      const icon = L.divIcon({
        className: "",
        html: `
          <div style="display:flex;flex-direction:column;align-items:center">
            <div style="
              background:#111;color:#fff;
              border-radius:10px;
              padding:6px 14px;
              font-size:13px;font-weight:700;
              box-shadow:0 2px 10px #0006;
              white-space:nowrap;
              font-family:'Segoe UI',sans-serif;
              position:relative;
            ">
              ${area.name}
              <div style="
                position:absolute;bottom:-8px;left:50%;transform:translateX(-50%);
                width:0;height:0;
                border-left:8px solid transparent;
                border-right:8px solid transparent;
                border-top:9px solid #111;
              "></div>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 44 54" style="margin-top:1px">
              <ellipse cx="22" cy="50" rx="9" ry="4" fill="#00000033"/>
              <path d="M22 2C13.163 2 6 9.163 6 18c0 11 16 32 16 32S38 29 38 18C38 9.163 30.837 2 22 2z"
                fill="#111" stroke="#fff" stroke-width="2"/>
              <circle cx="22" cy="18" r="7" fill="#fff"/>
            </svg>
          </div>`,
        iconSize: [140, 80],
        iconAnchor: [70, 80],
      });

      L.marker([area.lat, area.lng], { icon }).addTo(map);

      leafletMapRef.current = map;
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
      <button
        onClick={() => router.push(`/emap/${city.slug}`)}
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
        ← {city.name} Map
      </button>

      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
} 
 "use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/contexts/CartContext";

export interface CementBrand {
    id: number | string;
    brand: string;
    slug: string;
    title: string;
    price: number;
    change: number;
    weightKg: number;
    image?: string;
    category: string;
}

interface CementCardProps {
    item: CementBrand;
    viewMode?: "grid" | "list";
}

function getImageUrl(image?: string): string | undefined {
    if (!image) return undefined;
    if (image.startsWith("http://") || image.startsWith("https://")) return image;
    return image.startsWith("/") ? image : `/${image}`;
}

function getColorIdx(id: number | string): number {
    const sum = String(id)
        .split("")
        .reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return sum % BAG_COLORS.length;
}

const BAG_COLORS = [
    { bg: "#1a6fc4", dark: "#145599" },
    { bg: "#2e7d32", dark: "#1b5e20" },
    { bg: "#b71c1c", dark: "#7f0000" },
    { bg: "#e65100", dark: "#bf360c" },
    { bg: "#4a148c", dark: "#311b92" },
    { bg: "#006064", dark: "#004d40" },
    { bg: "#37474f", dark: "#263238" },
    { bg: "#558b2f", dark: "#33691e" },
    { bg: "#ad1457", dark: "#880e4f" },
    { bg: "#0277bd", dark: "#01579b" },
];

function CementBagSVG({ brand, weightKg, colorIdx }: { brand: string; weightKg: number; colorIdx: number }) {
    const c = BAG_COLORS[colorIdx % BAG_COLORS.length] ?? BAG_COLORS[0]!;
    const shortName = brand.replace(" Cement", "").toUpperCase();
    const fontSize = shortName.length > 8 ? 10 : shortName.length > 5 ? 12 : 15;
    return (
        <svg viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
            <rect x="20" y="30" width="120" height="150" rx="8" fill={c.bg} />
            <rect x="20" y="30" width="120" height="28" rx="6" fill={c.dark} />
            <line x1="30" y1="44" x2="130" y2="44" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeDasharray="6 4" />
            <rect x="20" y="152" width="120" height="28" rx="6" fill={c.dark} />
            <line x1="30" y1="166" x2="130" y2="166" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeDasharray="6 4" />
            <line x1="28" y1="60" x2="28" y2="150" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
            <line x1="132" y1="60" x2="132" y2="150" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
            <rect x="30" y="70" width="100" height="72" rx="5" fill="rgba(255,255,255,0.92)" />
            <text x="80" y="100" textAnchor="middle" fontSize={fontSize} fontWeight="800" fill={c.bg} fontFamily="Arial,sans-serif" letterSpacing="1">{shortName}</text>
            <text x="80" y="116" textAnchor="middle" fontSize="9" fontWeight="600" fill={c.dark} fontFamily="Arial,sans-serif" letterSpacing="2">CEMENT</text>
            <line x1="42" y1="122" x2="118" y2="122" stroke={c.bg} strokeWidth="1" opacity="0.3" />
            <text x="80" y="134" textAnchor="middle" fontSize="10" fontWeight="700" fill={c.bg} fontFamily="Arial,sans-serif">{weightKg} KG</text>
        </svg>
    );
}

function CementImage({ item, svgWidth = "140px", svgHeight = "170px" }: { item: CementBrand; svgWidth?: string; svgHeight?: string }) {
    const [imgError, setImgError] = useState(false);
    const src = getImageUrl(item.image);
    if (src && !imgError) {
        return (
            <img
                src={src}
                alt={item.title}
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
                onError={() => setImgError(true)}
            />
        );
    }
    return (
        <div style={{ width: svgWidth, height: svgHeight }}>
            <CementBagSVG brand={item.brand} weightKg={item.weightKg} colorIdx={getColorIdx(item.id)} />
        </div>
    );
}

function BuyNowButton({ item }: { item: CementBrand }) {
    const message = encodeURIComponent(
        `Hi, I'm interested in ${item.title} (${item.weightKg}kg) - Rs ${item.price.toLocaleString()}`
    );
    const waLink = `https://wa.me/923052736792?text=${message}`;

    return (
        <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="cc-btn-buy"
            style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                color: "#22c55e",
                border: "1px solid #22c55e",
                borderRadius: "5px",
                fontWeight: 600,
                textDecoration: "none",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "background 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.background = "#f0fdf4";
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
            }}
        >
            Buy Now
        </a>
    );
}

export default function CementCard({ item, viewMode = "grid" }: CementCardProps) {

    /* ── LIST VIEW ─────────────────────────────────────────────────── */
    if (viewMode === "list") {
        return (
            <div
                style={{ display: "flex", alignItems: "center", gap: "16px", background: "#fff", border: "1px solid #e5e7eb", padding: "14px", borderRadius: "10px", transition: "box-shadow 0.2s" }}
                onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)")}
                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
            >
                <Link href={`/today-cement-rate-in-pakistan/${item.slug}`} style={{ width: "64px", height: "80px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <CementImage item={item} svgWidth="64px" svgHeight="80px" />
                </Link>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "11px", color: "#9ca3af", marginBottom: "4px" }}>{item.category}</p>
                    <Link href={`/today-cement-rate-in-pakistan/${item.slug}`} style={{ fontSize: "14px", fontWeight: 500, color: "#1a6fc4", textDecoration: "none", display: "block", lineHeight: "1.4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.title}
                    </Link>
                    <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>{item.weightKg} Kg</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
                    <span style={{ fontSize: "17px", fontWeight: 600, color: "#1f2937" }}>Rs {item.price.toLocaleString()}</span>
                    <BuyNowButton item={item} />
                </div>
            </div>
        );
    }

    /* ── GRID VIEW ─────────────────────────────────────────────────── */
    return (
        <div
            className="cement-card"
            style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "10px", overflow: "hidden", transition: "box-shadow 0.2s" }}
            onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)")}
            onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
        >
            <style>{`
        .cement-card .cc-top      { padding: 8px 8px 6px; min-height: 48px; }
        .cement-card .cc-cat      { font-size: 10px; color: #9ca3af; margin-bottom: 3px; line-height: 1; }
        .cement-card .cc-title    { font-size: 12px; font-weight: 400; color: #1a6fc4; text-decoration: none; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .cement-card .cc-img      { display: flex; align-items: center; justify-content: center; background: #fff; padding: 6px 16px; height: 130px; }
        .cement-card .cc-bot      { display: flex; align-items: center; justify-content: space-between; padding: 7px 8px; border-top: 1px solid #f3f4f6; }
        .cement-card .cc-price    { font-size: 14px; font-weight: 600; color: #1f2937; }
        .cement-card .cc-btn-buy  { padding: 4px 8px; font-size: 10px; font-weight: 600; border-radius: 5px; }

        @media (max-width: 639px) {
          .cement-card .cc-top      { padding: 5px 5px 3px; min-height: 36px; }
          .cement-card .cc-cat      { font-size: 8px; margin-bottom: 2px; }
          .cement-card .cc-title    { font-size: 9px; }
          .cement-card .cc-img      { padding: 3px 6px; height: 85px; }
          .cement-card .cc-bot      { padding: 4px 5px; }
          .cement-card .cc-price    { font-size: 11px; }
          .cement-card .cc-btn-buy  { padding: 3px 6px; font-size: 8px; }
        }
      `}</style>

            {/* 1. Category + Title */}
            <div className="cc-top">
                <p className="cc-cat">{item.category}</p>
                <Link href={`/today-cement-rate-in-pakistan/${item.slug}`} className="cc-title">
                    {item.title}
                </Link>
            </div>

            {/* 2. Image */}
            <Link href={`/today-cement-rate-in-pakistan/${item.slug}`} className="cc-img">
                <CementImage item={item} svgWidth="140px" svgHeight="170px" />
            </Link>

            {/* 3. Price + Buy Now */}
            <div className="cc-bot">
                <span className="cc-price">Rs {item.price.toLocaleString()}</span>
                <BuyNowButton item={item} />
            </div>
        </div>
    );
}
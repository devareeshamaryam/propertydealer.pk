const fs = require('fs');
const path = require('path');

const materials = [
  { name: 'Door', slug: 'today-door-rate-in-pakistan', title: 'Today Door Rate in Pakistan' },
  { name: 'Wood', slug: 'today-wood-rate-in-pakistan', title: 'Today Wood Rate in Pakistan' },
  { name: 'Sand', slug: 'today-sand-rate-in-pakistan', title: 'Today Sand Rate in Pakistan' },
  { name: 'Tile', slug: 'today-tile-rate-in-pakistan', title: 'Today Tile Rate in Pakistan' },
  { name: 'Bajri', slug: 'today-bajri-rate-in-pakistan', title: 'Today Bajri Rate in Pakistan' },
  { name: 'Steel', slug: 'today-steel-rate-in-pakistan', title: 'Today Steel Rate in Pakistan' },
  { name: 'Bricks', slug: 'today-bricks-rate-in-pakistan', title: 'Today Bricks Rate in Pakistan' },
];

const webAppDir = path.join(__dirname, '../apps/web/app/(pages)');

materials.forEach(material => {
  const pageDir = path.join(webAppDir, material.slug);
  
  // Create directory
  if (!fs.existsSync(pageDir)) {
    fs.mkdirSync(pageDir, { recursive: true });
  }

  // Create page.tsx
  const pageTsx = `import { Metadata } from "next";
import MaterialPageClient from "./MaterialPageClient";

export const metadata: Metadata = {
  title: "${material.title} | Property Dealer",
  description: "Get latest ${material.name.toLowerCase()} rates in Pakistan. Compare prices from top brands and suppliers.",
};

async function getMaterialRates() {
  try {
    const apiUrl = process.env.INTERNAL_API_URL || "http://localhost:3010";
    const res = await fetch(\`\${apiUrl}/api/material-rate?materialType=${material.name}\`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    return res.json();
  } catch (error) {
    console.error("Error fetching ${material.name.toLowerCase()} rates:", error);
    return [];
  }
}

export default async function ${material.name}RatePage() {
  const rates = await getMaterialRates();
  
  return (
    <MaterialPageClient
      initialRates={rates}
      materialType="${material.name}"
      pageTitle="${material.title}"
    />
  );
}
`;

  // Create MaterialPageClient.tsx
  const clientTsx = `"use client";

import { useState, useMemo } from "react";
import MaterialCard, { MaterialRate } from "@/components/MaterialRate/MaterialCard";

function normaliseRates(raw: any[]): MaterialRate[] {
  return raw.map((r, i) => ({
    id:           r._id ?? i + 1,
    brand:        r.brand,
    slug:         r.slug ?? r.brand.toLowerCase().replace(/\\s+/g, "-"),
    price:        r.price,
    change:       r.change ?? 0,
    city:         r.city ?? "",
    unit:         r.unit ?? "Per Unit",
    category:     r.category ?? "Standard",
    image:        r.image,
    materialType: r.materialType,
  }));
}

interface MaterialPageClientProps {
  initialRates: any[];
  materialType: string;
  pageTitle: string;
}

export default function MaterialPageClient({
  initialRates,
  materialType,
  pageTitle,
}: MaterialPageClientProps) {
  const ALL_RATES: MaterialRate[] = initialRates.length > 0 ? normaliseRates(initialRates) : [];

  const BRANDS = ["All Brands", ...Array.from(new Set(ALL_RATES.map((b) => b.brand)))];
  const CATEGORIES = ["All Types", ...Array.from(new Set(ALL_RATES.map((b) => b.category)))];
  const MIN_PRICE = ALL_RATES.length > 0 ? Math.min(...ALL_RATES.map((b) => b.price)) : 0;
  const MAX_PRICE = ALL_RATES.length > 0 ? Math.max(...ALL_RATES.map((b) => b.price)) : 10000;

  const [priceRange, setPriceRange] = useState<[number, number]>([MIN_PRICE, MAX_PRICE]);
  const [selectedBrand, setSelectedBrand] = useState("All Brands");
  const [selectedCat, setSelectedCat] = useState("All Types");
  const [sortBy, setSortBy] = useState<"latest" | "price-asc" | "price-desc" | "name">("latest");

  const results = useMemo(() => {
    return ALL_RATES
      .filter((b) => b.price >= priceRange[0] && b.price <= priceRange[1])
      .filter((b) => selectedBrand === "All Brands" || b.brand === selectedBrand)
      .filter((b) => selectedCat === "All Types" || b.category === selectedCat)
      .sort((a, b) => {
        if (sortBy === "price-asc") return a.price - b.price;
        if (sortBy === "price-desc") return b.price - a.price;
        if (sortBy === "name") return a.brand.localeCompare(b.brand);
        return 0;
      });
  }, [ALL_RATES, priceRange, selectedBrand, selectedCat, sortBy]);

  const resetFilters = () => {
    setPriceRange([MIN_PRICE, MAX_PRICE]);
    setSelectedBrand("All Brands");
    setSelectedCat("All Types");
  };

  return (
    <div className="pt-24 bg-gray-50 min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-6">{pageTitle}</h1>
        
        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Brand</label>
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="w-full border rounded-md px-3 py-2"
              >
                {BRANDS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Category</label>
              <select
                value={selectedCat}
                onChange={(e) => setSelectedCat(e.target.value)}
                className="w-full border rounded-md px-3 py-2"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="latest">Latest</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="name">Name</option>
              </select>
            </div>
            
            <div className="flex items-end">
              <button
                onClick={resetFilters}
                className="w-full bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-md"
              >
                Reset Filters
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="mb-4">
          <p className="text-gray-600">Showing {results.length} results</p>
        </div>

        {results.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No rates available yet. Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {results.map((item) => (
              <MaterialCard key={item.id} rate={item} viewMode="grid" materialType={materialType} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
`;

  fs.writeFileSync(path.join(pageDir, 'page.tsx'), pageTsx);
  fs.writeFileSync(path.join(pageDir, 'MaterialPageClient.tsx'), clientTsx);
  
  console.log(`✅ Created ${material.slug}`);
});

console.log('\\n🎉 All 7 material rate pages created successfully!');

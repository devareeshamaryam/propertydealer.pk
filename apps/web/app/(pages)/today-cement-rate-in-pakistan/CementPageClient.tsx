"use client";

import { useState, useMemo } from "react";
import CementCard, { CementBrand } from "@/components/Cementcard";
import dynamic from "next/dynamic";

const CartDrawer = dynamic(() => import("@/components/CartDrawer"), { ssr: false });

// ── Fallback static data (used when DB is empty) ──────────────────────────────
const STATIC_BRANDS: CementBrand[] = [
  { id: 1,  brand: "Lucky Cement",      slug: "lucky-cement",      title: "Lucky Cement — 50 Kg Bag",      price: 1300, change: +20, city: "Lahore",     weightKg: 50, category: "OPC Cement" },
  { id: 2,  brand: "Bestway Cement",    slug: "bestway-cement",    title: "Bestway Cement — 50 Kg Bag",    price: 1280, change:   0, city: "Karachi",    weightKg: 50, category: "OPC Cement" },
  { id: 3,  brand: "Maple Leaf Cement", slug: "maple-leaf-cement", title: "Maple Leaf Cement — 50 Kg Bag", price: 1260, change: -10, city: "Islamabad",  weightKg: 50, category: "OPC Cement" },
  { id: 4,  brand: "DG Khan Cement",    slug: "dg-khan-cement",    title: "DG Khan Cement — 50 Kg Bag",    price: 1290, change: +10, city: "Lahore",     weightKg: 50, category: "SRC Cement" },
  { id: 5,  brand: "Fauji Cement",      slug: "fauji-cement",      title: "Fauji Cement — 50 Kg Bag",      price: 1270, change:   0, city: "Rawalpindi", weightKg: 50, category: "OPC Cement" },
  { id: 6,  brand: "Cherat Cement",     slug: "cherat-cement",     title: "Cherat Cement — 50 Kg Bag",     price: 1250, change: -20, city: "Peshawar",   weightKg: 50, category: "OPC Cement" },
  { id: 7,  brand: "Power Cement",      slug: "power-cement",      title: "Power Cement — 50 Kg Bag",      price: 1240, change: +15, city: "Karachi",    weightKg: 50, category: "SRC Cement" },
  { id: 8,  brand: "Askari Cement",     slug: "askari-cement",     title: "Askari Cement — 50 Kg Bag",     price: 1310, change: +30, city: "Lahore",     weightKg: 50, category: "OPC Cement" },
  { id: 9,  brand: "Pioneer Cement",    slug: "pioneer-cement",    title: "Pioneer Cement — 50 Kg Bag",    price: 1230, change:  -5, city: "Multan",     weightKg: 50, category: "SRC Cement" },
  { id: 10, brand: "Gharibwal Cement",  slug: "gharibwal-cement",  title: "Gharibwal Cement — 50 Kg Bag",  price: 1220, change:   0, city: "Lahore",     weightKg: 50, category: "OPC Cement" },
];

// ── Helper: normalise API response → CementBrand ─────────────────────────────
function normaliseBrands(raw: any[]): CementBrand[] {
  return raw.map((r, i) => ({
    id:       r._id ?? i + 1,
    brand:    r.brand,
    slug:     r.slug ?? r.brand.toLowerCase().replace(/\s+/g, "-"),
    title:    r.title ?? `${r.brand} — ${r.weightKg ?? 50} Kg Bag`,
    price:    r.price,
    change:   r.change ?? 0,
    city:     r.city,
    weightKg: r.weightKg ?? 50,
    category: r.category ?? "OPC Cement",
    image:    r.image,
  }));
}

interface CementPageClientProps {
  initialBrands: any[];   // raw API data (may be empty)
  pageContent: string | null;
  pageTitle: string | null;
}

type ViewMode = "grid" | "list";
type SortKey  = "latest" | "price-asc" | "price-desc" | "name";

export default function CementPageClient({
  initialBrands,
  pageContent,
  pageTitle,
}: CementPageClientProps) {
  // Use live DB data if available, fall back to static
  const ALL_BRANDS: CementBrand[] = initialBrands.length > 0
    ? normaliseBrands(initialBrands)
    : STATIC_BRANDS;

  const CITIES     = ["All Cities", ...Array.from(new Set(ALL_BRANDS.map((b) => b.city)))];
  const BRANDS     = ["All Brands", ...Array.from(new Set(ALL_BRANDS.map((b) => b.brand)))];
  const CATEGORIES = ["All Types",  ...Array.from(new Set(ALL_BRANDS.map((b) => b.category)))];
  const MIN_PRICE  = Math.min(...ALL_BRANDS.map((b) => b.price));
  const MAX_PRICE  = Math.max(...ALL_BRANDS.map((b) => b.price));

  const [priceRange, setPriceRange]       = useState<[number, number]>([MIN_PRICE, MAX_PRICE]);
  const [selectedCity, setSelectedCity]   = useState("All Cities");
  const [selectedBrand, setSelectedBrand] = useState("All Brands");
  const [selectedCat, setSelectedCat]     = useState("All Types");
  const [sidebarOpen, setSidebarOpen]     = useState(false);
  const [viewMode, setViewMode]           = useState<ViewMode>("grid");
  const [sortBy, setSortBy]               = useState<SortKey>("latest");
  const [perPage, setPerPage]             = useState(16);

  const results = useMemo(() => {
    return ALL_BRANDS
      .filter((b) => b.price >= priceRange[0] && b.price <= priceRange[1])
      .filter((b) => selectedCity  === "All Cities"  || b.city     === selectedCity)
      .filter((b) => selectedBrand === "All Brands"  || b.brand    === selectedBrand)
      .filter((b) => selectedCat   === "All Types"   || b.category === selectedCat)
      .sort((a, b) => {
        if (sortBy === "price-asc")  return a.price - b.price;
        if (sortBy === "price-desc") return b.price - a.price;
        if (sortBy === "name")       return a.brand.localeCompare(b.brand);
        return 0;
      })
      .slice(0, perPage);
  }, [ALL_BRANDS, priceRange, selectedCity, selectedBrand, selectedCat, sortBy, perPage]);

  const resetFilters = () => {
    setPriceRange([MIN_PRICE, MAX_PRICE]);
    setSelectedCity("All Cities");
    setSelectedBrand("All Brands");
    setSelectedCat("All Types");
  };

  return (
    <div className="pt-[72px] bg-gray-50 min-h-screen">
      <CartDrawer />

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-[99] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="max-w-[1200px] mx-auto px-4 pb-12 pt-5">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-gray-400 mb-5 flex-wrap">
          <a href="/" className="hover:text-black transition-colors">Home</a>
          <span>›</span>
          <span className="text-gray-600">Today Cement Rate in Pakistan</span>
        </nav>

        <div className="flex gap-6 items-start">

          {/* ── LEFT SIDEBAR ──────────────────────────────────────────── */}
          <aside
            className={`
              w-[240px] flex-shrink-0 bg-white border border-gray-200 rounded-xl p-4
              sticky top-[80px] self-start
              max-lg:fixed max-lg:top-0 max-lg:left-0 max-lg:h-screen max-lg:overflow-y-auto
              max-lg:z-[100] max-lg:rounded-none max-lg:w-[260px] max-lg:transition-transform max-lg:duration-300
              ${sidebarOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full"}
            `}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
              <button
                className="lg:hidden text-gray-400 hover:text-black text-lg leading-none"
                onClick={() => setSidebarOpen(false)}
              >✕</button>
            </div>

            {/* Price range */}
            <div className="border-t border-gray-100 pt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3 underline underline-offset-2">
                Filter by price
              </h4>
              <div className="flex flex-col gap-2 mb-2">
                <input type="range" min={MIN_PRICE} max={MAX_PRICE} value={priceRange[0]} step={10}
                  onChange={(e) => setPriceRange([+e.target.value, priceRange[1]])}
                  className="w-full accent-black cursor-pointer" />
                <input type="range" min={MIN_PRICE} max={MAX_PRICE} value={priceRange[1]} step={10}
                  onChange={(e) => setPriceRange([priceRange[0], +e.target.value])}
                  className="w-full accent-black cursor-pointer" />
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Price: Rs {priceRange[0].toLocaleString()} — Rs {priceRange[1].toLocaleString()}
              </p>
              <button onClick={resetFilters}
                className="text-xs px-4 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-black hover:text-white hover:border-black transition-colors">
                Reset
              </button>
            </div>

            <FilterSection title="City">
              {CITIES.map((c) => (
                <RadioOption key={c} name="city" label={c} checked={selectedCity === c} onChange={() => setSelectedCity(c)} />
              ))}
            </FilterSection>

            <FilterSection title="Brands">
              {BRANDS.map((b) => (
                <RadioOption key={b} name="brand" label={b} checked={selectedBrand === b} onChange={() => setSelectedBrand(b)}
                  count={b !== "All Brands" ? ALL_BRANDS.filter((x) => x.brand === b).length : undefined} />
              ))}
            </FilterSection>

            <FilterSection title="Cement Type">
              {CATEGORIES.map((cat) => (
                <RadioOption key={cat} name="category" label={cat} checked={selectedCat === cat} onChange={() => setSelectedCat(cat)} />
              ))}
            </FilterSection>
          </aside>

          {/* ── MAIN CONTENT ──────────────────────────────────────────── */}
          <main className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900 mb-1">
              Today Cement Rate in Pakistan
            </h1>

            {/* Toolbar */}
            <div className="flex items-center justify-between bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 my-3 flex-wrap gap-2">
              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  className="lg:hidden text-xs px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-black hover:text-white hover:border-black transition-colors"
                  onClick={() => setSidebarOpen(true)}>
                  ☰ Filters
                </button>
                <div className="flex gap-1">
                  {(["grid", "list"] as ViewMode[]).map((v) => (
                    <button key={v} onClick={() => setViewMode(v)} title={v}
                      className={`w-8 h-8 rounded-md border flex items-center justify-center transition-colors ${
                        viewMode === v ? "bg-black text-white border-black" : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                      }`}>
                      {v === "grid" ? (
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                          <rect x="1" y="1" width="6" height="6" rx="1" /><rect x="9" y="1" width="6" height="6" rx="1" />
                          <rect x="1" y="9" width="6" height="6" rx="1" /><rect x="9" y="9" width="6" height="6" rx="1" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                          <rect x="1" y="2" width="14" height="3" rx="1" /><rect x="1" y="7" width="14" height="3" rx="1" />
                          <rect x="1" y="12" width="14" height="3" rx="1" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-gray-400">
                  Showing {results.length} of {ALL_BRANDS.length} results
                </span>
              </div>
              <div className="flex items-center gap-2">
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)}
                  className="text-xs px-2.5 py-1.5 rounded-md border border-gray-200 bg-white text-gray-700 cursor-pointer focus:outline-none focus:border-black">
                  <option value="latest">Sort by latest</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="name">Brand: A–Z</option>
                </select>
                <select value={perPage} onChange={(e) => setPerPage(+e.target.value)}
                  className="text-xs px-2.5 py-1.5 rounded-md border border-gray-200 bg-white text-gray-700 cursor-pointer focus:outline-none focus:border-black">
                  <option value={8}>Show 8</option>
                  <option value={16}>Show 16</option>
                  <option value={ALL_BRANDS.length}>Show All</option>
                </select>
              </div>
            </div>

            {/* Cards */}
            {results.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p className="mb-3">No results match your filters.</p>
                <button onClick={resetFilters}
                  className="text-sm px-5 py-2 rounded-lg border border-gray-300 hover:bg-black hover:text-white hover:border-black transition-colors">
                  Reset Filters
                </button>
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {results.map((item) => <CementCard key={item.id} item={item} viewMode="grid" />)}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {results.map((item) => <CementCard key={item.id} item={item} viewMode="list" />)}
              </div>
            )}

            {/* ── CMS Page Description (below cement content) ─────────── */}
            {pageContent && (
              <div className="mt-10 pt-8 border-t border-gray-200">
                {pageTitle && (
                  <h2 className="text-lg font-bold text-gray-900 mb-4">{pageTitle}</h2>
                )}
                <div
                  className="prose prose-sm max-w-none text-gray-600 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: pageContent }}
                />
              </div>
            )}

            {/* Fallback SEO block */}
            {!pageContent && (
              <div className="mt-12 pt-8 border-t border-gray-200">
                <h2 className="text-lg font-bold text-gray-900 mb-3">
                  Today Cement Rate in Pakistan — 2026
                </h2>
                <p className="text-sm text-gray-500 leading-relaxed mb-4">
                  PropertyDealer.pk provides daily updated cement prices across all major brands
                  including Lucky Cement, Bestway Cement, Maple Leaf, DG Khan, Fauji, and more.
                  Prices are updated every morning to reflect the latest market rates from Lahore,
                  Karachi, Islamabad, Rawalpindi, Peshawar, and other cities across Pakistan.
                </p>
                <h3 className="text-sm font-bold text-gray-800 mb-2">Why Do Cement Prices Change?</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Cement prices in Pakistan fluctuate due to coal prices, fuel costs, government
                  taxes (FED), and seasonal demand. The construction season from February to June
                  typically sees higher demand which pushes prices up.
                </p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

// ── Reusable sub-components ────────────────────────────────────────────────────

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-gray-100 pt-4 mt-1">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3 underline underline-offset-2">
        {title}
      </h4>
      {children}
    </div>
  );
}

function RadioOption({ name, label, checked, onChange, count }: {
  name: string; label: string; checked: boolean; onChange: () => void; count?: number;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-gray-600 mb-2 cursor-pointer hover:text-black">
      <input type="radio" name={name} checked={checked} onChange={onChange} className="accent-black" />
      {label}
      {count !== undefined && <span className="text-[10px] text-gray-400">({count})</span>}
    </label>
  );
}

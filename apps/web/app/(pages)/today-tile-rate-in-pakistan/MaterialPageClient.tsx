"use client";

import { useState, useMemo } from "react";
import MaterialCard, { MaterialRate } from "@/components/MaterialRate/MaterialCard";

// ── Helper: normalise API response → MaterialRate ─────────────────────────────
function normaliseRates(raw: any[]): MaterialRate[] {
  return raw.map((r, i) => ({
    id:           r._id ?? i + 1,
    brand:        r.brand,
    slug:         r.slug ?? r.brand.toLowerCase().replace(/\s+/g, "-"),
    price:        r.price,
    change:       r.change ?? 0,
    city:         r.city ?? "",
    unit:         r.unit ?? "Per Unit",
    materialType: r.materialType,
    category:     r.category ?? "Standard",
    image:        r.image,
    images:       r.images,
    description:  r.description,
  }));
}

interface MaterialPageClientProps {
  initialRates: any[];
  materialType: string;
  pageTitle: string;
  pageContent: string | null;
  cmsPageTitle: string | null;
}

type ViewMode = "grid" | "list";
type SortKey  = "latest" | "price-asc" | "price-desc" | "name";

export default function MaterialPageClient({
  initialRates,
  materialType,
  pageTitle,
  pageContent,
  cmsPageTitle,
}: MaterialPageClientProps) {
  const ALL_RATES: MaterialRate[] = initialRates.length > 0
    ? normaliseRates(initialRates)
    : [];

  const BRANDS    = ["All Brands", ...Array.from(new Set(ALL_RATES.map((b) => b.brand)))];
  const CATEGORIES = ["All Types", ...Array.from(new Set(ALL_RATES.map((b) => b.category ?? "Standard")))];
  const CITIES    = ["All Cities", ...Array.from(new Set(ALL_RATES.map((b) => b.city).filter(Boolean)))];
  const MIN_PRICE = ALL_RATES.length > 0 ? Math.min(...ALL_RATES.map((b) => b.price)) : 0;
  const MAX_PRICE = ALL_RATES.length > 0 ? Math.max(...ALL_RATES.map((b) => b.price)) : 100000;

  const [priceRange, setPriceRange]       = useState<[number, number]>([MIN_PRICE, MAX_PRICE]);
  const [selectedBrand, setSelectedBrand] = useState("All Brands");
  const [selectedCat, setSelectedCat]     = useState("All Types");
  const [selectedCity, setSelectedCity]   = useState("All Cities");
  const [sidebarOpen, setSidebarOpen]     = useState(false);
  const [viewMode, setViewMode]           = useState<ViewMode>("grid");
  const [sortBy, setSortBy]               = useState<SortKey>("latest");
  const [perPage, setPerPage]             = useState(16);
  const [currentPage, setCurrentPage]     = useState(1);

  const filtered = useMemo(() => {
    return ALL_RATES
      .filter((b) => b.price >= priceRange[0] && b.price <= priceRange[1])
      .filter((b) => selectedBrand === "All Brands" || b.brand === selectedBrand)
      .filter((b) => selectedCat   === "All Types"  || b.category === selectedCat)
      .filter((b) => selectedCity  === "All Cities"  || b.city === selectedCity)
      .sort((a, b) => {
        if (sortBy === "price-asc")  return a.price - b.price;
        if (sortBy === "price-desc") return b.price - a.price;
        if (sortBy === "name")       return a.brand.localeCompare(b.brand);
        return 0;
      });
  }, [ALL_RATES, priceRange, selectedBrand, selectedCat, selectedCity, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const results = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  const resetFilters = () => {
    setPriceRange([MIN_PRICE, MAX_PRICE]);
    setSelectedBrand("All Brands");
    setSelectedCat("All Types");
    setSelectedCity("All Cities");
    setCurrentPage(1);
  };

  return (
    <div className="pt-24 bg-gray-50 min-h-screen">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="max-w-6xl mx-auto px-4 pb-12 pt-5">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-gray-400 mb-5 flex-wrap">
          <a href="/" className="hover:text-black transition-colors">Home</a>
          <span>›</span>
          <span className="text-gray-600">{pageTitle}</span>
        </nav>

        <div className="flex gap-6 items-start">
          {/* ── LEFT SIDEBAR ──────────────────────────────────────────── */}
          <aside
            className={`
              w-60 shrink-0 bg-white border border-gray-200 rounded-xl p-4
              sticky top-20 self-start
              max-lg:fixed max-lg:top-0 max-lg:left-0 max-lg:h-screen max-lg:overflow-y-auto
              max-lg:z-50 max-lg:rounded-none max-lg:w-64 max-lg:transition-transform max-lg:duration-300
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
                  onChange={(e) => { setPriceRange([+e.target.value, priceRange[1]]); setCurrentPage(1); }}
                  className="w-full accent-black cursor-pointer" />
                <input type="range" min={MIN_PRICE} max={MAX_PRICE} value={priceRange[1]} step={10}
                  onChange={(e) => { setPriceRange([priceRange[0], +e.target.value]); setCurrentPage(1); }}
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

            <FilterSection title="Brands">
              {BRANDS.map((b) => (
                <RadioOption key={b} name="brand" label={b} checked={selectedBrand === b} onChange={() => { setSelectedBrand(b); setCurrentPage(1); }}
                  count={b !== "All Brands" ? ALL_RATES.filter((x) => x.brand === b).length : undefined} />
              ))}
            </FilterSection>

            <FilterSection title={`${materialType} Type`}>
              {CATEGORIES.map((cat) => (
                <RadioOption key={cat} name="category" label={cat} checked={selectedCat === cat} onChange={() => { setSelectedCat(cat); setCurrentPage(1); }} />
              ))}
            </FilterSection>

            <FilterSection title="Cities">
              {CITIES.map((c) => (
                <RadioOption key={c} name="city" label={c} checked={selectedCity === c} onChange={() => { setSelectedCity(c); setCurrentPage(1); }}
                  count={c !== "All Cities" ? ALL_RATES.filter((x) => x.city === c).length : undefined} />
              ))}
            </FilterSection>
          </aside>

          {/* ── MAIN CONTENT ──────────────────────────────────────────── */}
          <main className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 mb-1 lg:text-3xl">
              {pageTitle} – {new Date().toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' })}
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
                  Showing {results.length} of {filtered.length} results
                </span>
              </div>
              <div className="flex items-center gap-2">
                <select value={sortBy} onChange={(e) => { setSortBy(e.target.value as SortKey); setCurrentPage(1); }}
                  className="text-xs px-2.5 py-1.5 rounded-md border border-gray-200 bg-white text-gray-700 cursor-pointer focus:outline-none focus:border-black">
                  <option value="latest">Sort by latest</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="name">Brand: A–Z</option>
                </select>
                <select value={perPage} onChange={(e) => { setPerPage(+e.target.value); setCurrentPage(1); }}
                  className="text-xs px-2.5 py-1.5 rounded-md border border-gray-200 bg-white text-gray-700 cursor-pointer focus:outline-none focus:border-black">
                  <option value={16}>Show 16</option>
                  <option value={24}>Show 24</option>
                  <option value={32}>Show 32</option>
                  <option value={48}>Show 48</option>
                </select>
              </div>
            </div>

            {/* Cards */}
            {ALL_RATES.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p className="mb-3">No rates available yet. Check back soon!</p>
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p className="mb-3">No results match your filters.</p>
                <button onClick={resetFilters}
                  className="text-sm px-5 py-2 rounded-lg border border-gray-300 hover:bg-black hover:text-white hover:border-black transition-colors">
                  Reset Filters
                </button>
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {results.map((item) => <MaterialCard key={item.id} rate={item} viewMode="grid" materialType={materialType} />)}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {results.map((item) => <MaterialCard key={item.id} rate={item} viewMode="list" materialType={materialType} />)}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="text-xs px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-black hover:text-white hover:border-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`w-8 h-8 rounded-md text-xs font-medium transition-colors ${
                      currentPage === p
                        ? "bg-black text-white border border-black"
                        : "bg-white text-gray-600 border border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="text-xs px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-black hover:text-white hover:border-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            )}

            {/* ── CMS Page Description ─────────────────────────────────── */}
            {pageContent && (
              <div className="mt-10 pt-8 border-t border-gray-200">
                {cmsPageTitle && (
                  <h2 className="text-lg font-bold text-gray-900 mb-4">{cmsPageTitle}</h2>
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
                  {pageTitle} — 2026
                </h2>
                <p className="text-sm text-gray-500 leading-relaxed mb-4">
                  PropertyDealer.pk provides daily updated {materialType.toLowerCase()} prices across all major brands
                  and suppliers in Pakistan. Prices are updated every morning to reflect the latest market rates from
                  Lahore, Karachi, Islamabad, Rawalpindi, Peshawar, and other cities across Pakistan.
                </p>
                <h3 className="text-sm font-bold text-gray-800 mb-2">Why Do {materialType} Prices Change?</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {materialType} prices in Pakistan fluctuate due to raw material costs, fuel prices, government
                  taxes, and seasonal demand. The construction season from February to June typically sees higher
                  demand which pushes prices up.
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

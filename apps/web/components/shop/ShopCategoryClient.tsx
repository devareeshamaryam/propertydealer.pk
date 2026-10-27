'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, ChevronRight, LayoutGrid, List, PackageCheck, PhoneCall, Search, Truck, X } from 'lucide-react';
import ProductCard from '@/components/shop/ProductCard';
import { useSiteSettings } from '@/components/SiteSettingsProvider';
import { PRODUCT_TYPES, rs, typeMeta, type ProductType, type ShopProduct } from '@/lib/shop';
import { useMaterialTypes } from '@/components/MaterialTypesProvider';
import { cn } from '@/lib/utils';
import { CityPicker } from '@/components/ui/city-picker';

/*
 * One page layout for every material the shop sells.
 *
 * Eight rate pages (cement, steel, bricks, sand, bajri, wood, doors, tiles)
 * each had their own copy of a filter sidebar with black radio buttons, a
 * grey toolbar and differently-styled cards, and only cement could be
 * ordered. They now share this: a material switcher, a one-line summary of
 * today's prices, search + filters + sort that fit on a phone, one product
 * card with add-to-cart, and the page's own CMS text underneath. The URLs and
 * the CMS content of each page are untouched.
 */

interface TileCategory {
  _id?: string;
  name: string;
  slug: string;
  subcategories?: { name: string; slug: string }[];
}

type Sort = 'popular' | 'price-asc' | 'price-desc' | 'name';

const selectCls =
  'h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-8 text-[13.5px] text-slate-800 outline-none transition-colors hover:border-slate-300 focus:border-primary';

function Select({ value, onChange, children, label }: { value: string; onChange: (v: string) => void; children: ReactNode; label: string }) {
  return (
    <label className="relative block min-w-0">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectCls}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </label>
  );
}

export default function ShopCategoryClient({
  type,
  products,
  heading,
  pageContent,
  cmsPageTitle,
  fallbackContent,
  tileCategories = [],
}: {
  type: ProductType;
  products: ShopProduct[];
  heading: string;
  pageContent?: string | null;
  cmsPageTitle?: string | null;
  fallbackContent?: ReactNode;
  tileCategories?: TileCategory[];
}) {
  const customs = useMaterialTypes();
  const pathname = usePathname();
  const settings = useSiteSettings();
  const [query, setQuery] = useState('');
  const [brand, setBrand] = useState('all');
  const [category, setCategory] = useState('all');
  const [city, setCity] = useState('all');
  const [sort, setSort] = useState<Sort>('popular');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [openTileCat, setOpenTileCat] = useState<string | null>(null);

  const brands = useMemo(() => [...new Set(products.map((p) => p.brand).filter(Boolean))].sort(), [products]);
  const categories = useMemo(() => [...new Set(products.map((p) => p.category).filter(Boolean))].sort(), [products]);
  const cities = useMemo(() => [...new Set(products.map((p) => p.city).filter(Boolean))].sort(), [products]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => !q || `${p.title} ${p.brand} ${p.city} ${p.category}`.toLowerCase().includes(q))
      .filter((p) => brand === 'all' || p.brand === brand)
      .filter((p) => category === 'all' || p.category === category)
      .filter((p) => city === 'all' || p.city === city)
      .sort((a, b) => {
        if (sort === 'price-asc') return a.price - b.price;
        if (sort === 'price-desc') return b.price - a.price;
        if (sort === 'name') return a.title.localeCompare(b.title);
        return 0;
      });
  }, [products, query, brand, category, city, sort]);

  const prices = products.map((p) => p.price).filter((n) => n > 0);
  const low = prices.length ? Math.min(...prices) : 0;
  const high = prices.length ? Math.max(...prices) : 0;
  const filtersOn = query || brand !== 'all' || category !== 'all' || city !== 'all';
  const reset = () => { setQuery(''); setBrand('all'); setCategory('all'); setCity('all'); };
  const today = new Date().toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="bg-slate-50 pb-10">
      <div className="container mx-auto px-4 pt-3 sm:pt-4">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1 text-[12.5px] text-slate-500">
          <Link href="/" className="hover:text-primary">Home</Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="text-slate-700">{typeMeta(type, customs).label} rates</span>
        </nav>

        <h1 className="text-[24px] font-bold tracking-tight text-slate-900 sm:text-[32px]" suppressHydrationWarning>
          {heading} – {today}
        </h1>
        {prices.length > 0 && (
          <p className="mt-1 text-[13.5px] text-slate-600">
            {products.length} {products.length === 1 ? 'product' : 'products'} · from{' '}
            <span className="font-semibold text-slate-900">{rs(low)}</span> to{' '}
            <span className="font-semibold text-slate-900">{rs(high)}</span>
          </p>
        )}

        {/* Material switcher */}
        <div className="hide-scrollbar -mx-[var(--gutter)] mt-4 flex gap-2 overflow-x-auto px-[var(--gutter)] pb-1">
          {[...PRODUCT_TYPES, ...customs.map((c) => c.slug)].map((t) => {
            const m = typeMeta(t, customs);
            const active = pathname?.startsWith(m.path) ?? t === type;
            return (
              <Link
                key={t}
                href={m.path}
                className={cn(
                  'shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors',
                  active ? 'border-primary bg-primary text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                )}
              >
                {m.label}
              </Link>
            );
          })}
        </div>

        {/* Tile collections (tiles only) */}
        {tileCategories.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {tileCategories.map((cat) => (
              <div key={cat.slug} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setCategory(categories.includes(cat.name) ? cat.name : 'all');
                    setOpenTileCat(openTileCat === cat.slug ? null : cat.slug);
                  }}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-[13px] font-medium',
                    category === cat.name ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white text-slate-700',
                  )}
                >
                  {cat.name}
                  {!!cat.subcategories?.length && <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                {openTileCat === cat.slug && !!cat.subcategories?.length && (
                  <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                    {cat.subcategories.map((sub) => (
                      <Link key={sub.slug} href={`${typeMeta('tile').path}/${sub.slug}`} className="block rounded-lg px-3 py-2 text-[13px] text-slate-700 hover:bg-slate-50 hover:text-primary">
                        {sub.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Toolbar */}
        <div className="sticky top-16 z-20 -mx-[var(--gutter)] mt-4 border-y border-slate-200 bg-white px-2 py-2.5 sm:px-4 md:mx-0 md:rounded-xl md:border md:px-3">
          <div className="grid grid-cols-2 gap-2 md:flex md:items-center">
            <label className="relative col-span-2 md:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${typeMeta(type, customs).label.toLowerCase()}`}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-[13.5px] outline-none focus:border-primary"
              />
            </label>
            {brands.length > 1 && (
              <Select label="Brand" value={brand} onChange={setBrand}>
                <option value="all">All brands</option>
                {brands.map((b) => <option key={b} value={b}>{b}</option>)}
              </Select>
            )}
            {categories.length > 1 && (
              <Select label="Type" value={category} onChange={setCategory}>
                <option value="all">All types</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            )}
            {cities.length > 1 && (
              <CityPicker
                options={cities.map((c) => ({ value: c, label: c }))}
                value={city === 'all' ? '' : city}
                onChange={(v) => setCity(v || 'all')}
                allLabel="All cities"
                icon={false}
                inputClassName={selectCls}
              />
            )}
            <Select label="Sort" value={sort} onChange={(v) => setSort(v as Sort)}>
              <option value="popular">Sort: default</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
              <option value="name">Name: A–Z</option>
            </Select>
            <div className="col-span-2 flex items-center justify-between gap-2 md:ml-auto md:col-span-1">
              <span className="text-[12.5px] text-slate-500 md:hidden">{results.length} shown</span>
              <div className="flex rounded-xl border border-slate-200 bg-white p-0.5">
                {(['grid', 'list'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-label={v === 'grid' ? 'Grid view' : 'List view'}
                    onClick={() => setView(v)}
                    className={cn('grid h-8 w-9 place-items-center rounded-lg', view === v ? 'bg-primary text-white' : 'text-slate-500 hover:text-slate-800')}
                  >
                    {v === 'grid' ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {filtersOn && (
            <button type="button" onClick={reset} className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-medium text-primary hover:underline">
              <X className="h-3.5 w-3.5" /> Clear filters
            </button>
          )}
        </div>

        {/* Products */}
        <div className="mt-4">
          {products.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-14 text-center text-slate-500">
              Today&apos;s rates are being updated. Please check back shortly.
            </div>
          ) : results.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-12 text-center">
              <p className="text-slate-600">Nothing matches these filters.</p>
              <button type="button" onClick={reset} className="mt-2 text-sm font-semibold text-primary hover:underline">Clear filters</button>
            </div>
          ) : view === 'grid' ? (
            <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
              {results.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          ) : (
            <div className="space-y-2.5">
              {results.map((p) => <ProductCard key={p.id} product={p} view="list" />)}
            </div>
          )}
        </div>

        {/* How ordering works */}
        {settings.shopEnabled && products.length > 0 && (
          <div className="mt-6 grid gap-2.5 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
            {[
              { icon: PackageCheck, title: 'Order online', text: 'Add to cart and check out — no account needed.' },
              { icon: PhoneCall, title: 'We confirm by phone', text: 'Our team calls to confirm the rate, quantity and delivery time.' },
              { icon: Truck, title: 'Delivered to your site', text: settings.shopCodEnabled ? 'Pay cash on delivery.' : 'Pay by bank transfer before dispatch.' },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="h-[18px] w-[18px]" /></span>
                <span>
                  <span className="block text-[14px] font-semibold text-slate-900">{title}</span>
                  <span className="block text-[12.5px] text-slate-500">{text}</span>
                </span>
              </div>
            ))}
          </div>
        )}

        {/* The page's own text (Static Pages CMS) */}
        {pageContent ? (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
            {cmsPageTitle && <h2 className="mb-3 text-lg font-bold text-slate-900">{cmsPageTitle}</h2>}
            <div className="prose prose-sm max-w-none leading-relaxed text-slate-700 prose-headings:text-slate-900 prose-a:text-primary" dangerouslySetInnerHTML={{ __html: pageContent }} />
          </section>
        ) : fallbackContent ? (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">{fallbackContent}</section>
        ) : null}
      </div>
    </div>
  );
}

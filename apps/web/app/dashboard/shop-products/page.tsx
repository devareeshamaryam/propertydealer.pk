"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Pencil, RefreshCcw, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { DataCard, PageHeader, apiErrorMessage } from "@/components/dashboard";
import { PRODUCT_TYPES, imageSrc, isBuiltIn, shopApi, typeMeta, type BuiltInType, type ProductType, type ShopProduct } from "@/lib/shop";
import { materialTypeApi } from "@/lib/api/material-type.api";
import type { MaterialTypeInfo } from "@/lib/materials";
import { cn } from "@/lib/utils";

/**
 * Rates board — every material's price in one table.
 *
 * Updating the day's rates meant opening nine separate sections (cement,
 * steel, bricks…) and editing products one form at a time. Here they are all
 * in one list, filterable by material and searchable; today's price and the
 * change are edited in place (Enter or leaving the field saves), and a
 * product can be switched off without deleting it. The full edit forms are
 * still a click away for photos and descriptions.
 */

const EDIT_PATH: Record<BuiltInType, string> = {
  cement: "/dashboard/cement-rate/edit",
  steel: "/dashboard/steel-rate/edit",
  bricks: "/dashboard/bricks-rate/edit",
  sand: "/dashboard/sand-rate/edit",
  bajri: "/dashboard/bajri-rate/edit",
  wood: "/dashboard/wood-rate/edit",
  door: "/dashboard/door-rate/edit",
  tile: "/dashboard/tile-rate/edit",
};

function NumberCell({ value, onSave, prefix }: { value: number; onSave: (n: number) => Promise<void>; prefix?: string }) {
  const [draft, setDraft] = useState(String(value));
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(String(value)), [value]);

  const commit = async () => {
    const n = Math.round(Number(draft.replace(/[,\s]/g, "")));
    if (!Number.isFinite(n) || n === value) { setDraft(String(value)); return; }
    setSaving(true);
    try { await onSave(n); } finally { setSaving(false); }
  };

  return (
    <div className="relative">
      {prefix && <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-slate-400">{prefix}</span>}
      <input
        value={draft}
        inputMode="numeric"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setDraft(String(value)); }}
        className={cn(
          "h-9 w-28 rounded-lg border border-transparent bg-slate-50 text-right text-[13.5px] font-semibold tabular-nums outline-none transition-colors hover:border-slate-200 focus:border-primary focus:bg-white",
          prefix ? "pl-7 pr-2.5" : "px-2.5",
        )}
      />
      {saving && <Loader2 className="absolute -right-5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-slate-400" />}
    </div>
  );
}

export default function ShopProductsPage() {
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<ProductType | "all">("all");
  // Materials added from the dashboard sit next to the built-in ones.
  const [customs, setCustoms] = useState<MaterialTypeInfo[]>([]);
  useEffect(() => {
    materialTypeApi.active().then(setCustoms).catch(() => undefined);
  }, []);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProducts(await shopApi.adminProducts());
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load products"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((p) => type === "all" || p.type === type)
      .filter((p) => !q || `${p.title} ${p.brand} ${p.city} ${p.category}`.toLowerCase().includes(q));
  }, [products, type, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of products) c[p.type] = (c[p.type] ?? 0) + 1;
    return c;
  }, [products]);

  const save = async (p: ShopProduct, body: { price?: number; change?: number; isActive?: boolean }) => {
    try {
      const updated = await shopApi.updateProduct(p.type, p.id, body);
      setProducts((list) => list.map((x) => (x.type === p.type && x.id === p.id ? { ...x, ...updated } : x)));
      toast.success(`${p.brand} updated`, { description: "Live on the rate page now." });
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save"));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rates board"
        description="Update today's price for every material in one place. Changes go live straight away."
        actions={<Button variant="outline" onClick={() => void load()}><RefreshCcw className="mr-2 h-4 w-4" /> Refresh</Button>}
      />

      <DataCard flush className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="hide-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1">
            {(["all", ...PRODUCT_TYPES, ...customs.map((c) => c.slug)] as string[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn("shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-medium", type === t ? "bg-primary text-white" : "text-slate-600 hover:bg-slate-100")}
              >
                {t === "all" ? "All" : typeMeta(t, customs).label}
                <span className="ml-1 opacity-70">{t === "all" ? products.length : counts[t] ?? 0}</span>
              </button>
            ))}
          </div>
          <label className="relative lg:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search brand, city…" className="pl-9" />
          </label>
        </div>

        {loading ? (
          <div className="grid place-items-center py-16 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : shown.length === 0 ? (
          <p className="py-16 text-center text-slate-500">No products.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead className="bg-slate-50 text-left text-[12px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Product</th>
                  <th className="hidden px-4 py-2.5 md:table-cell">Material</th>
                  <th className="px-4 py-2.5 text-right">Price (Rs)</th>
                  <th className="px-4 py-2.5 text-right">Change</th>
                  <th className="px-4 py-2.5 text-center">On sale</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {shown.map((p) => (
                  <tr key={`${p.type}-${p.id}`} className={cn(!p.isActive && "opacity-55")}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-50 ring-1 ring-slate-200">
                          {p.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={imageSrc(p.image)} alt="" className="h-full w-full object-contain" />
                          ) : (
                            <span className="text-[11px] font-bold text-slate-400">{p.brand.slice(0, 2).toUpperCase()}</span>
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-slate-900">{p.title}</span>
                          <span className="text-[12px] text-slate-500">{p.unit}{p.city ? ` · ${p.city}` : ""}{p.category ? ` · ${p.category}` : ""}</span>
                        </span>
                      </div>
                    </td>
                    <td className="hidden px-4 py-2.5 text-slate-600 md:table-cell">{typeMeta(p.type, customs).label}</td>
                    <td className="px-4 py-2.5"><div className="flex justify-end"><NumberCell value={p.price} prefix="Rs" onSave={(n) => save(p, { price: n })} /></div></td>
                    <td className="px-4 py-2.5"><div className="flex justify-end"><NumberCell value={p.change} onSave={(n) => save(p, { change: n })} /></div></td>
                    <td className="px-4 py-2.5 text-center"><Switch checked={p.isActive !== false} onCheckedChange={(v) => void save(p, { isActive: v })} /></td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        <Link href={isBuiltIn(p.type) ? `${EDIT_PATH[p.type]}/${p.id}` : `/dashboard/material-rate/edit/${p.id}`} className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Full edit"><Pencil className="h-4 w-4" /></Link>
                        <Link href={p.href} target="_blank" className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="View on site"><ExternalLink className="h-4 w-4" /></Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>
      <p className="text-[12.5px] text-muted-foreground">
        Tip: “Change” is today&apos;s rise (positive) or fall (negative) against yesterday — it shows as ▲ / ▼ on the rate pages.
      </p>
    </div>
  );
}

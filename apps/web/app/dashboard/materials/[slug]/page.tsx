"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, CircleDashed, ExternalLink, ImageOff, Loader2, Pencil, Plus, Settings2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog, DataCard, PageHeader, apiErrorMessage, useConfirm } from "@/components/dashboard";
import { ImageField } from "@/components/media";
import { MATERIAL_PRESETS, MaterialTypeDialog } from "@/components/dashboard/material-type-dialog";
import { materialTypeApi } from "@/lib/api/material-type.api";
import materialRateApi, { type MaterialRateData } from "@/lib/api/material-rate/material-rate.api";
import { imageSrc, shopApi } from "@/lib/shop";
import type { MaterialTypeAdmin } from "@/lib/materials";
import { cn } from "@/lib/utils";

/**
 * One material's products (Dashboard → Materials → Marble).
 *
 * Add a product in one line — brand and today's price, the rest optional —
 * and change any price right in the list (Enter or leaving the box saves),
 * the same way the Rates Board works. The full form is a click away for
 * extra photos and a description.
 */

const CITIES = ["Pakistan", "Lahore", "Karachi", "Islamabad", "Rawalpindi", "Faisalabad", "Multan", "Peshawar", "Gujranwala", "Sialkot"];
const n = (v: number) => `Rs ${Math.round(v).toLocaleString("en-PK")}`;

function PriceCell({ value, onSave }: { value: number; onSave: (v: number) => Promise<void> }) {
  const [draft, setDraft] = useState(String(value));
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(String(value)), [value]);
  const commit = async () => {
    const v = Math.round(Number(draft.replace(/[,\s]/g, "")));
    if (!Number.isFinite(v) || v < 0 || v === value) {
      setDraft(String(value));
      return;
    }
    setSaving(true);
    try {
      await onSave(v);
    } finally {
      setSaving(false);
    }
  };
  return (
    <span className="relative inline-flex items-center">
      <span className="pointer-events-none absolute left-2 text-xs text-muted-foreground">Rs</span>
      <Input
        value={draft}
        inputMode="numeric"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="h-8 w-32 pl-7 tabular-nums"
        aria-label="Price"
      />
      {saving && <Loader2 className="absolute -right-5 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
    </span>
  );
}

function ChangeTag({ change }: { change: number }) {
  if (!change) return <span className="w-14 text-xs text-muted-foreground">—</span>;
  return (
    <span className={cn("w-14 text-xs font-medium tabular-nums", change > 0 ? "text-emerald-600" : "text-red-600")}>
      {change > 0 ? "+" : "−"}
      {Math.abs(change).toLocaleString("en-PK")}
    </span>
  );
}

export default function MaterialProductsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [material, setMaterial] = useState<MaterialTypeAdmin | null>(null);
  const [all, setAll] = useState<MaterialTypeAdmin[]>([]);
  const [rates, setRates] = useState<MaterialRateData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ brand: "", price: "", unit: "", city: "Pakistan", image: "" });
  const [adding, setAdding] = useState(false);
  const { confirm, dialogProps } = useConfirm();

  const load = useCallback(async () => {
    try {
      const [types, list] = await Promise.all([materialTypeApi.list(), materialRateApi.getAllRates(slug)]);
      setAll(types);
      const m = types.find((t) => t.slug === slug) ?? null;
      setMaterial(m);
      setRates(Array.isArray(list) ? list : []);
      if (m) setForm((f) => ({ ...f, unit: f.unit || m.unit || "Per unit" }));
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not load the products"));
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSale = useMemo(() => rates.filter((r) => r.isActive !== false).length, [rates]);

  const add = async () => {
    if (!material) return;
    if (form.brand.trim().length < 2) return toast.error("Enter the brand or product name");
    const price = Math.round(Number(form.price.replace(/[,\s]/g, "")));
    if (!Number.isFinite(price) || price <= 0) return toast.error("Enter today's price");
    setAdding(true);
    try {
      const fd = new FormData();
      fd.append("brand", form.brand.trim());
      fd.append("price", String(price));
      fd.append("change", "0");
      fd.append("city", form.city.trim() || "Pakistan");
      fd.append("unit", form.unit || material.unit || "Per unit");
      fd.append("materialType", material.slug);
      fd.append("isActive", "true");
      if (form.image) fd.append("image", form.image);
      await materialRateApi.createRate(fd);
      toast.success(`${form.brand.trim()} added`, { description: onSale === 0 ? `${material.name} is now on the site.` : "It shows on the page and in the shop." });
      setForm({ brand: "", price: "", unit: material.unit || "Per unit", city: form.city, image: "" });
      await load();
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not add the product"));
    } finally {
      setAdding(false);
    }
  };

  const patch = async (r: MaterialRateData, body: { price?: number; change?: number; isActive?: boolean }, ok: string) => {
    try {
      await shopApi.updateProduct(slug, String(r._id), body);
      setRates((list) => list.map((x) => (x._id === r._id ? { ...x, ...body } : x)));
      toast.success(ok);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not save"));
    }
  };

  const remove = (r: MaterialRateData) =>
    confirm({
      title: `Delete ${r.brand}?`,
      description: "Its page is removed from the site. To keep it for later, switch it off instead.",
      confirmLabel: "Delete",
      destructive: true,
      onConfirm: async () => {
        try {
          await materialRateApi.deleteRate(String(r._id));
          toast.success(`${r.brand} deleted`);
          await load();
        } catch (e) {
          toast.error(apiErrorMessage(e, "Could not delete"));
        }
      },
    });

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!material) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <PageHeader title="Material not found" />
        <Button variant="outline" asChild>
          <Link href="/dashboard/materials">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> All materials
          </Link>
        </Button>
      </div>
    );
  }

  const live = material.isActive && onSale > 0;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <Link href="/dashboard/materials" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All materials
      </Link>
      <PageHeader
        title={`${material.name} — products & prices`}
        description={`Prices ${material.unit.toLowerCase()} · ${material.path}`}
        meta={
          live ? (
            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
              <CheckCircle2 className="mr-1 h-3 w-3" /> On the site
            </Badge>
          ) : (
            <Badge variant="secondary">
              <CircleDashed className="mr-1 h-3 w-3" /> {material.isActive ? "Add a product to show it" : "Switched off"}
            </Badge>
          )
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {live && (
              <Button variant="outline" asChild>
                <a href={material.path} target="_blank" rel="noopener">
                  <ExternalLink className="mr-1.5 h-4 w-4" /> View page
                </a>
              </Button>
            )}
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Settings2 className="mr-1.5 h-4 w-4" /> Material settings
            </Button>
          </div>
        }
      />

      {/* Add a product, in one line. */}
      <DataCard className="space-y-4">
        <p className="font-semibold">Add a product</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          <div className="col-span-2 space-y-1.5 lg:col-span-1">
            <Label htmlFor="p-brand">Brand / product</Label>
            <Input id="p-brand" value={form.brand} placeholder={`e.g. ${MATERIAL_PRESETS.find((p) => p.name.toLowerCase() === material.name.toLowerCase())?.example ?? "Brand name"}`} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-price">Today&apos;s price (Rs)</Label>
            <Input id="p-price" inputMode="numeric" value={form.price} placeholder="450" onChange={(e) => setForm({ ...form, price: e.target.value })} onKeyDown={(e) => e.key === "Enter" && void add()} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-unit">Unit</Label>
            <Input id="p-unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          </div>
          <div className="col-span-2 space-y-1.5 lg:col-span-1">
            <Label htmlFor="p-city">City</Label>
            <Input id="p-city" list="p-cities" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <datalist id="p-cities">
              {CITIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
        </div>
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto]">
          <ImageField label="Photo (optional)" value={form.image} onChange={(url) => setForm({ ...form, image: url })} folder="general" context={`${form.brand} ${material.name}`.trim()} aspect="square" allowUrl={false} />
          <Button onClick={() => void add()} disabled={adding} className="sm:mb-1">
            {adding ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />} Add product
          </Button>
        </div>
      </DataCard>

      {/* The products. */}
      <DataCard flush className="overflow-hidden">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="font-semibold">
            Products <span className="font-normal text-muted-foreground">· {onSale} on sale{rates.length > onSale ? `, ${rates.length - onSale} off` : ""}</span>
          </p>
          <Link href="/dashboard/shop-products" className="text-xs font-medium text-primary hover:underline">
            Also in the Rates Board →
          </Link>
        </div>
        {rates.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">No products yet — add the first one above and {material.name} goes on the site.</p>
        ) : (
          <ul className="divide-y">
            {rates.map((r) => (
              <li key={r._id} className={cn("flex flex-wrap items-center gap-3 px-4 py-3", r.isActive === false && "bg-slate-50 opacity-70")}>
                <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-100 text-slate-300">
                  {r.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageSrc(r.image)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImageOff className="h-4 w-4" />
                  )}
                </span>
                <span className="min-w-0 grow basis-40">
                  <span className="block truncate font-medium">{r.brand}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {r.unit} · {r.city}
                  </span>
                </span>
                <PriceCell
                  value={Number(r.price) || 0}
                  // The site shows "+15 today" — worked out from the old price.
                  onSave={(v) => patch(r, { price: v, change: v - (Number(r.price) || 0) }, `${r.brand}: ${n(v)}`)}
                />
                <ChangeTag change={Number(r.change) || 0} />
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch checked={r.isActive !== false} onCheckedChange={(v) => void patch(r, { isActive: v }, v ? `${r.brand} on sale` : `${r.brand} switched off`)} />
                  On sale
                </label>
                <span className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                    <Link href={`/dashboard/material-rate/edit/${r._id}`} aria-label="Full edit">
                      <Pencil className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => remove(r)} aria-label="Delete">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </DataCard>

      <MaterialTypeDialog open={editing} onOpenChange={setEditing} editing={material} existing={all} onSaved={() => void load()} />
      <ConfirmDialog {...dialogProps} />
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ExternalLink, Layers, Loader2, Pencil, Plus, Tags, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog, DataCard, PageHeader, apiErrorMessage, useConfirm } from "@/components/dashboard";
import { materialTypeApi } from "@/lib/api/material-type.api";
import type { MaterialTypeAdmin } from "@/lib/materials";

/**
 * Dashboard → Materials: new construction materials without a code change.
 *
 * A material added here (Marble, Glass, Paint…) gets everything the eight
 * built-in ones have — its rates page /today-<slug>-rate-in-pakistan, a page
 * per product, a place in the header's Rates menu, the footer, the shop's
 * material switcher and the rates sitemap. Its rates are added under "Added
 * materials' rates". The address is fixed once created (it may be ranked);
 * a material with rates is switched off rather than deleted.
 */

type Form = {
  name: string;
  slug: string;
  unit: string;
  description: string;
  content: string;
  metaTitle: string;
  metaDescription: string;
  order: string;
  isActive: boolean;
};

const EMPTY: Form = { name: "", slug: "", unit: "Per unit", description: "", content: "", metaTitle: "", metaDescription: "", order: "0", isActive: true };
const toSlug = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
const UNITS = ["Per unit", "Per piece", "Per sq ft", "Per bag", "Per kg", "Per ton", "Per cubic foot", "Per litre", "Per foot"];

export default function MaterialsPage() {
  const [rows, setRows] = useState<MaterialTypeAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null);
  const [saving, setSaving] = useState(false);
  const { confirm, dialogProps } = useConfirm();

  const load = useCallback(async () => {
    try {
      setRows(await materialTypeApi.list());
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not load the materials"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const open = (row?: MaterialTypeAdmin) =>
    setEditing(
      row
        ? {
            id: row._id,
            form: {
              name: row.name,
              slug: row.slug,
              unit: row.unit || "Per unit",
              description: row.description ?? "",
              content: row.content ?? "",
              metaTitle: row.metaTitle ?? "",
              metaDescription: row.metaDescription ?? "",
              order: String(row.order ?? 0),
              isActive: row.isActive,
            },
          }
        : { id: null, form: { ...EMPTY, order: String(rows.length + 1) } },
    );

  const save = async () => {
    if (!editing) return;
    const f = editing.form;
    if (f.name.trim().length < 2) return toast.error('Enter the material name, e.g. "Marble"');
    setSaving(true);
    try {
      const body = { ...f, order: Number(f.order) || 0 } as Partial<MaterialTypeAdmin> & { slug?: string };
      if (editing.id) {
        delete body.slug;
        await materialTypeApi.update(editing.id, body);
        toast.success(`${f.name} saved`, { description: "The site shows the change within a minute." });
      } else {
        await materialTypeApi.create({ ...body, slug: toSlug(f.slug || f.name) });
        toast.success(`${f.name} added`, { description: "Now add its rates — it is already in the menu, the footer and the shop." });
      }
      setEditing(null);
      await load();
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not save the material"));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (row: MaterialTypeAdmin) => {
    try {
      await materialTypeApi.update(row._id, { isActive: !row.isActive });
      toast.success(row.isActive ? `${row.name} hidden from the site` : `${row.name} shown on the site`);
      await load();
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not change the material"));
    }
  };

  const remove = (row: MaterialTypeAdmin) =>
    confirm({
      title: `Delete ${row.name}?`,
      description: "Its page is removed from the site. A material with rates cannot be deleted — switch it off instead.",
      confirmLabel: "Delete",
      destructive: true,
      onConfirm: async () => {
        try {
          await materialTypeApi.remove(row._id);
          toast.success(`${row.name} deleted`);
          await load();
        } catch (e) {
          toast.error(apiErrorMessage(e, "Could not delete the material"));
        }
      },
    });

  const set = (patch: Partial<Form>) => editing && setEditing({ ...editing, form: { ...editing.form, ...patch } });
  const previewSlug = editing ? (editing.id ? editing.form.slug : toSlug(editing.form.slug || editing.form.name)) : "";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <PageHeader
        title="Materials"
        description="Add a construction material — it gets its own rates page, product pages, and a place in the menu, footer, shop and sitemap, like Cement or Bajri."
        actions={
          <Button onClick={() => open()}>
            <Plus className="mr-1.5 h-4 w-4" /> Add material
          </Button>
        }
      />

      <DataCard className="text-sm text-muted-foreground">
        Built in (managed under Material Rates): Cement, Steel, Bricks, Sand, Bajri, Tiles, Wood, Doors. Materials added here appear after them.
      </DataCard>

      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <DataCard className="flex flex-col items-center gap-2 p-10 text-center">
          <Layers className="h-8 w-8 text-slate-300" />
          <p className="font-medium">No materials added yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">Add Marble, Glass, Paint or anything else you sell rates for.</p>
          <Button className="mt-2" onClick={() => open()}>
            <Plus className="mr-1.5 h-4 w-4" /> Add your first material
          </Button>
        </DataCard>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((r) => (
            <DataCard key={r._id} className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-semibold">
                    {r.name}
                    {r.isActive ? (
                      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">On the site</Badge>
                    ) : (
                      <Badge variant="secondary">Off</Badge>
                    )}
                  </p>
                  <p className="truncate font-mono text-xs text-muted-foreground">{r.path}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.rates} {r.rates === 1 ? "rate" : "rates"} · {r.unit}
                  </p>
                </div>
                <Switch checked={r.isActive} onCheckedChange={() => void toggle(r)} aria-label="Show on the site" />
              </div>
              <div className="flex flex-wrap gap-2 border-t pt-3">
                <Button size="sm" asChild>
                  <Link href={`/dashboard/material-rate?type=${encodeURIComponent(r.slug)}`}>
                    <Tags className="mr-1.5 h-3.5 w-3.5" /> Rates
                  </Link>
                </Button>
                <Button size="sm" variant="outline" onClick={() => open(r)}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                </Button>
                {r.isActive && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={r.path} target="_blank" rel="noopener">
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> View page
                    </a>
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="ml-auto text-destructive hover:text-destructive" disabled={r.rates > 0} onClick={() => remove(r)}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </DataCard>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && !saving && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? `Edit ${editing.form.name}` : "Add a material"}</DialogTitle>
            <DialogDescription>
              Page address: <span className="font-mono">/today-{previewSlug || "…"}-rate-in-pakistan</span>
              {editing?.id ? " (fixed — it may already be ranked)" : ""}
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="m-name">Name</Label>
                <Input id="m-name" value={editing.form.name} placeholder="Marble" onChange={(e) => set({ name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-slug">Address word</Label>
                <Input
                  id="m-slug"
                  value={editing.id ? editing.form.slug : editing.form.slug}
                  placeholder={toSlug(editing.form.name) || "marble"}
                  disabled={!!editing.id}
                  onChange={(e) => set({ slug: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-unit">Default unit</Label>
                <Input id="m-unit" list="m-units" value={editing.form.unit} onChange={(e) => set({ unit: e.target.value })} />
                <datalist id="m-units">
                  {UNITS.map((u) => (
                    <option key={u} value={u} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-order">Position in menus</Label>
                <Input id="m-order" inputMode="numeric" value={editing.form.order} onChange={(e) => set({ order: e.target.value.replace(/[^\d-]/g, "") })} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="m-desc">Short description</Label>
                <Input id="m-desc" value={editing.form.description} maxLength={300} onChange={(e) => set({ description: e.target.value })} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="m-title">Meta title (optional)</Label>
                <Input
                  id="m-title"
                  value={editing.form.metaTitle}
                  maxLength={120}
                  placeholder={`Today ${editing.form.name || "Marble"} Rate in Pakistan ${new Date().getFullYear()}`}
                  onChange={(e) => set({ metaTitle: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="m-mdesc">Meta description (optional)</Label>
                <Textarea id="m-mdesc" rows={2} maxLength={300} value={editing.form.metaDescription} onChange={(e) => set({ metaDescription: e.target.value })} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="m-content">Page text (shown below the rates; HTML allowed)</Label>
                <Textarea id="m-content" rows={6} value={editing.form.content} onChange={(e) => set({ content: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <Switch checked={editing.form.isActive} onCheckedChange={(v) => set({ isActive: v })} /> Show on the site
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} {editing?.id ? "Save" : "Add material"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}

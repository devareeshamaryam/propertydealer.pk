"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiErrorMessage } from "@/components/dashboard/api-error";
import { ImageField } from "@/components/media";
import { materialTypeApi } from "@/lib/api/material-type.api";
import type { MaterialTypeAdmin } from "@/lib/materials";
import { cn } from "@/lib/utils";

/*
 * Add or edit a material (Dashboard → Materials). Kept to what matters: a
 * name and the unit its prices are in — one tap on a ready-made one fills
 * both. The page text and search titles are optional and folded away; the
 * page writes sensible ones by itself.
 */

/** Common materials with the unit Pakistani suppliers quote them in. */
export const MATERIAL_PRESETS: { name: string; unit: string; description: string; example: string }[] = [
  { name: "Marble", unit: "Per sq ft", description: "Today's marble prices in Pakistan — Ziarat, Sunny Grey, Botticino and more.", example: "Ziarat White" },
  { name: "Granite", unit: "Per sq ft", description: "Granite prices per square foot from suppliers across Pakistan.", example: "Black Galaxy" },
  { name: "Paint", unit: "Per gallon", description: "Wall, enamel and weather-shield paint prices by brand.", example: "ICI Dulux Weathershield" },
  { name: "Glass", unit: "Per sq ft", description: "Plain, tinted and toughened glass rates per square foot.", example: "Ghani 5mm Clear" },
  { name: "Sanitary", unit: "Per piece", description: "Commodes, basins, taps and showers — today's sanitary ware prices.", example: "Porta One-piece Commode" },
  { name: "Electric Wire", unit: "Per coil", description: "Electric wire and cable prices by brand and size.", example: "Pakistan Cables 7/29" },
  { name: "PVC Pipes", unit: "Per foot", description: "PVC and PPR pipe prices for plumbing and drainage.", example: "Dadex 1 inch" },
  { name: "Plywood", unit: "Per sheet", description: "Plywood and MDF sheet prices by thickness.", example: "18mm Commercial Ply" },
];

const UNITS = ["Per unit", "Per piece", "Per sq ft", "Per sheet", "Per bag", "Per kg", "Per ton", "Per cubic foot", "Per foot", "Per coil", "Per gallon", "Per litre"];
const toSlug = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

type Form = { name: string; slug: string; unit: string; description: string; content: string; metaTitle: string; metaDescription: string; image: string; isActive: boolean };

export function MaterialTypeDialog({
  open,
  onOpenChange,
  editing,
  existing = [],
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The material being edited; none = adding a new one. */
  editing?: MaterialTypeAdmin | null;
  /** Already added, so their presets are greyed out. */
  existing?: MaterialTypeAdmin[];
  onSaved: (material: MaterialTypeAdmin, created: boolean) => void;
}) {
  const blank: Form = { name: "", slug: "", unit: "Per unit", description: "", content: "", metaTitle: "", metaDescription: "", image: "", isActive: true };
  const [form, setForm] = useState<Form>(blank);
  const [more, setMore] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMore(false);
    setForm(
      editing
        ? {
            name: editing.name,
            slug: editing.slug,
            unit: editing.unit || "Per unit",
            description: editing.description ?? "",
            content: editing.content ?? "",
            metaTitle: editing.metaTitle ?? "",
            metaDescription: editing.metaDescription ?? "",
            image: editing.image ?? "",
            isActive: editing.isActive,
          }
        : blank,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const slug = editing ? editing.slug : toSlug(form.slug || form.name);
  const taken = new Set(existing.map((m) => m.slug));

  const save = async () => {
    if (form.name.trim().length < 2) return toast.error('Enter the material name, e.g. "Marble"');
    setSaving(true);
    try {
      const body = { name: form.name.trim(), unit: form.unit, description: form.description, content: form.content, metaTitle: form.metaTitle, metaDescription: form.metaDescription, image: form.image, isActive: form.isActive };
      const saved = editing ? await materialTypeApi.update(editing._id, body) : await materialTypeApi.create({ ...body, slug });
      toast.success(editing ? `${form.name} saved` : `${form.name} added — now add its products`);
      onSaved({ ...(editing ?? {}), ...saved, _id: String(saved._id ?? editing?._id) } as MaterialTypeAdmin, !editing);
      onOpenChange(false);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not save the material"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${editing.name}` : "Add a material"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Change its name, unit or page text. The page address stays the same."
              : "Pick one below or type your own. Then add its products — it appears on the site with its first product."}
          </DialogDescription>
        </DialogHeader>

        {!editing && (
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" /> Quick start
            </p>
            <div className="flex flex-wrap gap-2">
              {MATERIAL_PRESETS.map((p) => {
                const used = taken.has(toSlug(p.name));
                return (
                  <button
                    key={p.name}
                    type="button"
                    disabled={used}
                    onClick={() => set({ name: p.name, unit: p.unit, description: p.description, slug: "" })}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition-colors",
                      form.name === p.name ? "border-primary bg-primary text-white" : "hover:border-primary hover:text-primary",
                      used && "cursor-not-allowed opacity-40",
                    )}
                    title={used ? "Already added" : `${p.name} · ${p.unit}`}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="mt-name">Material name</Label>
            <Input id="mt-name" value={form.name} placeholder="Marble" autoFocus={!editing} onChange={(e) => set({ name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mt-unit">Prices are</Label>
            <Input id="mt-unit" list="mt-units" value={form.unit} onChange={(e) => set({ unit: e.target.value })} />
            <datalist id="mt-units">
              {UNITS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="mt-desc">One line about it (optional)</Label>
            <Input id="mt-desc" value={form.description} maxLength={300} placeholder="Shown under the page heading" onChange={(e) => set({ description: e.target.value })} />
          </div>
        </div>

        <ImageField
          label="Photo (optional)"
          hint="Shown on its card on the homepage. Without one, a ready photo of the material is used."
          value={form.image}
          onChange={(url) => set({ image: url })}
          folder="general"
          context={form.name}
          aspect="square"
          allowUrl={false}
        />

        <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-muted-foreground">
          Page: <span className="font-mono text-slate-700">/today-{slug || "…"}-rate-in-pakistan</span>
          {editing ? " (fixed — it may already be ranked)" : ""}
        </div>

        <button type="button" onClick={() => setMore((m) => !m)} className="flex items-center gap-1 text-sm font-medium text-primary">
          <ChevronDown className={cn("h-4 w-4 transition-transform", more && "rotate-180")} />
          {more ? "Hide" : "More options"} — address, search title, page text
        </button>
        {more && (
          <div className="grid gap-4 sm:grid-cols-2">
            {!editing && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="mt-slug">Address word</Label>
                <Input id="mt-slug" value={form.slug} placeholder={toSlug(form.name) || "marble"} onChange={(e) => set({ slug: e.target.value })} />
              </div>
            )}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="mt-title">Search title</Label>
              <Input
                id="mt-title"
                value={form.metaTitle}
                maxLength={120}
                placeholder={`Today ${form.name || "Marble"} Rate in Pakistan ${new Date().getFullYear()}`}
                onChange={(e) => set({ metaTitle: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="mt-mdesc">Search description</Label>
              <Textarea id="mt-mdesc" rows={2} maxLength={300} value={form.metaDescription} onChange={(e) => set({ metaDescription: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="mt-content">Page text below the prices (HTML allowed)</Label>
              <Textarea id="mt-content" rows={5} value={form.content} onChange={(e) => set({ content: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <Switch checked={form.isActive} onCheckedChange={(v) => set({ isActive: v })} /> Show on the site (once it has a product)
            </label>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving || form.name.trim().length < 2}>
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {editing ? "Save" : "Add material"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

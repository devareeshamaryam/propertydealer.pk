"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageField, GalleryField } from "@/components/media";
import { apiErrorMessage } from "@/components/dashboard/api-error";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import materialRateApi from "@/lib/api/material-rate/material-rate.api";
import dynamic from "next/dynamic";

const RichEditor = dynamic(() => import("@/components/RichEditor"), {
  ssr: false,
  loading: () => (
    <div className="h-96 w-full bg-gray-100 animate-pulse rounded-lg flex items-center justify-center text-gray-400">
      Loading Editor...
    </div>
  ),
});

const MATERIAL_TYPES = [
  "Door",
  "Wood",
  "Sand",
  "Tile",
  "Bajri",
  "Steel",
  "Bricks",
];
const UNITS = [
  "Per Unit",
  "Per Sq Ft",
  "Per Cubic Foot",
  "Per Kg",
  "Per Ton",
  "Per Piece",
  "Per Bag",
];

export default function AddMaterialRatePage() {
  const router = useRouter();

  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    materialType: "Door",
    brand: "",
    price: "",
    change: "0",
    city: "",
    category: "",
    unit: "Per Unit",
    description: "",
    isActive: "true",
  });

  // Images are uploaded to the media library as they are chosen, so these
  // hold URLs rather than File objects waiting to be posted.
  const [image, setImage] = useState<string>("");
  const [extraImages, setExtraImages] = useState<string[]>([]);

  const set = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.brand.trim()) return toast.error("Brand name is required");
    if (!form.price || isNaN(Number(form.price)))
      return toast.error("Valid price is required");
    if (!form.city.trim()) return toast.error("City is required");

    try {
      setSubmitting(true);
      const fd = new FormData();
      fd.append("brand", form.brand.trim());
      fd.append("price", form.price);
      fd.append("change", form.change);
      fd.append("city", form.city.trim());
      fd.append("materialType", form.materialType.toLowerCase());
      fd.append("unit", form.unit);
      fd.append("isActive", form.isActive);
      if (form.category.trim()) fd.append("category", form.category.trim());
      fd.append("description", form.description);

      // Already in the media library — post the URLs, not the bytes.
      if (image) fd.append("image", image);
      for (const url of extraImages) fd.append("images", url);

      await materialRateApi.createRate(fd);
      toast.success("Material rate added successfully!");
      router.push("/dashboard/material-rate");
    } catch (err) {
      toast.error("Error", {
        description:
          apiErrorMessage(err, "Failed to create material rate."),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">
          Add Material Rate
        </h1>
        <p className="text-gray-500 text-sm mb-8">
          This will appear as a card on the public Material Rate pages.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ── Material Type ──────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label>Material Type *</Label>
            <Select
              value={form.materialType}
              onValueChange={(v) => set("materialType", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MATERIAL_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/*
            Shared media controls instead of hand-rolled file inputs.

            Each of these forms had its own FileReader preview and no way to
            reuse a picture already on the site. ImageField and GalleryField
            upload through the media library, so every rate photo becomes WebP
            with a readable file name and alt text written for it.
          */}
          <ImageField
            label="Main product image"
            value={image}
            onChange={setImage}
            folder="rates"
            context={form.brand ? `${form.brand} material` : "Material rate"}
            aspect="square"
            hint="Shown as the card image on the public rate page."
          />

          <GalleryField
            label="Additional images"
            value={extraImages}
            onChange={setExtraImages}
            folder="rates"
            context={form.brand ? `${form.brand} material` : "Material rate"}
            max={8}
            hint="Optional — shown in the carousel. Select several at once."
          />

          <div className="space-y-1.5">
            <Label htmlFor="brand">Brand Name *</Label>
            <Input
              id="brand"
              placeholder="e.g. Ch. Steel"
              value={form.brand}
              onChange={(e) => set("brand", e.target.value)}
              required
            />
          </div>

          {/* Price + Change */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="price">Price (Rs) *</Label>
              <Input
                id="price"
                type="number"
                min={0}
                placeholder="e.g. 180000"
                value={form.price}
                onChange={(e) => set("price", e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="change">Daily Price Change</Label>
              <Input
                id="change"
                type="number"
                placeholder="e.g. +500 or -200"
                value={form.change}
                onChange={(e) => set("change", e.target.value)}
              />
              <p className="text-xs text-gray-400">
                Positive = up, Negative = down
              </p>
            </div>
          </div>

          {/* City */}
          <div className="space-y-1.5">
            <Label htmlFor="city">City *</Label>
            <Input
              id="city"
              placeholder="e.g. Lahore"
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
              required
            />
          </div>

          {/* Category + Unit */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="category">
                Category{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </Label>
              <Input
                id="category"
                placeholder="e.g. Structural Steel"
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Select value={form.unit} onValueChange={(v) => set("unit", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Description</Label>
            <RichEditor
              value={form.description}
              onChange={(v) => set("description", v)}
            />
          </div>

          {/* isActive toggle */}
          <div className="flex items-center gap-3">
            <input
              id="isActive"
              type="checkbox"
              checked={form.isActive === "true"}
              onChange={(e) =>
                set("isActive", e.target.checked ? "true" : "false")
              }
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <Label htmlFor="isActive" className="cursor-pointer">
              Active (visible on public pages)
            </Label>
          </div>

          {/* Submit */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Saving…
                </>
              ) : (
                "Save Material Rate"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/dashboard/material-rate")}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

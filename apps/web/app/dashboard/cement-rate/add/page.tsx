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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import cementRateApi from "@/lib/api/cement-rate/cement-rate.api";
import dynamic from "next/dynamic";

const RichEditor = dynamic(() => import("@/components/RichEditor"), {
  ssr: false,
  loading: () => (
    <div className="h-96 w-full bg-gray-100 animate-pulse rounded-lg flex items-center justify-center text-gray-400">
      Loading Editor...
    </div>
  ),
});

const CATEGORIES = [
  "OPC Cement",
  "SRC Cement",
  "White Cement",
  "Sulphate Resistant",
];

export default function AddCementRatePage() {
  const router = useRouter();

  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    brand: "",
    price: "",
    change: "0",
    weightKg: "50",
    category: "OPC Cement",
    description: "",
    metaTitle: "",
    metaDescription: "",
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

    try {
      setSubmitting(true);
      const fd = new FormData();
      fd.append("brand", form.brand.trim());
      fd.append("price", form.price);
      fd.append("change", form.change);
      fd.append("weightKg", form.weightKg);
      fd.append("category", form.category);
      fd.append("description", form.description);
      fd.append("metaTitle", form.metaTitle.trim());
      fd.append("metaDescription", form.metaDescription.trim());

      // Already in the media library — post the URLs, not the bytes.
      if (image) fd.append("image", image);
      for (const url of extraImages) fd.append("images", url);

      await cementRateApi.createRate(fd);
      toast.success("Cement rate added successfully!");
      router.push("/dashboard/cement-rate");
    } catch (err) {
      toast.error("Error", {
        description:
          apiErrorMessage(err, "Failed to create cement rate."),
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
          Add Cement Rate
        </h1>
        <p className="text-gray-500 text-sm mb-8">
          This will appear as a card on the public Cement Rate page.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
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
            context={form.brand ? `${form.brand} cement` : "Cement rate"}
            aspect="square"
            hint="Shown as the card image on the public rate page."
          />

          <GalleryField
            label="Additional images"
            value={extraImages}
            onChange={setExtraImages}
            folder="rates"
            context={form.brand ? `${form.brand} cement` : "Cement rate"}
            max={8}
            hint="Optional — shown in the carousel. Select several at once."
          />

          <div className="space-y-1.5">
            <Label htmlFor="brand">Brand Name *</Label>
            <Input
              id="brand"
              placeholder="e.g. Lucky Cement"
              value={form.brand}
              onChange={(e) => set("brand", e.target.value)}
              required
            />
          </div>

          {/* Price + Change */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="price">Price (Rs per bag) *</Label>
              <Input
                id="price"
                type="number"
                min={0}
                placeholder="e.g. 1300"
                value={form.price}
                onChange={(e) => set("price", e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="change">Price Change Today</Label>
              <Input
                id="change"
                type="number"
                placeholder="e.g. +20 or -10"
                value={form.change}
                onChange={(e) => set("change", e.target.value)}
              />
              <p className="text-xs text-gray-400">
                Positive = up, Negative = down
              </p>
            </div>
          </div>

          {/* Weight */}
          <div className="space-y-1.5">
            <Label htmlFor="weight">Bag Weight (Kg)</Label>
            <Input
              id="weight"
              type="number"
              min={1}
              value={form.weightKg}
              onChange={(e) => set("weightKg", e.target.value)}
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label>Cement Type</Label>
            <Select
              value={form.category}
              onValueChange={(v) => set("category", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Description</Label>
            <RichEditor
              value={form.description}
              onChange={(v) => set("description", v)}
            />
          </div>

          {/* ── SEO Meta Fields ─────────────────────────────────────────── */}
          <div className="border-t pt-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-gray-800">
                SEO Settings
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                These appear in Google search results for this cement brand
                page.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="metaTitle">Meta Title</Label>
              <Input
                id="metaTitle"
                placeholder="e.g. Lucky Cement Price Today in Pakistan – Rs 1300 per bag"
                value={form.metaTitle}
                onChange={(e) => set("metaTitle", e.target.value)}
                maxLength={70}
              />
              <p className="text-xs text-gray-400 flex justify-between">
                <span>Recommended: 50–70 characters</span>
                <span
                  className={form.metaTitle.length > 70 ? "text-red-500" : ""}
                >
                  {form.metaTitle.length}/70
                </span>
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="metaDescription">Meta Description</Label>
              <Textarea
                id="metaDescription"
                placeholder="e.g. Check today's Lucky Cement price in Pakistan. Currently Rs 1300 per 50kg bag. Latest rates updated daily."
                value={form.metaDescription}
                onChange={(e) => set("metaDescription", e.target.value)}
                maxLength={160}
                rows={3}
                className="resize-none"
              />
              <p className="text-xs text-gray-400 flex justify-between">
                <span>Recommended: 120–160 characters</span>
                <span
                  className={
                    form.metaDescription.length > 160 ? "text-red-500" : ""
                  }
                >
                  {form.metaDescription.length}/160
                </span>
              </p>
            </div>
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
                "Save Cement Rate"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/dashboard/cement-rate")}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

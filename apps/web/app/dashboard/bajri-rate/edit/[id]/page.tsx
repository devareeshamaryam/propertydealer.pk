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
import api from "@/lib/api";
import dynamic from "next/dynamic";

const RichEditor = dynamic(() => import("@/components/RichEditor"), {
  ssr: false,
  loading: () => (
    <div className="h-96 w-full bg-gray-100 animate-pulse rounded-lg" />
  ),
});

export default function EditBajriRatePage() {
  const router = useRouter();

  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    brand: "",
    price: "",
    change: "0",
    city: "",
    category: "",
    unit: "",
    description: "",
    isActive: "true",
  });

  // Images are uploaded to the media library as they are chosen, so these
  // hold URLs rather than File objects waiting to be posted.
  const [image, setImage] = useState<string>("");
  const [extraImages, setExtraImages] = useState<string[]>([]);

  const set = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

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
      fd.append("unit", form.unit || "Per Unit");
      fd.append("isActive", form.isActive);
      if (form.category.trim()) fd.append("category", form.category.trim());
      fd.append("description", form.description);

      // Already in the media library — post the URLs, not the bytes.
      if (image) fd.append("image", image);
      for (const url of extraImages) fd.append("images", url);

      await api.post("/bajri-rate", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success("Bajri rate added successfully!");
      router.push("/dashboard/bajri-rate");
    } catch (err) {
      toast.error(
        apiErrorMessage(err, "Failed to create bajri rate"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-3xl space-y-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.back()}
        className="flex items-center gap-1"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </Button>

      <div className="bg-white rounded-xl shadow-sm border p-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">
          Edit Bajri Rate
        </h1>
        <p className="text-gray-500 text-sm mb-8">
          This will appear on the public Bajri Rate page.
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
            context={form.brand ? `${form.brand} bajri` : "Bajri rate"}
            aspect="square"
            hint="Shown as the card image on the public rate page."
          />

          <GalleryField
            label="Additional images"
            value={extraImages}
            onChange={setExtraImages}
            folder="rates"
            context={form.brand ? `${form.brand} bajri` : "Bajri rate"}
            max={8}
            hint="Optional — shown in the carousel. Select several at once."
          />

          <div className="space-y-1.5">
            <Label htmlFor="brand">Brand Name *</Label>
            <Input
              id="brand"
              value={form.brand}
              onChange={(e) => set("brand", e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="price">Price (Rs) *</Label>
              <Input
                id="price"
                type="number"
                min={0}
                value={form.price}
                onChange={(e) => set("price", e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="change">Daily Change</Label>
              <Input
                id="change"
                type="number"
                value={form.change}
                onChange={(e) => set("change", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="city">City *</Label>
            <Input
              id="city"
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unit">Unit</Label>
              <Input
                id="unit"
                placeholder="e.g. Per Sq Ft"
                value={form.unit}
                onChange={(e) => set("unit", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <RichEditor
              value={form.description}
              onChange={(v) => set("description", v)}
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              id="isActive"
              type="checkbox"
              checked={form.isActive === "true"}
              onChange={(e) =>
                set("isActive", e.target.checked ? "true" : "false")
              }
              className="h-4 w-4 rounded"
            />
            <Label htmlFor="isActive" className="cursor-pointer">
              Active (visible on public pages)
            </Label>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving…
                </>
              ) : (
                "Save Bajri Rate"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/dashboard/bajri-rate")}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import api from "@/lib/api";
import { cityApi } from "@/lib/api/city/city.api";
import areaApi from "@/lib/api/area/area.api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataCard, PageHeader, apiErrorMessage } from "@/components/dashboard";
import { toTitleCase } from "@/lib/utils";
import { CityPicker } from "@/components/ui/city-picker";

/**
 * Society Maps → Add map. Pick the city and the area whose listings belong to
 * the society; the page address follows the area's slug, so the map page and
 * the area's listing pages share a name.
 */

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const citySlug = (s: string) => slugify(s);

export default function NewSocietyMapPage() {
  const router = useRouter();
  const [cities, setCities] = useState<{ _id: string; name: string }[]>([]);
  const [areas, setAreas] = useState<{ _id: string; name: string; areaSlug?: string }[]>([]);
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    cityApi
      .getAll()
      .then((r: any) => setCities((Array.isArray(r) ? r : r?.data ?? []).map((c: any) => ({ _id: c._id, name: c.name }))))
      .catch(() => setCities([]));
  }, []);

  useEffect(() => {
    setArea("");
    setAreas([]);
    if (!city) return;
    areaApi.getNames(city).then(setAreas).catch(() => setAreas([]));
  }, [city]);

  const pickArea = (id: string) => {
    setArea(id);
    const a = areas.find((x) => x._id === id);
    if (a) {
      setName((n) => n || toTitleCase(a.name));
      if (!slugTouched) setSlug(a.areaSlug || slugify(a.name));
    }
  };

  const cityName = cities.find((c) => c._id === city)?.name ?? "";

  const submit = async () => {
    if (!city || !name.trim()) {
      toast.error("Choose a city and give the society a name");
      return;
    }
    setSaving(true);
    try {
      const res = await api.post("/admin/society-maps", { city, area: area || undefined, name, slug: slug || undefined });
      toast.success("Map created — now upload the master plan");
      router.push(`/dashboard/society-maps/${res.data.data.id}`);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not create the map"));
      setSaving(false);
    }
  };

  const select = "h-10 w-full rounded-md border border-input bg-white px-3 text-sm";

  return (
    <div className="space-y-6">
      <PageHeader title="Add society map" description="Step 1 of 3: which society. Next you upload the master plan and place it on the satellite map." />
      <DataCard className="max-w-2xl space-y-5 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="city">City</Label>
            <CityPicker id="city" options={cities.map((c) => ({ value: c._id, label: c.name }))} value={city} onChange={setCity} placeholder="Type a city" inputClassName="h-10 w-full rounded-md border border-input bg-background text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="area">Area / society</Label>
            <select id="area" value={area} onChange={(e) => pickArea(e.target.value)} className={select} disabled={!city}>
              <option value="">{city ? "Choose the area" : "Choose a city first"}</option>
              {areas.map((a) => (
                <option key={a._id} value={a._id}>{toTitleCase(a.name)}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">Its listings appear on the map page. Not listed? Add it under Locations → Areas first.</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="name">Society name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. DHA Phase 6" maxLength={120} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="slug">Page address</Label>
          <div className="flex items-center gap-1 text-sm">
            <span className="shrink-0 text-muted-foreground">/emap/{cityName ? citySlug(cityName) : "city"}/</span>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value));
              }}
              placeholder="dha-phase-6"
            />
          </div>
          <p className="text-xs text-muted-foreground">Keep it the same as the area&apos;s slug where you can. Do not change it once the page is published and ranking.</p>
        </div>
        <div className="flex justify-end">
          <Button onClick={() => void submit()} disabled={saving}>
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Create and continue
          </Button>
        </div>
      </DataCard>
    </div>
  );
}

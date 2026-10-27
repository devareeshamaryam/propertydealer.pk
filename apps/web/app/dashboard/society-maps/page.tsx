"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ExternalLink, Loader2, Map as MapIcon, Pencil, Plus, Trash2, Upload } from "lucide-react";
import api from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog, DataCard, PageHeader, apiErrorMessage, useConfirm } from "@/components/dashboard";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";
import { CityPicker } from "@/components/ui/city-picker";

/**
 * Society Maps → All maps. Each row is one society's page on /emap: its
 * master plan images (and whether their tiles are ready), blocks and status.
 */

interface Row {
  id: string;
  name: string;
  slug: string;
  citySlug: string;
  cityName: string;
  status: "draft" | "published";
  thumb: string;
  layers: { name: string; status: string; progress: number }[];
  source?: string;
  kind?: "plan" | "document" | "outline";
  documents?: number;
  plans?: number;
  official?: { authority: string; status: string } | null;
  plots?: number;
  blocks: number;
  updatedAt: string;
}

const TILE_TONE: Record<string, string> = {
  ready: "bg-emerald-50 text-emerald-700",
  processing: "bg-blue-50 text-blue-700",
  queued: "bg-blue-50 text-blue-700",
  failed: "bg-red-50 text-red-700",
  none: "bg-amber-50 text-amber-700",
};

export default function SocietyMapsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [shown, setShown] = useState(100);
  const { confirm, dialogProps } = useConfirm();
  const importRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  /** Maps exported from another copy of the site (.pdmap.json), any number at once. */
  const importMaps = async (files: FileList) => {
    setImporting(true);
    try {
      const form = new FormData();
      for (const f of Array.from(files)) form.append("packages", f);
      const res = await api.post("/admin/society-maps/import", form, { timeout: 30 * 60 * 1000 });
      const rows: { file: string; name?: string; error?: string; skipped?: boolean; reason?: string; tiling?: number }[] = res.data?.data ?? [];
      const ok = rows.filter((r) => !r.error && !r.skipped).length;
      const skipped = rows.filter((r) => r.skipped);
      const failed = rows.filter((r) => r.error);
      toast.success(`${ok} map${ok === 1 ? "" : "s"} imported — tiles are being generated.`);
      if (skipped.length) toast.message(`${skipped.length} already here, left as they are: ${skipped.map((r) => r.name).join(", ")}`);
      for (const f of failed) toast.error(`${f.file}: ${f.error}`);
      void load();
    } catch (e) {
      toast.error(apiErrorMessage(e, "Import failed"));
    } finally {
      setImporting(false);
      if (importRef.current) importRef.current.value = "";
    }
  };

  const load = useCallback(async () => {
    try {
      const res = await api.get("/admin/society-maps");
      setRows(res.data?.data ?? []);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not load the maps"));
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // While anything is being tiled, refresh every few seconds.
  useEffect(() => {
    if (!rows?.some((r) => r.layers.some((l) => l.status === "queued" || l.status === "processing"))) return;
    const t = setInterval(() => void load(), 4000);
    return () => clearInterval(t);
  }, [rows, load]);

  if (user && user.role !== "ADMIN") {
    return <p className="p-6 text-sm text-muted-foreground">Only admins can manage society maps.</p>;
  }

  const list = (rows ?? []).filter(
    (r) =>
      (!q || `${r.name} ${r.cityName} ${r.slug}`.toLowerCase().includes(q.toLowerCase())) &&
      (!cityFilter || r.citySlug === cityFilter) &&
      (!kindFilter || (r.kind ?? "plan") === kindFilter),
  );
  const cities = [...new Map((rows ?? []).map((r) => [r.citySlug, r.cityName])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const SOURCE: Record<string, string> = { osm: "OSM outline", lda: "LDA record", "official-gis": "Official GIS", manual: "Added here" };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Society Maps"
        description="Official master plans laid over the satellite map, with blocks and landmarks. Each one is a page at /emap/<city>/<society>, linked to that area's listings."
        actions={
          <div className="flex gap-2">
            <input
              ref={importRef}
              type="file"
              multiple
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => e.target.files?.length && void importMaps(e.target.files)}
            />
            <Button variant="outline" onClick={() => importRef.current?.click()} disabled={importing}>
              {importing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
              {importing ? "Importing…" : "Import maps"}
            </Button>
            <Button asChild>
              <Link href="/dashboard/society-maps/new">
                <Plus className="mr-1.5 h-4 w-4" /> Add map
              </Link>
            </Button>
          </div>
        }
      />

      <DataCard flush>
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <Input value={q} onChange={(e) => { setQ(e.target.value); setShown(100); }} placeholder="Search by society or city" className="max-w-xs" />
          <CityPicker
            className="w-[200px]"
            options={cities.map(([slug, name]) => ({ value: slug, label: name }))}
            value={cityFilter}
            onChange={(v) => { setCityFilter(v); setShown(100); }}
            allLabel="All cities"
            icon={false}
            inputClassName="h-9 w-full rounded-md border bg-background text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <select value={kindFilter} onChange={(e) => { setKindFilter(e.target.value); setShown(100); }} className="h-9 rounded-md border px-2 text-sm">
            <option value="">All kinds</option>
            <option value="plan">Master plan on map</option>
            <option value="document">Approved layout plan</option>
            <option value="outline">Outline only</option>
          </select>
          {rows && <span className="ml-auto text-xs text-muted-foreground">{list.length.toLocaleString("en-PK")} of {rows.length.toLocaleString("en-PK")} maps</span>}
        </div>
        {rows === null ? (
          <div className="grid place-items-center p-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-12 text-center">
            <MapIcon className="h-8 w-8 text-slate-300" />
            <p className="font-medium">No society maps yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">Add a society, upload its master plan, match a few points to the satellite and publish.</p>
          </div>
        ) : (
          <ul className="divide-y">
            {list.slice(0, shown).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap">
                <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                  {r.thumb && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.thumb} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/dashboard/society-maps/${r.id}`} className="truncate font-semibold hover:text-primary">
                      {r.name}
                    </Link>
                    <Badge variant={r.status === "published" ? "default" : "secondary"}>{r.status === "published" ? "Published" : "Draft"}</Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    /emap/{r.citySlug}/{r.slug} · {r.blocks} blocks · updated {new Date(r.updatedAt).toLocaleDateString("en-PK")}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {r.source && r.source !== "manual" && (
                      <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[11px] font-medium text-violet-700">{SOURCE[r.source] ?? r.source}</span>
                    )}
                    {r.official && (
                      <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", r.official.status === "illegal" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700")}>
                        {r.official.authority}: {r.official.status}
                      </span>
                    )}
                    {!!r.documents && (
                      <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium text-sky-700">
                        Plans {r.plans ?? 0}/{r.documents}{(r.plans ?? 0) < r.documents ? " (fetching)" : ""}
                      </span>
                    )}
                    {!!r.plots && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">{r.plots.toLocaleString("en-PK")} plots</span>}
                    {r.layers.length === 0 ? (
                      r.source && r.source !== "manual" ? null : <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", TILE_TONE.none)}>No image yet</span>
                    ) : (
                      r.layers.map((l, i) => (
                        <span key={i} className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", TILE_TONE[l.status] ?? TILE_TONE.none)}>
                          {l.name}: {l.status === "none" ? "not placed" : l.status === "processing" ? `${l.progress}%` : l.status}
                        </span>
                      ))
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  {r.status === "published" && (
                    <Button variant="ghost" size="icon" asChild>
                      <a href={`/emap/${r.citySlug}/${r.slug}`} target="_blank" rel="noopener" aria-label="View on site">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/dashboard/society-maps/${r.id}`} aria-label="Edit">
                      <Pencil className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete"
                    onClick={() =>
                      confirm({
                        title: `Delete ${r.name}?`,
                        description: "The map page, its images and tiles are removed. Listings are not touched.",
                        confirmLabel: "Delete map",
                        destructive: true,
                        onConfirm: async () => {
                          try {
                            await api.delete(`/admin/society-maps/${r.id}`);
                            toast.success("Map deleted");
                            void load();
                          } catch (e) {
                            toast.error(apiErrorMessage(e, "Could not delete"));
                          }
                        },
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {list.length > shown && (
          <div className="border-t p-3 text-center">
            <Button variant="outline" size="sm" onClick={() => setShown((n) => n + 200)}>
              Show more ({(list.length - shown).toLocaleString("en-PK")} left)
            </Button>
          </div>
        )}
      </DataCard>
      <ConfirmDialog {...dialogProps} />
    </div>
  );
}

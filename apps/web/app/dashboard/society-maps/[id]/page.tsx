"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, ImagePlus, Loader2, Plus, Sparkles, Trash2, Upload } from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog, PageHeader, apiErrorMessage, useConfirm } from "@/components/dashboard";
import { Field, ImageField, SettingsCard, TextField, ToggleRow } from "@/components/dashboard/settings-form";
import { useAuth } from "@/context/auth-context";
import { cityCenter } from "@/lib/map-tiles";
import { cn } from "@/lib/utils";
import type { ControlPoint } from "@/components/society-map/admin/Georeferencer";
import type { EditorBlock, EditorPoi } from "@/components/society-map/admin/ShapeEditor";

const loadingBox = () => <Skeleton className="h-[480px] w-full" />;
const Georeferencer = dynamic(() => import("@/components/society-map/admin/Georeferencer"), { ssr: false, loading: loadingBox });
const ShapeEditor = dynamic(() => import("@/components/society-map/admin/ShapeEditor"), { ssr: false, loading: loadingBox });
const RichEditor = dynamic(() => import("@/components/RichEditor"), { ssr: false, loading: () => <Skeleton className="h-[220px] w-full" /> });

/**
 * Society Maps → one map. Four steps on four tabs:
 *   1. Map images — upload the master plan, match points to the satellite,
 *      then generate the tiles visitors see.
 *   2. Blocks & places — outline, blocks and landmarks, drawn on the plan.
 *   3. Details & SEO — the facts and the page's text, FAQs and meta.
 *   4. Sponsor — an agent's advert on the map, if sold.
 * Then publish.
 */

interface Layer {
  _id: string;
  name: string;
  width: number;
  height: number;
  previewUrl: string;
  previewWidth: number;
  previewHeight: number;
  thumbUrl?: string;
  downloadUrl?: string;
  controlPoints: ControlPoint[];
  corners?: number[][];
  opacity: number;
  visible: boolean;
  order: number;
  residuals?: number[];
  tiles: { status: "none" | "queued" | "processing" | "ready" | "failed"; progress?: number; error?: string; url?: string; bounds?: number[]; minZoom?: number; maxZoom?: number; count?: number; generatedAt?: string };
}

interface Doc {
  _id: string;
  name: string;
  slug: string;
  citySlug: string;
  cityName: string;
  status: "draft" | "published";
  center: { lat: number; lng: number } | null;
  zoom: number;
  boundary: [number, number][];
  layers: Layer[];
  /** Official documents (the LDA approved layout plan, …) — not on the map until aligned as an image. */
  documents?: { title: string; kind?: string; url: string; thumbUrl?: string; source?: string; sourceUrl?: string }[];
  blocks: (EditorBlock & { _id?: string })[];
  pois: (EditorPoi & { _id?: string })[];
  info: { developer?: string; approval?: string; totalArea?: string; launched?: string; possession?: string; plotSizes?: string; amenities?: string[] };
  seo: { metaTitle?: string; metaDescription?: string; intro?: string; content?: string };
  faqs: { q: string; a: string }[];
  sponsor: { enabled: boolean; name?: string; tagline?: string; phone?: string; whatsapp?: string; logoUrl?: string; link?: string };
  downloadEnabled: boolean;
}

const TILE_LABEL: Record<string, string> = {
  none: "Not generated",
  queued: "Waiting…",
  processing: "Generating",
  ready: "Live on the map",
  failed: "Failed",
};

export default function SocietyMapEditor() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [layerId, setLayerId] = useState<string | null>(null);
  const [tab, setTab] = useState("images");
  const [amenity, setAmenity] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [fromDoc, setFromDoc] = useState<number | null>(null);
  const { confirm, dialogProps } = useConfirm();

  const normalise = (d: any): Doc => ({
    ...d,
    blocks: (d.blocks ?? []).map((b: any) => ({ id: b._id, name: b.name, polygon: b.polygon, color: b.color })),
    pois: (d.pois ?? []).map((p: any) => ({ id: p._id, name: p.name, kind: p.kind, lat: p.lat, lng: p.lng })),
    info: d.info ?? {},
    seo: d.seo ?? {},
    faqs: d.faqs ?? [],
    sponsor: d.sponsor ?? { enabled: false },
  });

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/admin/society-maps/${id}`);
      const d = normalise(res.data.data);
      setDoc(d);
      setLayerId((cur) => cur ?? d.layers[0]?._id ?? null);
      setDirty(false);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not load the map"));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // While tiles are being made, keep the layers' status fresh (and only those).
  const busy = doc?.layers.some((l) => l.tiles.status === "queued" || l.tiles.status === "processing");
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(async () => {
      try {
        const res = await api.get(`/admin/society-maps/${id}`);
        const fresh: Layer[] = res.data.data.layers;
        setDoc((d) => (d ? { ...d, layers: d.layers.map((l) => ({ ...l, tiles: fresh.find((f) => f._id === l._id)?.tiles ?? l.tiles, downloadUrl: fresh.find((f) => f._id === l._id)?.downloadUrl ?? l.downloadUrl })) } : d));
        const done = fresh.find((f) => f.tiles.status === "ready" && doc?.layers.find((l) => l._id === f._id)?.tiles.status !== "ready");
        if (done) toast.success(`${done.name}: tiles ready — it is on the map`);
        const failed = fresh.find((f) => f.tiles.status === "failed" && doc?.layers.find((l) => l._id === f._id)?.tiles.status !== "failed");
        if (failed) toast.error(`${failed.name}: ${failed.tiles.error || "tiling failed"}`);
      } catch {
        // try again next tick
      }
    }, 2500);
    return () => clearInterval(t);
  }, [busy, id, doc?.layers]);

  if (user && user.role !== "ADMIN") {
    return <p className="p-6 text-sm text-muted-foreground">Only admins can manage society maps.</p>;
  }
  if (!doc) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-[480px] w-full" />
      </div>
    );
  }

  const set = (patch: Partial<Doc>) => {
    setDoc((d) => (d ? { ...d, ...patch } : d));
    setDirty(true);
  };
  const setLayer = (lid: string, patch: Partial<Layer>) => {
    setDoc((d) => (d ? { ...d, layers: d.layers.map((l) => (l._id === lid ? { ...l, ...patch } : l)) } : d));
    setDirty(true);
  };

  const payload = (d: Doc, status = d.status) => ({
    name: d.name,
    slug: d.slug,
    status,
    center: d.center,
    zoom: d.zoom,
    boundary: d.boundary,
    blocks: d.blocks,
    pois: d.pois,
    info: d.info,
    seo: d.seo,
    faqs: d.faqs.filter((f) => f.q.trim() && f.a.trim()),
    sponsor: d.sponsor,
    downloadEnabled: d.downloadEnabled,
    layers: d.layers.map((l) => ({ id: l._id, name: l.name, opacity: l.opacity, visible: l.visible, order: l.order, controlPoints: l.controlPoints })),
  });

  const save = async (status?: Doc["status"]) => {
    setSaving(true);
    try {
      const res = await api.put(`/admin/society-maps/${id}`, payload(doc, status ?? doc.status));
      setDoc(normalise(res.data.data));
      setDirty(false);
      toast.success(status === "published" ? "Published" : status === "draft" ? "Moved to drafts" : "Saved");
      return true;
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not save"));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const upload = async (file: File) => {
    if (file.size > 80 * 1024 * 1024) {
      toast.error("That file is over 80 MB. Export it smaller (around 8000 px across is plenty).");
      return;
    }
    if (dirty && !(await save())) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("image", file);
      form.append("name", file.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").replace(/\s+\d+$/, "").slice(0, 60));
      const res = await api.post(`/admin/society-maps/${id}/layers`, form, { timeout: 10 * 60 * 1000 });
      const d = normalise(res.data.data);
      setDoc(d);
      setDirty(false);
      setLayerId(d.layers[d.layers.length - 1]?._id ?? null);
      toast.success("Uploaded. Now match a few points to the satellite.");
    } catch (e) {
      toast.error(apiErrorMessage(e, "Upload failed"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  /** An official document becomes a map image, ready for points — nothing is downloaded again. */
  const addDocumentLayer = async (index: number) => {
    if (dirty && !(await save())) return;
    setFromDoc(index);
    try {
      const res = await api.post(`/admin/society-maps/${id}/documents/${index}/layer`, {}, { timeout: 10 * 60 * 1000 });
      const d = normalise(res.data.data);
      setDoc(d);
      setDirty(false);
      setLayerId(d.layers[d.layers.length - 1]?._id ?? null);
      toast.success("Added as a map image. Now match at least 3 points (road crossings, corners) to the satellite, then generate the tiles.");
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not add the document"));
    } finally {
      setFromDoc(null);
    }
  };

  const generate = async (lid: string) => {
    if (!(await save())) return;
    try {
      await api.post(`/admin/society-maps/${id}/layers/${lid}/tiles`);
      setLayer(lid, { tiles: { ...doc.layers.find((l) => l._id === lid)!.tiles, status: "queued", progress: 0 } });
      setDirty(false);
      toast.message("Generating the map tiles — a minute or two for a big plan.");
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not start"));
    }
  };

  const layer = doc.layers.find((l) => l._id === layerId) ?? doc.layers[0];
  const start = doc.center
    ? { lat: doc.center.lat, lng: doc.center.lng, zoom: 16 }
    : (() => {
        const c = cityCenter(doc.cityName);
        return c ? { lat: c[0], lng: c[1], zoom: 12 } : { lat: 30.3753, lng: 69.3451, zoom: 6 };
      })();
  const anyReady = doc.layers.some((l) => l.tiles.status === "ready");
  const pageUrl = `/emap/${doc.citySlug}/${doc.slug}`;

  return (
    <div className="space-y-5">
      <div>
        <Link href="/dashboard/society-maps" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All maps
        </Link>
      </div>
      <PageHeader
        title={doc.name}
        description={`${doc.cityName} · ${pageUrl}`}
        meta={
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", doc.status === "published" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600")}>
            {doc.status === "published" ? "Published" : "Draft"}
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {doc.status === "published" && (
              <Button variant="outline" asChild>
                <a href={pageUrl} target="_blank" rel="noopener">
                  <ExternalLink className="mr-1.5 h-4 w-4" /> View
                </a>
              </Button>
            )}
            <Button
              variant="outline"
              onClick={async () => {
                // A file with this map, its images and points — to load into the live site with "Import maps".
                try {
                  const res = await api.get(`/admin/society-maps/${id}/export`, { responseType: "blob", timeout: 10 * 60 * 1000 });
                  const url = URL.createObjectURL(res.data as Blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${doc.citySlug}-${doc.slug}.pdmap.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                } catch (e) {
                  toast.error(apiErrorMessage(e, "Export failed"));
                }
              }}
            >
              Export
            </Button>
            <Button variant="outline" onClick={() => void save()} disabled={saving || !dirty}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Save
            </Button>
            {doc.status === "published" ? (
              <Button variant="secondary" onClick={() => void save("draft")} disabled={saving}>
                Unpublish
              </Button>
            ) : (
              <Button onClick={() => void save("published")} disabled={saving || !anyReady} title={anyReady ? "" : "Generate the tiles of at least one image first"}>
                Publish
              </Button>
            )}
          </div>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="images">1. Map images</TabsTrigger>
          <TabsTrigger value="shapes">2. Blocks &amp; places</TabsTrigger>
          <TabsTrigger value="details">3. Details &amp; SEO</TabsTrigger>
          <TabsTrigger value="sponsor">4. Sponsor</TabsTrigger>
        </TabsList>

        {/* ── 1. Images ── */}
        <TabsContent value="images" className="mt-4 space-y-4">
          {(doc.documents ?? []).some((d) => d.url) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
              <p className="text-sm font-semibold text-slate-900">Official plans of this society</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Shown on the page as documents. To show one on the map like DHA, add it as a map image, match 3+ points to the satellite and generate the tiles.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(doc.documents ?? []).map((d, i) =>
                  d.url ? (
                    <div key={i} className="flex items-center gap-2 rounded-lg border bg-white p-1.5 pr-2 text-sm">
                      <a href={d.url} target="_blank" rel="noopener" className="h-10 w-14 overflow-hidden rounded-md bg-slate-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={d.thumbUrl || d.url} alt="" className="h-full w-full object-cover" />
                      </a>
                      <span className="max-w-[220px] truncate font-medium" title={d.title}>{d.title || "Plan"}</span>
                      <Button size="sm" variant="outline" disabled={fromDoc !== null || doc.layers.length >= 12} onClick={() => void addDocumentLayer(i)}>
                        {fromDoc === i ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1 h-3.5 w-3.5" />}
                        Put on map
                      </Button>
                    </div>
                  ) : null,
                )}
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {doc.layers.map((l) => (
              <button
                key={l._id}
                type="button"
                onClick={() => setLayerId(l._id)}
                className={cn(
                  "flex items-center gap-2 rounded-xl border p-1.5 pr-3 text-left text-sm transition-colors",
                  layer?._id === l._id ? "border-primary bg-primary/5" : "hover:border-slate-400",
                )}
              >
                <span className="h-10 w-14 overflow-hidden rounded-lg bg-slate-100">
                  {l.thumbUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.thumbUrl} alt="" className="h-full w-full object-cover" />
                  )}
                </span>
                <span>
                  <span className="block font-semibold">{l.name}</span>
                  <span className={cn("block text-xs", l.tiles.status === "ready" ? "text-emerald-600" : l.tiles.status === "failed" ? "text-red-600" : "text-muted-foreground")}>
                    {l.tiles.status === "processing" ? `Generating ${l.tiles.progress ?? 0}%` : TILE_LABEL[l.tiles.status]}
                  </span>
                </span>
              </button>
            ))}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/tiff,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : doc.layers.length ? <Plus className="mr-1.5 h-4 w-4" /> : <ImagePlus className="mr-1.5 h-4 w-4" />}
              {uploading ? "Uploading…" : doc.layers.length ? "Add another image" : "Upload master plan"}
            </Button>
          </div>

          {!layer ? (
            <div className="rounded-xl border border-dashed p-10 text-center">
              <Upload className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 font-medium">Upload the society&apos;s master plan</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                A PDF, JPG, PNG or WebP — the sharper the better (up to 80 MB). For a PDF, the first page is used. Use maps you have the right to publish, such as the developer&apos;s own published plan.
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 rounded-xl border bg-white p-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Image name" htmlFor="lname">
                    <Input id="lname" value={layer.name} onChange={(e) => setLayer(layer._id, { name: e.target.value })} />
                  </Field>
                  <Field label={`Opacity on the site: ${Math.round(layer.opacity * 100)}%`}>
                    <input type="range" min={0.3} max={1} step={0.05} value={layer.opacity} onChange={(e) => setLayer(layer._id, { opacity: Number(e.target.value) })} className="mt-3 w-full" />
                  </Field>
                  <Field label="Size">
                    <p className="pt-2 text-sm text-muted-foreground">
                      {layer.width.toLocaleString()} × {layer.height.toLocaleString()} px
                      {layer.tiles.status === "ready" && ` · ${layer.tiles.count} tiles, zoom ${layer.tiles.minZoom}–${layer.tiles.maxZoom}`}
                    </p>
                  </Field>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() =>
                      confirm({
                        title: `Delete ${layer.name}?`,
                        description: "The image and its tiles are removed from the map.",
                        confirmLabel: "Delete image",
                        destructive: true,
                        onConfirm: async () => {
                          try {
                            const res = await api.delete(`/admin/society-maps/${id}/layers/${layer._id}`);
                            const d = normalise(res.data.data);
                            setDoc(d);
                            setLayerId(d.layers[0]?._id ?? null);
                          } catch (e) {
                            toast.error(apiErrorMessage(e, "Could not delete"));
                          }
                        },
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                  <Button
                    onClick={() => void generate(layer._id)}
                    disabled={layer.controlPoints.length < 3 || layer.tiles.status === "queued" || layer.tiles.status === "processing"}
                  >
                    <Sparkles className="mr-1.5 h-4 w-4" />
                    {layer.tiles.status === "ready" ? "Regenerate tiles" : "Generate tiles"}
                  </Button>
                </div>
                {(layer.tiles.status === "processing" || layer.tiles.status === "queued") && (
                  <div className="sm:col-span-2">
                    <Progress value={layer.tiles.progress ?? 0} />
                  </div>
                )}
                {layer.tiles.status === "failed" && <p className="text-sm text-red-600 sm:col-span-2">{layer.tiles.error}</p>}
                {layer.tiles.status === "ready" && dirty && (
                  <p className="text-sm text-amber-700 sm:col-span-2">Moved points only show on the site after you regenerate the tiles.</p>
                )}
              </div>
              <Georeferencer
                key={layer._id}
                layer={layer}
                points={layer.controlPoints}
                onChange={(points) => setLayer(layer._id, { controlPoints: points })}
                start={start}
              />
            </>
          )}
        </TabsContent>

        {/* ── 2. Shapes ── */}
        <TabsContent value="shapes" className="mt-4">
          {doc.layers.some((l) => l.corners?.length === 4 || l.tiles.status === "ready") ? (
            <ShapeEditor
              layers={doc.layers.filter((l) => l.visible !== false).map((l) => ({ previewUrl: l.previewUrl, corners: l.corners, opacity: l.opacity, tiles: l.tiles }))}
              boundary={doc.boundary}
              blocks={doc.blocks}
              pois={doc.pois}
              center={doc.center ?? { lat: start.lat, lng: start.lng }}
              zoom={doc.center ? doc.zoom || 15 : start.zoom}
              onChange={(patch) => set(patch as Partial<Doc>)}
            />
          ) : (
            <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Place a map image first (step 1, three points) — then draw its blocks on top of it.</p>
          )}
        </TabsContent>

        {/* ── 3. Details ── */}
        <TabsContent value="details" className="mt-4">
          <div className="grid gap-5 xl:grid-cols-2">
            <div className="space-y-5">
              <SettingsCard title="Society">
                <TextField id="name" label="Name" value={doc.name} onChange={(v) => set({ name: v })} maxLength={120} />
                <Field
                  label="Page address"
                  htmlFor="slug"
                  hint={doc.status === "published" ? "Published and possibly ranking — changing this changes the URL. Leave it unless you must." : "Usually the area's slug."}
                >
                  <div className="flex items-center gap-1 text-sm">
                    <span className="shrink-0 text-muted-foreground">/emap/{doc.citySlug}/</span>
                    <Input id="slug" value={doc.slug} onChange={(e) => set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-") })} />
                  </div>
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField id="developer" label="Developer" value={doc.info.developer ?? ""} onChange={(v) => set({ info: { ...doc.info, developer: v } })} placeholder="e.g. Defence Housing Authority" />
                  <TextField id="approval" label="Approval" value={doc.info.approval ?? ""} onChange={(v) => set({ info: { ...doc.info, approval: v } })} placeholder="e.g. LDA approved" />
                  <TextField id="totalArea" label="Total area" value={doc.info.totalArea ?? ""} onChange={(v) => set({ info: { ...doc.info, totalArea: v } })} placeholder="e.g. 12,000 Kanal" />
                  <TextField id="plotSizes" label="Plot sizes" value={doc.info.plotSizes ?? ""} onChange={(v) => set({ info: { ...doc.info, plotSizes: v } })} placeholder="5, 10 Marla, 1 Kanal" />
                  <TextField id="launched" label="Launched" value={doc.info.launched ?? ""} onChange={(v) => set({ info: { ...doc.info, launched: v } })} placeholder="e.g. 2019" />
                  <TextField id="possession" label="Possession" value={doc.info.possession ?? ""} onChange={(v) => set({ info: { ...doc.info, possession: v } })} placeholder="e.g. Blocks A–D available" />
                </div>
                <Field label="Amenities" hint="Press Enter after each one.">
                  <div className="flex flex-wrap gap-1.5">
                    {(doc.info.amenities ?? []).map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => set({ info: { ...doc.info, amenities: (doc.info.amenities ?? []).filter((x) => x !== a) } })}
                        className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-red-50 hover:text-red-600"
                        title="Remove"
                      >
                        {a} ×
                      </button>
                    ))}
                    <Input
                      value={amenity}
                      onChange={(e) => setAmenity(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && amenity.trim()) {
                          e.preventDefault();
                          set({ info: { ...doc.info, amenities: [...new Set([...(doc.info.amenities ?? []), amenity.trim()])] } });
                          setAmenity("");
                        }
                      }}
                      placeholder="Mosque, Park, Gated…"
                      className="h-8 w-44"
                    />
                  </div>
                </Field>
                <ToggleRow
                  label="Allow downloading the map"
                  hint="Visitors get a watermarked JPG of the plan (PropertyDealer.pk across it)."
                  checked={doc.downloadEnabled}
                  onChange={(v) => set({ downloadEnabled: v })}
                />
              </SettingsCard>

              <SettingsCard title="FAQs" description="Shown on the page and marked up for Google's FAQ results.">
                {doc.faqs.map((f, i) => (
                  <div key={i} className="space-y-2 rounded-lg border p-3">
                    <div className="flex gap-2">
                      <Input value={f.q} placeholder="Question" onChange={(e) => set({ faqs: doc.faqs.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)) })} />
                      <Button variant="ghost" size="icon" onClick={() => set({ faqs: doc.faqs.filter((_, j) => j !== i) })} aria-label="Remove question">
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                    <Textarea value={f.a} rows={3} placeholder="Answer" onChange={(e) => set({ faqs: doc.faqs.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)) })} />
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => set({ faqs: [...doc.faqs, { q: "", a: "" }] })}>
                  <Plus className="mr-1 h-4 w-4" /> Add question
                </Button>
              </SettingsCard>
            </div>

            <div className="space-y-5">
              <SettingsCard title="Search & share" description="Empty fields use a good default built from the society's name and listings.">
                <TextField id="metaTitle" label="Page title" value={doc.seo.metaTitle ?? ""} onChange={(v) => set({ seo: { ...doc.seo, metaTitle: v } })} maxLength={80} placeholder={`${doc.name} ${doc.cityName} Map — Blocks, Plots & Location`} hint={`${(doc.seo.metaTitle ?? "").length}/70`} />
                <Field label="Meta description" htmlFor="metaDescription" hint={`${(doc.seo.metaDescription ?? "").length}/160`}>
                  <Textarea id="metaDescription" rows={3} maxLength={200} value={doc.seo.metaDescription ?? ""} onChange={(e) => set({ seo: { ...doc.seo, metaDescription: e.target.value } })} />
                </Field>
                <Field label="Intro" htmlFor="intro" hint="Two or three sentences under the heading.">
                  <Textarea id="intro" rows={3} maxLength={600} value={doc.seo.intro ?? ""} onChange={(e) => set({ seo: { ...doc.seo, intro: e.target.value } })} />
                </Field>
              </SettingsCard>
              <SettingsCard title="Guide" description="The long text under the map: location, access, blocks, prices, development status.">
                <Label className="sr-only">Guide</Label>
                <RichEditor value={doc.seo.content ?? ""} onChange={(v: string) => set({ seo: { ...doc.seo, content: v } })} />
              </SettingsCard>
            </div>
          </div>
        </TabsContent>

        {/* ── 4. Sponsor ── */}
        <TabsContent value="sponsor" className="mt-4">
          <div className="max-w-2xl">
            <SettingsCard title="Sponsor on this map" description="An agency's advert on the map and beside the listings — a slot you can sell per society.">
              <ToggleRow label="Show sponsor" checked={doc.sponsor.enabled} onChange={(v) => set({ sponsor: { ...doc.sponsor, enabled: v } })} />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField id="sName" label="Name" value={doc.sponsor.name ?? ""} onChange={(v) => set({ sponsor: { ...doc.sponsor, name: v } })} placeholder="e.g. Align Estate" />
                <TextField id="sTag" label="Line under the name" value={doc.sponsor.tagline ?? ""} onChange={(v) => set({ sponsor: { ...doc.sponsor, tagline: v } })} placeholder="Plots for sale & purchase" />
                <TextField id="sPhone" label="Phone" value={doc.sponsor.phone ?? ""} onChange={(v) => set({ sponsor: { ...doc.sponsor, phone: v } })} placeholder="0300 1234567" />
                <TextField id="sWa" label="WhatsApp" value={doc.sponsor.whatsapp ?? ""} onChange={(v) => set({ sponsor: { ...doc.sponsor, whatsapp: v } })} placeholder="0300 1234567" />
              </div>
              <ImageField label="Logo" hint="Square, transparent background." value={doc.sponsor.logoUrl ?? ""} onChange={(v) => set({ sponsor: { ...doc.sponsor, logoUrl: v } })} previewClassName="w-16" />
            </SettingsCard>
          </div>
        </TabsContent>
      </Tabs>

      {dirty && (
        <div className="sticky bottom-3 z-10 flex justify-end">
          <div className="flex items-center gap-3 rounded-full border bg-white py-1.5 pl-4 pr-1.5 shadow-lg">
            <span className="text-sm text-muted-foreground">Unsaved changes</span>
            <Button size="sm" className="rounded-full" onClick={() => void save()} disabled={saving}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Save
            </Button>
          </div>
        </div>
      )}
      <ConfirmDialog {...dialogProps} />
    </div>
  );
}

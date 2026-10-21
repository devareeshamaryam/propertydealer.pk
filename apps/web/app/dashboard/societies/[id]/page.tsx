"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Building2,
  CheckCircle2,
  CircleDashed,
  ExternalLink,
  Eye,
  Layers,
  Loader2,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog, DataCard, PageHeader, apiErrorMessage, useConfirm } from "@/components/dashboard";
import { GalleryField, ImageField } from "@/components/media";
import RichEditor from "@/components/RichEditor";
import { societyApi, type SocietyAdmin, type SocietyAreaRow } from "@/lib/api/society.api";
import type { SocietyGuide } from "@/lib/societies";
import { cn, toTitleCase } from "@/lib/utils";

/**
 * One society's guide and its phases (Dashboard → Societies → DHA).
 *
 * Everything on its public guide page is written here; the prices, listing
 * counts and nearby societies come from the live listings by themselves.
 * Phases are the city's other areas placed under the society — their listing
 * pages stay where they are, and the society's pages include them.
 */

const AMENITIES = [
  "Gated community",
  "24/7 security",
  "CCTV surveillance",
  "Underground electricity",
  "Sui gas",
  "Clean water supply",
  "Sewerage system",
  "Carpeted roads",
  "Street lights",
  "Parks & green belts",
  "Mosque",
  "School",
  "Hospital / clinic",
  "Commercial area",
  "Community centre",
  "Gym",
  "Jogging track",
  "Sports complex",
  "Graveyard",
  "Backup power",
];

type Phase = SocietyAreaRow;

function Card({ title, description, children, className }: { title: string; description?: string; children: React.ReactNode; className?: string }) {
  return (
    <DataCard className={cn("space-y-4", className)}>
      <div>
        <p className="font-semibold">{title}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </DataCard>
  );
}

function Text({ id, label, value, onChange, placeholder, hint }: { id: string; label: string; value?: string; onChange: (v: string) => void; placeholder?: string; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function SocietyEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [doc, setDoc] = useState<SocietyAdmin | null>(null);
  const [guide, setGuide] = useState<SocietyGuide>({});
  const [phases, setPhases] = useState<Phase[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [phaseQ, setPhaseQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [amenity, setAmenity] = useState("");
  const { confirm, dialogProps } = useConfirm();

  const apply = (d: SocietyAdmin) => {
    setDoc(d);
    setGuide(d.guide ?? {});
    setPhases(d.phases);
    setDirty(false);
  };

  const load = useCallback(async () => {
    try {
      apply(await societyApi.get(id));
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not load the society"));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Leaving with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = (patch: Partial<SocietyGuide>) => {
    setGuide((g) => ({ ...g, ...patch }));
    setDirty(true);
  };
  const toggleAmenity = (a: string) => {
    setGuide((g) => ({ ...g, amenities: g.amenities?.includes(a) ? g.amenities.filter((x) => x !== a) : [...(g.amenities ?? []), a] }));
    setDirty(true);
  };
  const setPhase = (pid: string, patch: Partial<Phase>) => {
    setPhases((list) => list.map((p) => (p._id === pid ? { ...p, ...patch } : p)));
    setDirty(true);
  };
  const move = (i: number, d: -1 | 1) => {
    setPhases((list) => {
      const next = [...list];
      const j = i + d;
      if (j < 0 || j >= next.length) return list;
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
    setDirty(true);
  };

  const save = async (publish?: boolean) => {
    if (!doc) return;
    const g = publish === undefined ? guide : { ...guide, published: publish };
    if (g.published && !g.image) toast.message("Tip: add a featured photo — it is the guide's cover and the society's card.");
    setSaving(true);
    try {
      const saved = await societyApi.save(doc._id, {
        kind: "society",
        guide: g,
        phases: phases.map((p) => ({ id: p._id, image: p.image, tagline: p.tagline, overview: p.overview })),
      });
      apply(saved);
      toast.success(publish === true ? "Published — the guide is live" : publish === false ? "Unpublished" : "Saved");
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not save"));
    } finally {
      setSaving(false);
    }
  };

  const addExisting = (a: SocietyAreaRow) => {
    setPhases((list) => (list.some((p) => p._id === a._id) ? list : [...list, a]));
    setPhaseQ("");
    setDirty(true);
  };

  const addNew = async () => {
    if (!doc || phaseQ.trim().length < 2) return;
    if (dirty) {
      toast.error("Save your changes first, then add the new phase");
      return;
    }
    setAdding(true);
    try {
      apply(await societyApi.addPhase(doc._id, phaseQ.trim()));
      setPhaseQ("");
      toast.success("Phase added");
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not add the phase"));
    } finally {
      setAdding(false);
    }
  };

  const unmake = () =>
    confirm({
      title: `Turn ${doc ? toTitleCase(doc.name) : "this"} back into a plain area?`,
      description: "Its guide page goes offline and its phases become plain areas again. Listings and listing pages are not touched. The write-up is kept in case you want it back.",
      confirmLabel: "Turn back into an area",
      destructive: true,
      onConfirm: async () => {
        try {
          await societyApi.save(id, { kind: "area" });
          toast.success("It is a plain area again");
          router.push("/dashboard/societies");
        } catch (e) {
          toast.error(apiErrorMessage(e, "Could not change it"));
        }
      },
    });

  const candidates = useMemo(() => {
    if (!doc) return [];
    const t = phaseQ.trim().toLowerCase();
    const taken = new Set(phases.map((p) => p._id));
    return doc.candidates.filter((c) => !taken.has(c._id) && (!t || c.name.toLowerCase().includes(t))).slice(0, t ? 30 : 12);
  }, [doc, phases, phaseQ]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!doc) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <PageHeader title="Society not found" />
        <Button variant="outline" asChild>
          <Link href="/dashboard/societies">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> All societies
          </Link>
        </Button>
      </div>
    );
  }

  const name = toTitleCase(doc.name);
  const live = !!guide.published && doc.kind === "society";
  const publicUrl = `/societies/${doc.citySlug}/${doc.slug}`;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 pb-24">
      <Link href="/dashboard/societies" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All societies
      </Link>
      <PageHeader
        title={`${name}, ${doc.cityName}`}
        description={`${doc.listings} listings here · guide at ${publicUrl}`}
        meta={
          live ? (
            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
              <CheckCircle2 className="mr-1 h-3 w-3" /> Live
            </Badge>
          ) : (
            <Badge variant="secondary">
              <CircleDashed className="mr-1 h-3 w-3" /> {doc.kind === "society" ? "Draft" : "Not a society yet"}
            </Badge>
          )
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {doc.kind === "society" && (
              <Button variant="outline" asChild>
                <Link href={`/dashboard/societies/${doc._id}/preview`}>
                  <Eye className="mr-1.5 h-4 w-4" /> Preview
                </Link>
              </Button>
            )}
            {live && (
              <Button variant="outline" asChild>
                <a href={publicUrl} target="_blank" rel="noopener">
                  <ExternalLink className="mr-1.5 h-4 w-4" /> View live
                </a>
              </Button>
            )}
          </div>
        }
      />

      <Card title="Cover & introduction" description="The featured photo is the guide's cover and the society's card on city pages.">
        <div className="grid gap-4 md:grid-cols-[260px_1fr]">
          <ImageField label="Featured photo" value={guide.image} onChange={(url) => set({ image: url })} folder="areas" context={`${name} ${doc.cityName}`} aspect="wide" />
          <div className="space-y-3">
            <Text id="g-tagline" label="One line about it" value={guide.tagline} onChange={(v) => set({ tagline: v })} placeholder="Gated community on Main Raiwind Road" />
            <Text id="g-address" label="Location" value={guide.address} onChange={(v) => set({ address: v })} placeholder="Main Raiwind Road, 5 km from Thokar Niaz Baig" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Overview</Label>
          <RichEditor value={guide.overview ?? ""} onChange={(v) => set({ overview: v })} placeholder={`What is ${name}? Who built it, where it is, who it suits, how it is laid out…`} minHeight="220px" imageContext={`${name} ${doc.cityName}`} />
        </div>
      </Card>

      <Card title="Key facts" description="Shown beside the overview. Leave out what you do not know.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Text id="g-dev" label="Developer" value={guide.developer} onChange={(v) => set({ developer: v })} placeholder="Habib Rafiq (Pvt) Ltd" />
          <div className="space-y-1.5">
            <Label htmlFor="g-approval">Approval</Label>
            <select
              id="g-approval"
              value={guide.approval ?? ""}
              onChange={(e) => set({ approval: e.target.value as SocietyGuide["approval"] })}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Not shown</option>
              <option value="approved">Approved</option>
              <option value="in-process">Approval in process</option>
              <option value="not-approved">Not approved</option>
            </select>
          </div>
          <Text id="g-by" label="Approved by" value={guide.approvedBy} onChange={(v) => set({ approvedBy: v })} placeholder="LDA, RDA, CDA, MDA…" />
          <Text id="g-area" label="Total area" value={guide.totalArea} onChange={(v) => set({ totalArea: v })} placeholder="12,000 Kanal" />
          <Text id="g-sizes" label="Plot sizes" value={guide.plotSizes} onChange={(v) => set({ plotSizes: v })} placeholder="5 Marla, 10 Marla, 1 Kanal" />
          <Text id="g-launch" label="Launched" value={guide.launched} onChange={(v) => set({ launched: v })} placeholder="2014" />
          <Text id="g-poss" label="Possession" value={guide.possession} onChange={(v) => set({ possession: v })} placeholder="Phase 1 & 2 possession given" />
          <Text id="g-phone" label="Office phone" value={guide.phone} onChange={(v) => set({ phone: v })} placeholder="042 111 000 000" />
          <Text id="g-web" label="Official website" value={guide.website} onChange={(v) => set({ website: v })} placeholder="https://…" />
        </div>
      </Card>

      <Card title="Phases" description="Phases, blocks or sectors of this society — areas of the city placed under it. Each keeps its own listing pages; the society's pages include them all.">
        {phases.length === 0 ? (
          <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">No phases yet. Add them below — e.g. Phase 1, Phase 2…</p>
        ) : (
          <ul className="space-y-2">
            {phases.map((p, i) => (
              <li key={p._id} className="rounded-xl border p-3">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Layers className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium capitalize">{p.name}</span>
                    <span className="block text-xs text-muted-foreground">{p.listings} listings</span>
                  </span>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => move(i, 1)} disabled={i === phases.length - 1} aria-label="Move down">
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      setPhases((list) => list.filter((x) => x._id !== p._id));
                      setDirty(true);
                    }}
                    aria-label="Remove from society"
                  >
                    <X className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-semibold text-primary">Photo &amp; short description (optional)</summary>
                  <div className="mt-3 grid gap-3 md:grid-cols-[200px_1fr]">
                    <ImageField label="Photo" value={p.image} onChange={(url) => setPhase(p._id, { image: url })} folder="areas" context={`${p.name} ${doc.cityName}`} aspect="wide" allowUrl={false} />
                    <div className="space-y-2">
                      <Input value={p.tagline} placeholder="One line — e.g. Possession given, near the main boulevard" onChange={(e) => setPhase(p._id, { tagline: e.target.value })} />
                      <Textarea rows={3} value={p.overview} placeholder="A few lines about this phase" onChange={(e) => setPhase(p._id, { overview: e.target.value })} />
                    </div>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-2 rounded-xl bg-slate-50 p-3">
          <Label htmlFor="phase-q">Add a phase</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="phase-q" value={phaseQ} onChange={(e) => setPhaseQ(e.target.value)} placeholder={`Search ${doc.cityName}'s areas, or type a new name`} className="pl-9" />
            </div>
            {phaseQ.trim().length >= 2 && !candidates.some((c) => c.name.toLowerCase() === phaseQ.trim().toLowerCase()) && (
              <Button variant="outline" onClick={() => void addNew()} disabled={adding}>
                {adding ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />} New
              </Button>
            )}
          </div>
          {candidates.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {candidates.map((c) => (
                <button key={c._id} type="button" onClick={() => addExisting(c)} className="inline-flex items-center gap-1 rounded-full border bg-white px-2.5 py-1 text-[13px] capitalize hover:border-primary hover:text-primary">
                  <Plus className="h-3 w-3" /> {c.name}
                  {c.listings > 0 && <span className="text-[11px] text-muted-foreground">{c.listings}</span>}
                </button>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">Tip: areas already named like “{name} Phase 1” are the ones to pick.</p>
        </div>
      </Card>

      <Card title="Amenities & nearby" description="What is inside the society, and what is close to it.">
        <div className="flex flex-wrap gap-1.5">
          {AMENITIES.map((a) => {
            const on = guide.amenities?.includes(a);
            return (
              <button
                key={a}
                type="button"
                onClick={() => toggleAmenity(a)}
                className={cn("rounded-full border px-3 py-1.5 text-[13px] transition-colors", on ? "border-primary bg-primary text-white" : "bg-white hover:border-primary hover:text-primary")}
              >
                {a}
              </button>
            );
          })}
          {(guide.amenities ?? [])
            .filter((a) => !AMENITIES.includes(a))
            .map((a) => (
              <button key={a} type="button" onClick={() => toggleAmenity(a)} className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary px-3 py-1.5 text-[13px] text-white">
                {a} <X className="h-3 w-3" />
              </button>
            ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={amenity}
            onChange={(e) => setAmenity(e.target.value)}
            placeholder="Another amenity — e.g. Cinema"
            onKeyDown={(e) => {
              if (e.key === "Enter" && amenity.trim()) {
                e.preventDefault();
                set({ amenities: [...new Set([...(guide.amenities ?? []), amenity.trim()])] });
                setAmenity("");
              }
            }}
          />
          <Button
            variant="outline"
            onClick={() => {
              if (!amenity.trim()) return;
              set({ amenities: [...new Set([...(guide.amenities ?? []), amenity.trim()])] });
              setAmenity("");
            }}
          >
            Add
          </Button>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="g-nearby">Nearby — one per line</Label>
          <Textarea
            id="g-nearby"
            rows={4}
            value={(guide.nearby ?? []).join("\n")}
            placeholder={"Ring Road — 5 minutes\nAllama Iqbal International Airport — 20 minutes\nEmporium Mall — 10 minutes"}
            onChange={(e) => set({ nearby: e.target.value.split("\n") })}
          />
        </div>
      </Card>

      <Card title="Photos" description="Gates, parks, the main boulevard, houses — shown as a gallery on the guide.">
        <GalleryField value={guide.gallery ?? []} onChange={(urls) => set({ gallery: urls })} folder="areas" context={`${name} ${doc.cityName}`} max={30} />
      </Card>

      <Card title="Payment plan & booking (optional)">
        <RichEditor value={guide.paymentPlan ?? ""} onChange={(v) => set({ paymentPlan: v })} placeholder="Booking amount, instalments, possession charges…" minHeight="140px" />
      </Card>

      <Card title="Questions people ask" description="Shown as FAQs on the guide — Google can show them in results.">
        <div className="space-y-2">
          {(guide.faqs ?? []).map((f, i) => (
            <div key={i} className="space-y-2 rounded-xl border p-3">
              <div className="flex gap-2">
                <Input
                  value={f.q}
                  placeholder="Is DHA Multan approved?"
                  onChange={(e) => set({ faqs: guide.faqs!.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)) })}
                />
                <Button variant="ghost" size="icon" onClick={() => set({ faqs: guide.faqs!.filter((_, j) => j !== i) })} aria-label="Remove question">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <Textarea rows={2} value={f.a} placeholder="The answer" onChange={(e) => set({ faqs: guide.faqs!.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)) })} />
            </div>
          ))}
          <Button variant="outline" onClick={() => set({ faqs: [...(guide.faqs ?? []), { q: "", a: "" }] })}>
            <Plus className="mr-1.5 h-4 w-4" /> Add a question
          </Button>
        </div>
      </Card>

      <Card title="Search engines (optional)" description="Written for you when empty: “<Society> <City> — Prices, Map, Phases & Guide”.">
        <Text id="g-mt" label="Title" value={guide.metaTitle} onChange={(v) => set({ metaTitle: v })} placeholder={`${name} ${doc.cityName} — Prices, Map, Phases & Guide`} />
        <div className="space-y-1.5">
          <Label htmlFor="g-md">Description</Label>
          <Textarea id="g-md" rows={2} maxLength={300} value={guide.metaDescription ?? ""} onChange={(e) => set({ metaDescription: e.target.value })} />
        </div>
      </Card>

      {doc.kind === "society" && (
        <DataCard className="flex flex-wrap items-center justify-between gap-3 border-destructive/30">
          <div>
            <p className="font-semibold">Not a society?</p>
            <p className="text-xs text-muted-foreground">Turn it back into a plain area. Listings and listing pages stay as they are.</p>
          </div>
          <Button variant="outline" className="text-destructive" onClick={unmake}>
            <Building2 className="mr-1.5 h-4 w-4" /> Turn back into an area
          </Button>
        </DataCard>
      )}

      {/* Save bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 backdrop-blur md:left-[var(--sidebar-width,0px)]">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Switch checked={!!guide.published} onCheckedChange={(v) => set({ published: v })} />
            {guide.published ? "Published" : "Draft"}
          </label>
          <span className="hidden text-xs text-muted-foreground sm:inline">{dirty ? "Unsaved changes" : "All changes saved"}</span>
          <Button className="ml-auto" onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />} Save
          </Button>
        </div>
      </div>

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}

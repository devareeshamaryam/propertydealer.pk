"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, CheckCircle2, CircleDashed, ExternalLink, Layers, Loader2, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DataCard, PageHeader, apiErrorMessage } from "@/components/dashboard";
import { areaApi as areaNamesApi, cityApi } from "@/lib/api";
import areaApi from "@/lib/api/area/area.api";
import { societyApi, type SocietyAdminRow } from "@/lib/api/society.api";
import { cn, toTitleCase } from "@/lib/utils";

/**
 * Dashboard → Locations → Societies.
 *
 * A society is one of the city's areas, marked as a society: its listing
 * pages stay where they are, and it gets a guide page (/societies/<city>/<slug>)
 * with its write-up, prices, phases and map. Its phases are other areas of
 * the city placed under it. Plain localities and mohallas stay areas.
 */
export default function SocietiesPage() {
  const router = useRouter();
  const [rows, setRows] = useState<SocietyAdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await societyApi.list());
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not load the societies"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((r) => !t || r.name.toLowerCase().includes(t) || r.cityName.toLowerCase().includes(t));
  }, [rows, q]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <PageHeader
        title="Societies"
        description="Housing societies with their own guide page — overview, prices by size, phases, map, amenities and FAQs. Their listings stay on the same pages as before."
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Add a society
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["1", "Pick the area", "DHA, Bahria Town, Wapda Town… choose it from the city's areas (or type a new one)."],
          ["2", "Write its guide", "Photo, overview, developer, approval, amenities, FAQs — and put its phases under it."],
          ["3", "Publish", "Its guide goes live, its listing pages show its phases, and the city pages show it."],
        ].map(([n, title, text]) => (
          <DataCard key={n} className="flex gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">{n}</span>
            <span>
              <span className="block text-sm font-semibold">{title}</span>
              <span className="block text-xs text-muted-foreground">{text}</span>
            </span>
          </DataCard>
        ))}
      </div>

      {rows.length > 6 && (
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search societies or cities" className="pl-9" />
        </div>
      )}

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <DataCard className="flex flex-col items-center gap-2 p-10 text-center">
          <Building2 className="h-8 w-8 text-slate-300" />
          <p className="font-medium">No societies yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">Start with the biggest one in your busiest city — DHA or Bahria Town.</p>
          <Button className="mt-2" onClick={() => setAdding(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Add your first society
          </Button>
        </DataCard>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {shown.map((r) => (
            <DataCard key={r._id} flush className="flex flex-col overflow-hidden">
              <Link href={`/dashboard/societies/${r._id}`} className="block aspect-[16/8] overflow-hidden bg-slate-100">
                {r.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.image} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="grid h-full place-items-center text-slate-300">
                    <Building2 className="h-9 w-9" />
                  </span>
                )}
              </Link>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[16px] font-semibold capitalize">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{r.cityName}</p>
                  </div>
                  {r.published ? (
                    <Badge className="shrink-0 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                      <CheckCircle2 className="mr-1 h-3 w-3" /> Live
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="shrink-0">
                      <CircleDashed className="mr-1 h-3 w-3" /> Draft
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {r.listings} {r.listings === 1 ? "listing" : "listings"}
                  <span className="ml-2 inline-flex items-center gap-1">
                    <Layers className="h-3.5 w-3.5" /> {r.phases} {r.phases === 1 ? "phase" : "phases"}
                  </span>
                </p>
                <div className="mt-auto flex flex-wrap gap-2 border-t pt-3">
                  <Button size="sm" asChild>
                    <Link href={`/dashboard/societies/${r._id}`}>Edit guide &amp; phases</Link>
                  </Button>
                  {r.published && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={`/societies/${r.citySlug}/${r.slug}`} target="_blank" rel="noopener">
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> View
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </DataCard>
          ))}
        </div>
      )}

      <AddSocietyDialog open={adding} onOpenChange={setAdding} onPicked={(id) => router.push(`/dashboard/societies/${id}`)} />
    </div>
  );
}

/** Pick a city, then the area that is the society — or type a new one. */
function AddSocietyDialog({ open, onOpenChange, onPicked }: { open: boolean; onOpenChange: (o: boolean) => void; onPicked: (id: string) => void }) {
  const [cities, setCities] = useState<{ _id: string; name: string }[]>([]);
  const [cityId, setCityId] = useState("");
  const [areas, setAreas] = useState<{ _id: string; name: string; kind?: string; parent?: string }[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQ("");
    cityApi
      .getNames()
      .then((c) => setCities([...c].sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => setCities([]));
  }, [open]);

  useEffect(() => {
    if (!cityId) {
      setAreas([]);
      return;
    }
    areaNamesApi
      .getNames(cityId)
      .then(setAreas)
      .catch(() => setAreas([]));
  }, [cityId]);

  const term = q.trim().toLowerCase();
  const matches = areas.filter((a) => a.kind !== "phase" && (!term || a.name.toLowerCase().includes(term))).slice(0, 40);
  const exact = areas.some((a) => a.name.toLowerCase() === term);

  const create = async () => {
    if (!cityId || term.length < 2) return;
    setBusy(true);
    try {
      const a = await areaApi.suggest(cityId, q.trim());
      onPicked(a._id);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not add it"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a society</DialogTitle>
          <DialogDescription>Choose the society from the city&apos;s areas. Its listings and pages stay as they are.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="soc-city">City</Label>
            <select id="soc-city" value={cityId} onChange={(e) => setCityId(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Choose the city</option>
              {cities.map((c) => (
                <option key={c._id} value={c._id}>
                  {toTitleCase(c.name)}
                </option>
              ))}
            </select>
          </div>
          {cityId && (
            <div className="space-y-1.5">
              <Label htmlFor="soc-q">Society</Label>
              <Input id="soc-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="DHA, Bahria Town, Wapda Town…" autoFocus />
              <div className="max-h-64 overflow-y-auto rounded-lg border">
                {matches.map((a) => (
                  <button
                    key={a._id}
                    type="button"
                    onClick={() => onPicked(a._id)}
                    className="flex w-full items-center justify-between gap-2 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-slate-50"
                  >
                    <span className="capitalize">{a.name}</span>
                    {a.kind === "society" && <Badge variant="secondary">Society</Badge>}
                  </button>
                ))}
                {matches.length === 0 && <p className="px-3 py-4 text-center text-sm text-muted-foreground">No area by that name.</p>}
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <span className={cn("text-xs text-muted-foreground", (!cityId || term.length < 2 || exact) && "invisible")}>Not in the list?</span>
          {cityId && term.length >= 2 && !exact && (
            <Button variant="outline" onClick={() => void create()} disabled={busy}>
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />} Add “{q.trim()}”
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

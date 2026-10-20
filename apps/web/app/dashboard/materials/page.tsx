"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, CircleDashed, ExternalLink, Layers, Plus, Tags } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DataCard, PageHeader, apiErrorMessage } from "@/components/dashboard";
import { MaterialTypeDialog } from "@/components/dashboard/material-type-dialog";
import { materialTypeApi } from "@/lib/api/material-type.api";
import type { MaterialTypeAdmin } from "@/lib/materials";

/**
 * Dashboard → Materials: new construction materials without a code change.
 *
 * Three steps, shown on the page: add the material (one tap on Marble, Paint,
 * Glass…), add its products, done — it is then on the site like Cement or
 * Bajri: its rates page, a page per product, the header's Rates menu, the
 * footer, the shop and the Rates Board. A material shows on the site once it
 * has a product on sale.
 */

const BUILT_IN = ["Cement", "Steel", "Bricks", "Sand", "Bajri", "Tiles", "Wood", "Doors"];

export default function MaterialsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<MaterialTypeAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

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

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <PageHeader
        title="Materials"
        description="Add any construction material — it gets its own rates page, product pages, and a place in the menu, footer, shop and Rates Board, like Cement or Bajri."
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Add material
          </Button>
        }
      />

      {/* How it works, in three steps. */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["1", "Add the material", "Tap Marble, Paint, Glass… or type your own, and the unit its prices are in."],
          ["2", "Add its products", "Brand and today's price — a photo if you have one. Change prices later right in the list."],
          ["3", "It's live", "Its page, the Rates menu, the footer, the shop and the Rates Board pick it up by themselves."],
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

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      ) : rows.length === 0 ? (
        <DataCard className="flex flex-col items-center gap-2 p-10 text-center">
          <Layers className="h-8 w-8 text-slate-300" />
          <p className="font-medium">No materials added yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">Start with Marble, Paint or Glass — it takes a minute.</p>
          <Button className="mt-2" onClick={() => setAdding(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Add your first material
          </Button>
        </DataCard>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((r) => (
            <DataCard key={r._id} className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[16px] font-semibold">{r.name}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">{r.path}</p>
                </div>
                {r.live ? (
                  <Badge className="shrink-0 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                    <CheckCircle2 className="mr-1 h-3 w-3" /> On the site
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="shrink-0">
                    <CircleDashed className="mr-1 h-3 w-3" /> {r.isActive ? "Add a product to show it" : "Switched off"}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {r.activeRates} {r.activeRates === 1 ? "product" : "products"} on sale
                {r.rates > r.activeRates ? ` · ${r.rates - r.activeRates} off` : ""} · prices {r.unit.toLowerCase()}
              </p>
              <div className="flex flex-wrap gap-2 border-t pt-3">
                <Button size="sm" asChild>
                  <Link href={`/dashboard/materials/${encodeURIComponent(r.slug)}`}>
                    <Tags className="mr-1.5 h-3.5 w-3.5" /> Products &amp; prices <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </Button>
                {r.live && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={r.path} target="_blank" rel="noopener">
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> View page
                    </a>
                  </Button>
                )}
              </div>
            </DataCard>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Built in, managed under Material Rates: {BUILT_IN.join(", ")}. Materials added here appear after them everywhere.
      </p>

      <MaterialTypeDialog
        open={adding}
        onOpenChange={setAdding}
        existing={rows}
        onSaved={(m) => {
          // Straight on to step 2.
          router.push(`/dashboard/materials/${encodeURIComponent(m.slug)}`);
        }}
      />
    </div>
  );
}

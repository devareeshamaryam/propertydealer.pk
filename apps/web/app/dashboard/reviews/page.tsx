"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, EyeOff, Loader2, RefreshCcw, Star } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DataCard, DataCardTitle, FilterChips, PageHeader, apiErrorMessage } from "@/components/dashboard";
import { agentDisplayName, agentProfilePath } from "@/lib/agent";
import reviewApi, { RELATION_LABELS, type QueueRow } from "@/lib/api/review.api";
import { cn } from "@/lib/utils";

/**
 * Agent reviews waiting for a decision.
 *
 * Most reviews go live by themselves. The ones here were held because of
 * abusive words, a phone number or link, spam, the same text posted on
 * another agent, or a burst of reviews from one account — the reason is on
 * each row, so approving or hiding is a few seconds' decision.
 */

type Filter = "pending" | "flagged" | "published" | "hidden" | "all";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "pending", label: "Waiting" },
  { value: "flagged", label: "Reported by agent" },
  { value: "published", label: "Live" },
  { value: "hidden", label: "Hidden" },
  { value: "all", label: "All" },
];

const when = (iso: string) => new Date(iso).toLocaleString("en-PK", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export default function ReviewsAdminPage() {
  const [filter, setFilter] = useState<Filter>("pending");
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await reviewApi.queue(filter);
      setRows(res.reviews);
      setCounts({ ...res.counts, all: (res.counts.pending ?? 0) + (res.counts.published ?? 0) + (res.counts.hidden ?? 0) });
    } catch (e) {
      setError(apiErrorMessage(e, "Could not load reviews."));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (row: QueueRow, status: "published" | "hidden") => {
    setBusy(row._id);
    try {
      await reviewApi.setStatus(row._id, status);
      toast.success(status === "published" ? "Published" : "Hidden");
      setRows((r) => (filter === "all" ? r.map((x) => (x._id === row._id ? { ...x, status, flagged: false } : x)) : r.filter((x) => x._id !== row._id)));
      setCounts((c) => ({ ...c, [row.status]: Math.max(0, (c[row.status] ?? 1) - 1), [status]: (c[status] ?? 0) + 1, ...(row.flagged ? { flagged: Math.max(0, (c.flagged ?? 1) - 1) } : {}) }));
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not update"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-5">
      <PageHeader
        title="Reviews"
        description="Reviews held for a quick check, and the ones agents have reported. Everything else is already live."
        actions={
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <DataCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <DataCardTitle hint="Newest first">Queue</DataCardTitle>
          <FilterChips<Filter>
            aria-label="Filter reviews"
            value={filter}
            onChange={setFilter}
            options={FILTERS.map((f) => ({ value: f.value, label: f.label, count: counts[f.value] }))}
          />
        </div>

        {loading ? (
          <div className="mt-4 space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm">
            <p className="font-medium text-red-900">{error}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => void load()}>
              Try again
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center">
            <Star className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">{filter === "pending" ? "Nothing waiting — every review is live." : "No reviews here."}</p>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {rows.map((r) => {
              const agentPath = r.agent ? agentProfilePath(r.agent) : null;
              return (
                <li key={r._id} className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-slate-500">
                    <span className="text-[15px] tracking-wide text-amber-500">
                      {"★".repeat(r.rating)}
                      <span className="text-slate-300">{"☆".repeat(5 - r.rating)}</span>
                    </span>
                    <span>
                      by <span className="font-medium text-slate-800">{r.reviewer?.name || "—"}</span>
                      {r.reviewer?.email ? ` (${r.reviewer.email})` : ""}
                    </span>
                    <span>
                      about{" "}
                      {agentPath ? (
                        <Link href={`${agentPath}#reviews`} target="_blank" className="font-medium text-primary hover:underline">
                          {agentDisplayName(r.agent)}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </span>
                    <span>{RELATION_LABELS[r.relation]}</span>
                    <span>{when(r.createdAt)}</span>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[11px] font-semibold",
                        r.status === "pending" ? "bg-amber-100 text-amber-800" : r.status === "hidden" ? "bg-slate-200 text-slate-700" : "bg-emerald-100 text-emerald-800",
                      )}
                    >
                      {r.status === "pending" ? "Waiting" : r.status === "hidden" ? "Hidden" : "Live"}
                    </span>
                  </div>

                  <p className="mt-2 whitespace-pre-line text-[14.5px] text-slate-800">{r.text}</p>
                  {r.property && (
                    <p className="mt-1 text-[12.5px] text-slate-500">
                      Listing:{" "}
                      <Link href={`/properties/${r.property.slug}`} target="_blank" className="text-primary hover:underline">
                        {r.property.title}
                      </Link>
                    </p>
                  )}

                  {(r.holdReasons?.length ?? 0) > 0 && r.status === "pending" && (
                    <p className="mt-2 text-[13px] text-amber-800">Held because: {r.holdReasons!.join(" · ")}</p>
                  )}
                  {r.flagged && <p className="mt-2 text-[13px] text-red-700">Agent reported it: {r.flagReason || "no reason given"}</p>}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.status !== "published" && (
                      <Button size="sm" disabled={busy === r._id} onClick={() => void decide(r, "published")}>
                        {busy === r._id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
                        {r.status === "pending" ? "Approve" : "Publish"}
                      </Button>
                    )}
                    {r.status !== "hidden" && (
                      <Button size="sm" variant="outline" disabled={busy === r._id} onClick={() => void decide(r, "hidden")}>
                        <EyeOff className="mr-1.5 h-4 w-4" /> Hide
                      </Button>
                    )}
                    {r.flagged && r.status === "published" && (
                      <Button size="sm" variant="ghost" disabled={busy === r._id} onClick={() => void decide(r, "published")}>
                        Keep it live
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </DataCard>
    </div>
  );
}

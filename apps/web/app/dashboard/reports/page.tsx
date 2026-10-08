"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Check,
  ExternalLink,
  Flag,
  Loader2,
  RefreshCcw,
  Undo2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import api from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DataCard,
  DataCardTitle,
  FilterChips,
  PageHeader,
  apiErrorMessage,
} from "@/components/dashboard";
import { amountShort } from "@/lib/pk";
import { cn } from "@/lib/utils";

/**
 * What visitors have reported.
 *
 * The useful column is not the single complaint — it is how many a dealer has
 * collected. One person saying "scam" is an argument; four people saying it
 * about the same office is a decision, so each row shows the agent and links
 * to their profile and their listing.
 */

type Status = "open" | "reviewed" | "dismissed";

interface Person {
  _id?: string;
  name?: string;
  email?: string;
  companyName?: string;
  phone?: string;
}

interface ReportRow {
  _id: string;
  type: "listing" | "agent";
  reason: string;
  message?: string;
  status: Status;
  adminNote?: string;
  createdAt?: string;
  reporter?: Person | string;
  reportedUser?: Person | string;
  property?: {
    _id?: string;
    title?: string;
    slug?: string;
    status?: string;
    price?: number;
    location?: string;
  } | string;
}

const STATUS_FILTERS: (Status | "all")[] = ["open", "reviewed", "dismissed", "all"];

const STATUS_STYLES: Record<Status, string> = {
  open: "bg-red-100 text-red-800 hover:bg-red-100",
  reviewed: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  dismissed: "bg-slate-200 text-slate-700 hover:bg-slate-200",
};

function person(value: Person | string | undefined): Person {
  return value && typeof value === "object" ? value : {};
}

function listing(value: ReportRow["property"]) {
  return value && typeof value === "object" ? value : {};
}

function when(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-PK", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ReportsPage() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<Status | "all">("open");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [list, stats] = await Promise.all([
        api.get("/reports", { params: { status, limit: 100 } }),
        api.get("/reports/stats").catch(() => null),
      ]);

      setRows(list.data?.reports ?? []);
      if (stats?.data?.data?.byStatus) {
        setCounts({
          ...stats.data.data.byStatus,
          all: stats.data.data.total,
        });
      }
    } catch (err) {
      setError(apiErrorMessage(err, "Could not load reports."));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const setRowStatus = async (row: ReportRow, next: Status) => {
    try {
      setBusyId(row._id);
      await api.patch(`/reports/${row._id}`, { status: next });

      // Drop it from the list when it no longer matches the filter, rather
      // than reloading and losing the scroll position.
      setRows((previous) =>
        status === "all"
          ? previous.map((item) =>
              item._id === row._id ? { ...item, status: next } : item,
            )
          : previous.filter((item) => item._id !== row._id),
      );

      setCounts((previous) => ({
        ...previous,
        [row.status]: Math.max(0, (previous[row.status] ?? 1) - 1),
        [next]: (previous[next] ?? 0) + 1,
      }));

      toast.success(
        next === "reviewed" ? "Marked as handled" : next === "dismissed" ? "Dismissed" : "Reopened",
      );
    } catch (err) {
      toast.error("Could not update", {
        description: apiErrorMessage(err, "Please try again."),
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-5">
      <PageHeader
        title="Reports"
        description="What visitors have flagged on listings and agent profiles."
        actions={
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <DataCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <DataCardTitle hint="Open ones first">Queue</DataCardTitle>
          <FilterChips<Status | "all">
            aria-label="Filter by status"
            value={status}
            onChange={setStatus}
            options={STATUS_FILTERS.map((value) => ({
              value,
              label: value === "all" ? "All" : value[0]!.toUpperCase() + value.slice(1),
              count: counts[value],
            }))}
          />
        </div>

        {loading ? (
          <div className="mt-4 space-y-3">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-28 w-full rounded-xl" />
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
            <Flag className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">
              {status === "open"
                ? "Nothing reported — nothing to do."
                : "No reports with this status."}
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {rows.map((row) => {
              const reporter = person(row.reporter);
              const against = person(row.reportedUser);
              const item = listing(row.property);
              const busy = busyId === row._id;

              return (
                <li
                  key={row._id}
                  className={cn("rounded-xl border p-4", busy && "opacity-60")}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={STATUS_STYLES[row.status]}>
                          {row.status}
                        </Badge>
                        <Badge variant="outline" className="capitalize">
                          {row.type}
                        </Badge>
                        <span className="text-sm font-semibold">{row.reason}</span>
                      </div>

                      {row.message && (
                        <p className="mt-2 whitespace-pre-line rounded-lg bg-muted/60 px-3 py-2 text-sm">
                          {row.message}
                        </p>
                      )}

                      <div className="mt-2 grid gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
                        {item.title && (
                          <span className="truncate">
                            Listing: <span className="font-medium">{item.title}</span>
                            {typeof item.price === "number" && ` · ${amountShort(item.price)}`}
                          </span>
                        )}
                        {(against.companyName || against.name) && (
                          <span className="truncate">
                            Agent:{" "}
                            <span className="font-medium">
                              {against.companyName || against.name}
                            </span>
                            {against.phone ? ` · ${against.phone}` : ""}
                          </span>
                        )}
                        <span className="truncate">
                          Reported by: {reporter.name || reporter.email || "—"}
                        </span>
                        <span>{when(row.createdAt)}</span>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-3 text-xs">
                        {item.slug && (
                          <Link
                            href={`/properties/${item.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Open listing
                          </Link>
                        )}
                        {item._id && (
                          <Link
                            href={`/dashboard/property/edit/${item._id}`}
                            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                          >
                            Edit listing
                          </Link>
                        )}
                        {against._id && (
                          <Link
                            href={`/agents/${against._id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Agent profile
                          </Link>
                        )}
                        <Link
                          href="/dashboard/users"
                          className="font-medium text-primary hover:underline"
                        >
                          Manage users
                        </Link>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      {row.status === "open" ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void setRowStatus(row, "reviewed")}
                          >
                            {busy ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            Handled
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => void setRowStatus(row, "dismissed")}
                          >
                            <X className="mr-1.5 h-3.5 w-3.5" />
                            Dismiss
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => void setRowStatus(row, "open")}
                        >
                          <Undo2 className="mr-1.5 h-3.5 w-3.5" />
                          Reopen
                        </Button>
                      )}
                    </div>
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

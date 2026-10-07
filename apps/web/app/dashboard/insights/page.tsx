"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Eye,
  ExternalLink,
  Flame,
  MessageCircle,
  Pencil,
  Phone,
  Radio,
  RefreshCcw,
  TrendingUp,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { propertyApi, type ListingPerformance, type ListingPerformanceRow } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import {
  DataCard,
  DataCardTitle,
  PageHeader,
  StatCard,
  apiErrorMessage,
} from "@/components/dashboard";
import { amountShort, propertySizeLabel } from "@/lib/pk";
import { cn } from "@/lib/utils";

/**
 * "Which of my listings is actually working?"
 *
 * Until now the dashboard could only say how many listings existed and what
 * status they were in — nothing about whether anybody looked at them. An agent
 * deciding which listing to re-shoot, re-price or boost had no information at
 * all to decide with.
 *
 * Four numbers per listing, in the order they happen: shown in search →
 * opened → called. The ratios between them are the useful part, so they are
 * worked out here rather than left to the reader.
 */

const SORTS = [
  { key: "views", label: "Most viewed" },
  { key: "contacts", label: "Most contacted" },
  { key: "impressions", label: "Most shown" },
  { key: "newest", label: "Newest" },
] as const;

type SortKey = (typeof SORTS)[number]["key"];

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  pending: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  rejected: "bg-red-100 text-red-800 hover:bg-red-100",
  draft: "bg-slate-200 text-slate-700 hover:bg-slate-200",
};

const STATUS_LABELS: Record<string, string> = {
  approved: "Live",
  pending: "In review",
  rejected: "Rejected",
  draft: "Draft",
};

function percent(part: number, whole: number): string {
  if (!whole) return "—";
  return `${Math.round((part / whole) * 100)}%`;
}

function contactsOf(row: ListingPerformanceRow) {
  return (row.phoneClicks ?? 0) + (row.whatsappClicks ?? 0);
}

/** A small inline metric, repeated per listing. */
function Metric({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: typeof Eye;
  value: number;
  label: string;
  tone?: string;
}) {
  return (
    <span
      title={label}
      className={cn("flex items-center gap-1 tabular-nums", tone ?? "text-muted-foreground")}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {value.toLocaleString("en-PK")}
      <span className="sr-only"> {label}</span>
    </span>
  );
}

export default function InsightsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [data, setData] = useState<ListingPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("views");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setData(await propertyApi.getPerformance());
    } catch (err) {
      console.error("Error loading insights:", err);
      setError(apiErrorMessage(err, "Could not load your listing performance."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    void load();
  }, [authLoading, load]);

  const rows = useMemo(() => {
    const listings = [...(data?.listings ?? [])];
    switch (sort) {
      case "contacts":
        return listings.sort((a, b) => contactsOf(b) - contactsOf(a));
      case "impressions":
        return listings.sort((a, b) => b.impressions - a.impressions);
      case "newest":
        return listings.sort(
          (a, b) =>
            new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
        );
      default:
        return listings.sort((a, b) => b.views - a.views);
    }
  }, [data?.listings, sort]);

  const totals = data?.totals;
  /** Of the people who saw the card in a list, how many opened it. */
  const openRate = totals ? percent(totals.views, totals.impressions) : "—";
  /** Of the people who opened it, how many actually got in touch. */
  const contactRate = totals ? percent(totals.contacts, totals.views) : "—";

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1600px] space-y-5">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5">
      <PageHeader
        title={isAdmin ? "Listing performance" : "My listing performance"}
        description={
          isAdmin
            ? "Views, enquiries and conversion across every listing on the platform."
            : "How many people are seeing your listings, and how many get in touch."
        }
        actions={
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm">
          <p className="font-medium text-red-900">{error}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      )}

      {/* The funnel, in the order it happens. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Shown in search"
          value={(totals?.impressions ?? 0).toLocaleString("en-PK")}
          icon={Radio}
          tone="neutral"
          hint="Times your cards appeared on screen"
        />
        <StatCard
          label="Listing opened"
          value={(totals?.views ?? 0).toLocaleString("en-PK")}
          icon={Eye}
          tone="info"
          hint={`${openRate} of people who saw it`}
        />
        <StatCard
          label="Got in touch"
          value={(totals?.contacts ?? 0).toLocaleString("en-PK")}
          icon={Phone}
          tone="success"
          hint={`${contactRate} of people who opened it`}
        />
        <StatCard
          label="Live listings"
          value={(totals?.active ?? 0).toLocaleString("en-PK")}
          icon={TrendingUp}
          tone="neutral"
          hint={`${totals?.listings ?? 0} in total`}
        />
      </div>

      {/* Per listing */}
      <DataCard>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <DataCardTitle hint="Busiest first — the one to re-price or re-shoot is at the bottom">
            Listing by listing
          </DataCardTitle>

          <div className="flex flex-wrap gap-1.5">
            {SORTS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setSort(option.key)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  sort === option.key
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">
              No listings yet — once one is live, its numbers appear here.
            </p>
            <Button asChild className="mt-4">
              <Link href="/dashboard/property/add-property">Add a property</Link>
            </Button>
          </div>
        ) : (
          <ul className="mt-4 divide-y">
            {rows.map((row) => {
              const contacts = contactsOf(row);
              const best = rows[0]?.views ?? 0;
              const share = best > 0 ? Math.round((row.views / best) * 100) : 0;

              return (
                <li key={row._id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={row.mainPhotoUrl || "/logo.png"}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-lg border bg-muted object-cover"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="min-w-0 truncate text-sm font-semibold">{row.title}</p>
                        <Badge
                          className={cn(
                            "shrink-0",
                            STATUS_STYLES[row.status] ?? "bg-muted text-muted-foreground",
                          )}
                        >
                          {STATUS_LABELS[row.status] ?? row.status}
                        </Badge>
                        {row.views > 0 && row.views === best && (
                          <Badge className="shrink-0 bg-orange-100 text-orange-800 hover:bg-orange-100">
                            <Flame className="mr-1 h-3 w-3" />
                            Top performer
                          </Badge>
                        )}
                      </div>

                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {amountShort(row.price) || "—"}
                        {row.listingType === "rent" ? " / month" : ""} ·{" "}
                        {propertySizeLabel(row)}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                        <Metric icon={Radio} value={row.impressions} label="shown in search" />
                        <Metric icon={Eye} value={row.views} label="opened" tone="text-sky-700" />
                        <Metric icon={Phone} value={row.phoneClicks} label="call taps" />
                        <Metric
                          icon={MessageCircle}
                          value={row.whatsappClicks}
                          label="WhatsApp taps"
                          tone="text-emerald-700"
                        />
                        <span className="text-muted-foreground">
                          {percent(contacts, row.views)} got in touch
                        </span>
                      </div>

                      {/* Where this listing sits against the best one. */}
                      <div className="mt-2 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-sky-500"
                          style={{ width: `${share}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/dashboard/property/edit/${row._id}`}>
                        <Pencil className="mr-1.5 h-3.5 w-3.5" />
                        Edit
                      </Link>
                    </Button>
                    {row.slug && row.status === "approved" && (
                      <Button variant="ghost" size="sm" asChild>
                        <Link
                          href={`/properties/${row.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                          View
                        </Link>
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </DataCard>

      <p className="text-xs text-muted-foreground">
        Counts update within a few seconds of someone looking. A visitor is
        counted once per listing per browsing session, so refreshing a page does
        not inflate the numbers.
      </p>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  CreditCard,
  Loader2,
  RefreshCcw,
} from "lucide-react";
import { toast } from "sonner";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { subscriptionApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  ConfirmDialog,
  DataCard,
  EmptyRow,
  ErrorRow,
  FilterChips,
  NoResultsRow,
  PageHeader,
  PaginationBar,
  TableSkeleton,
  TableToolbar,
  useConfirm,
  useTableControls,
} from "@/components/dashboard";
import { apiErrorMessage } from "@/components/dashboard/api-error";

interface SubscriptionRecord {
  _id: string;
  userId?: { _id?: string; name?: string; email?: string } | string;
  packageId?:
    | { _id?: string; name?: string; propertyLimit?: number; price?: number }
    | string;
  status?: string;
  paymentStatus?: string;
  propertiesUsed?: number;
  createdAt?: string;
  expiresAt?: string;
}

type StatusFilter = "all" | "pending" | "active" | "expired" | "cancelled";

const STATUS_FILTERS: StatusFilter[] = [
  "all",
  "pending",
  "active",
  "expired",
  "cancelled",
];

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  pending: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  expired: "bg-slate-200 text-slate-700 hover:bg-slate-200",
  cancelled: "bg-red-100 text-red-800 hover:bg-red-100",
};

const COLUMN_COUNT = 7;

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-PK", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function userOf(sub: SubscriptionRecord) {
  if (sub.userId && typeof sub.userId === "object") return sub.userId;
  return undefined;
}

function packageOf(sub: SubscriptionRecord) {
  if (sub.packageId && typeof sub.packageId === "object") return sub.packageId;
  return undefined;
}

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const { confirm, dialogProps } = useConfirm();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await subscriptionApi.getAll();
      setSubscriptions(Array.isArray(data) ? data : []);
    } catch (err) {
      // Previously the failure was only logged to the console, so the page
      // rendered an empty table with no indication anything went wrong.
      console.error("Error fetching subscriptions:", err);
      setError(
        apiErrorMessage(
          err,
          "Could not load subscriptions. Check your connection and try again.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: subscriptions.length };
    for (const sub of subscriptions) {
      const status = sub.status ?? "pending";
      counts[status] = (counts[status] ?? 0) + 1;
    }
    return counts;
  }, [subscriptions]);

  const rowFilter = useCallback(
    (sub: SubscriptionRecord) =>
      statusFilter === "all" || sub.status === statusFilter,
    [statusFilter],
  );

  const searchAccessor = useCallback(
    (sub: SubscriptionRecord) => [
      userOf(sub)?.name,
      userOf(sub)?.email,
      packageOf(sub)?.name,
      sub.status,
      sub.paymentStatus,
    ],
    [],
  );

  const table = useTableControls<SubscriptionRecord>({
    data: subscriptions,
    searchAccessor,
    filter: rowFilter,
    initialPageSize: 25,
    initialSortKey: "createdAt",
    initialSortDirection: "desc",
  });

  useEffect(() => {
    table.setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const requestActivate = (sub: SubscriptionRecord) => {
    const who = userOf(sub)?.name ?? userOf(sub)?.email ?? "this user";
    const plan = packageOf(sub)?.name ?? "the package";
    confirm({
      title: "Activate this subscription?",
      description: `${who} will get immediate access to ${plan}.`,
      confirmLabel: "Activate",
      destructive: false,
      onConfirm: async () => {
        try {
          setBusyId(sub._id);
          await subscriptionApi.activate(sub._id);
          setSubscriptions((previous) =>
            previous.map((item) =>
              item._id === sub._id ? { ...item, status: "active" } : item,
            ),
          );
          toast.success("Subscription activated");
        } catch (err) {
          // The old handler used window.alert() here.
          console.error("Error activating subscription:", err);
          toast.error("Could not activate subscription", {
            description: apiErrorMessage(err, "Please try again."),
          });
        } finally {
          setBusyId(null);
        }
      },
    });
  };

  const SortButton = ({
    column,
    children,
  }: {
    column: keyof SubscriptionRecord;
    children: React.ReactNode;
  }) => {
    const active = table.sortKey === column;
    const Icon = !active
      ? ArrowUpDown
      : table.sortDirection === "asc"
        ? ArrowUp
        : ArrowDown;
    return (
      <button
        type="button"
        onClick={() => table.toggleSort(column)}
        className={cn(
          "-ml-2 inline-flex items-center gap-1.5 rounded px-2 py-1 font-medium transition-colors hover:bg-accent",
          active && "text-foreground",
        )}
      >
        {children}
        <Icon
          className={cn("h-3.5 w-3.5", active ? "opacity-100" : "opacity-40")}
        />
      </button>
    );
  };

  const pendingCount = statusCounts.pending ?? 0;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5">
      <PageHeader
        title="Subscriptions"
        description="Approve subscription requests and track plan usage."
        meta={
          !loading &&
          pendingCount > 0 && (
            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
              {pendingCount} awaiting activation
            </Badge>
          )
        }
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCcw
                className={cn("mr-2 h-4 w-4", loading && "animate-spin")}
              />
              Refresh
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/packages">Manage Packages</Link>
            </Button>
          </>
        }
      />

      <DataCard flush>
        <div className="space-y-4 border-b p-5">
          <TableToolbar
            search={table.search}
            onSearchChange={table.setSearch}
            placeholder="Search by user, email or package…"
          />
          <FilterChips<StatusFilter>
            aria-label="Filter by status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_FILTERS.map((status) => ({
              value: status,
              label: status.charAt(0).toUpperCase() + status.slice(1),
              count: statusCounts[status] ?? 0,
            }))}
          />
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[220px]">User</TableHead>
                <TableHead>Package</TableHead>
                <TableHead>
                  <SortButton column="status">Status</SortButton>
                </TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="min-w-[160px]">Listings used</TableHead>
                <TableHead className="whitespace-nowrap">
                  <SortButton column="createdAt">Requested</SortButton>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableSkeleton rows={8} columns={COLUMN_COUNT} />
              ) : error ? (
                <ErrorRow
                  colSpan={COLUMN_COUNT}
                  message={error}
                  onRetry={() => void load()}
                />
              ) : subscriptions.length === 0 ? (
                <EmptyRow
                  colSpan={COLUMN_COUNT}
                  icon={CreditCard}
                  title="No subscriptions yet"
                  description="Requests appear here once agents buy a package."
                />
              ) : table.matchedCount === 0 ? (
                <NoResultsRow
                  colSpan={COLUMN_COUNT}
                  search={table.search}
                  onReset={() => {
                    setStatusFilter("all");
                    table.resetFilters();
                  }}
                />
              ) : (
                table.rows.map((sub) => {
                  const busy = busyId === sub._id;
                  const owner = userOf(sub);
                  const plan = packageOf(sub);
                  const used = sub.propertiesUsed ?? 0;
                  const limit = plan?.propertyLimit;
                  const percent =
                    typeof limit === "number" && limit > 0
                      ? Math.min(100, Math.round((used / limit) * 100))
                      : null;
                  return (
                    <TableRow
                      key={sub._id}
                      className={cn(busy && "opacity-60")}
                    >
                      <TableCell>
                        <p className="font-medium">
                          {owner?.name ?? "Unknown user"}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          {owner?.email ?? "—"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{plan?.name ?? "—"}</p>
                        {typeof plan?.price === "number" && (
                          <p className="text-xs text-muted-foreground tabular-nums">
                            Rs {plan.price.toLocaleString("en-PK")}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            STATUS_STYLES[sub.status ?? ""] ??
                            "bg-muted text-muted-foreground"
                          }
                        >
                          {(sub.status ?? "unknown").charAt(0).toUpperCase() +
                            (sub.status ?? "unknown").slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {sub.paymentStatus ? (
                          <Badge variant="outline" className="capitalize">
                            {sub.paymentStatus}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-sm tabular-nums">
                            {used}
                            {typeof limit === "number" ? ` / ${limit}` : ""}
                          </span>
                          {percent !== null && (
                            <Progress value={percent} className="h-1.5 w-16" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDate(sub.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        {sub.status === "pending" ? (
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() => requestActivate(sub)}
                          >
                            {busy ? (
                              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="mr-2 h-3.5 w-3.5" />
                            )}
                            Activate
                          </Button>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {!loading && !error && table.matchedCount > 0 && (
          <div className="p-5 pt-0">
            <PaginationBar
              page={table.page}
              totalPages={table.totalPages}
              pageSize={table.pageSize}
              fromIndex={table.fromIndex}
              toIndex={table.toIndex}
              matchedCount={table.matchedCount}
              itemLabel="subscriptions"
              onPageChange={table.setPage}
              onPageSizeChange={table.setPageSize}
            />
          </div>
        )}
      </DataCard>

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}

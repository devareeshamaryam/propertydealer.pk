"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Mail,
  MapPin,
  Phone,
  RefreshCcw,
  ShoppingCart,
} from "lucide-react";

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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import cementOrderApi, {
  type CementOrderData,
} from "@/lib/api/cement-order/cement-order.api";
import { cn } from "@/lib/utils";
import {
  DataCard,
  EmptyRow,
  ErrorRow,
  FilterChips,
  NoResultsRow,
  PageHeader,
  PaginationBar,
  TableSkeleton,
  TableToolbar,
  useTableControls,
} from "@/components/dashboard";
import { apiErrorMessage } from "@/components/dashboard/api-error";

type StatusFilter = "all" | "PENDING" | "COMPLETED" | "CANCELLED";

const STATUS_FILTERS: StatusFilter[] = [
  "all",
  "PENDING",
  "COMPLETED",
  "CANCELLED",
];

const STATUS_STYLES: Record<string, string> = {
  COMPLETED: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  PENDING: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  CANCELLED: "bg-red-100 text-red-800 hover:bg-red-100",
};

const COLUMN_COUNT = 6;

function formatDateTime(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-PK", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CementOrdersPage() {
  const [orders, setOrders] = useState<CementOrderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await cementOrderApi.getAllOrders();
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching cement orders:", err);
      setError(
        apiErrorMessage(
          err,
          "Could not load cement orders. Check your connection and try again.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    const counts: Record<string, number> = { all: orders.length };
    let revenue = 0;
    for (const order of orders) {
      const status = order.status ?? "PENDING";
      counts[status] = (counts[status] ?? 0) + 1;
      if (status === "COMPLETED") revenue += order.total ?? 0;
    }
    return { counts, revenue };
  }, [orders]);

  const rowFilter = useCallback(
    (order: CementOrderData) =>
      statusFilter === "all" || order.status === statusFilter,
    [statusFilter],
  );

  const searchAccessor = useCallback(
    (order: CementOrderData) => [
      order.customerName,
      order.customerPhone,
      order.customerEmail,
      order.address,
      ...(order.items ?? []).map((item) => item.brand),
    ],
    [],
  );

  const table = useTableControls<CementOrderData>({
    data: orders,
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

  const SortButton = ({
    column,
    children,
  }: {
    column: keyof CementOrderData;
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

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5">
      <PageHeader
        title="Cement Orders"
        description="Orders placed by customers from the public cement rate page."
        meta={
          !loading && (
            <>
              <Badge variant="outline">{summary.counts.all} orders</Badge>
              {(summary.counts.PENDING ?? 0) > 0 && (
                <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                  {summary.counts.PENDING} pending
                </Badge>
              )}
              {summary.revenue > 0 && (
                <Badge variant="outline">
                  Rs {summary.revenue.toLocaleString("en-PK")} completed
                </Badge>
              )}
            </>
          )
        }
        actions={
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
        }
      />

      <DataCard flush>
        <div className="space-y-4 border-b p-5">
          <TableToolbar
            search={table.search}
            onSearchChange={table.setSearch}
            placeholder="Search by customer, phone, address or brand…"
          />
          <FilterChips<StatusFilter>
            aria-label="Filter by status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_FILTERS.map((status) => ({
              value: status,
              label:
                status === "all"
                  ? "All"
                  : status.charAt(0) + status.slice(1).toLowerCase(),
              count: summary.counts[status] ?? 0,
            }))}
          />
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[160px]">
                  <SortButton column="customerName">Customer</SortButton>
                </TableHead>
                <TableHead className="min-w-[220px]">Contact</TableHead>
                <TableHead className="min-w-[200px]">Items</TableHead>
                <TableHead>
                  <SortButton column="total">Total</SortButton>
                </TableHead>
                <TableHead>
                  <SortButton column="status">Status</SortButton>
                </TableHead>
                <TableHead className="whitespace-nowrap">
                  <SortButton column="createdAt">Placed</SortButton>
                </TableHead>
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
              ) : orders.length === 0 ? (
                <EmptyRow
                  colSpan={COLUMN_COUNT}
                  icon={ShoppingCart}
                  title="No orders yet"
                  description="Orders placed from the public cement rate page will appear here."
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
                table.rows.map((order) => {
                  const items = order.items ?? [];
                  return (
                    <TableRow key={order._id}>
                      <TableCell className="font-medium">
                        {order.customerName || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          {order.customerPhone && (
                            <a
                              href={`tel:${order.customerPhone}`}
                              className="flex items-center gap-1.5 font-medium hover:text-primary"
                            >
                              <Phone className="h-3 w-3 shrink-0" />
                              {order.customerPhone}
                            </a>
                          )}
                          {order.customerEmail && (
                            <a
                              href={`mailto:${order.customerEmail}`}
                              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
                            >
                              <Mail className="h-3 w-3 shrink-0" />
                              <span className="truncate">
                                {order.customerEmail}
                              </span>
                            </a>
                          )}
                          {order.address && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <p className="flex max-w-[220px] items-center gap-1.5 text-xs text-muted-foreground">
                                  <MapPin className="h-3 w-3 shrink-0" />
                                  <span className="truncate">
                                    {order.address}
                                  </span>
                                </p>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                {order.address}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">
                          {items.length}{" "}
                          {items.length === 1 ? "product" : "products"}
                        </p>
                        <p className="max-w-[220px] truncate text-xs text-muted-foreground">
                          {items
                            .map((item) => `${item.quantity}× ${item.brand}`)
                            .join(", ") || "—"}
                        </p>
                      </TableCell>
                      <TableCell className="font-semibold tabular-nums">
                        Rs {order.total?.toLocaleString("en-PK") ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            STATUS_STYLES[order.status ?? ""] ??
                            "bg-muted text-muted-foreground"
                          }
                        >
                          {order.status ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDateTime(order.createdAt)}
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
              itemLabel="orders"
              onPageChange={table.setPage}
              onPageSizeChange={table.setPageSize}
            />
          </div>
        )}
      </DataCard>
    </div>
  );
}

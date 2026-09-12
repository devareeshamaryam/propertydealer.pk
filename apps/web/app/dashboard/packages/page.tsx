"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  Package2,
  PlusCircle,
  RefreshCcw,
  ShoppingCart,
  SquarePen,
  Trash2,
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { packageApi } from "@/lib/api";
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

interface PackageRecord {
  _id: string;
  name: string;
  description?: string;
  price: number;
  duration: number;
  propertyLimit?: number;
  featuredListings?: number;
  photosPerProperty?: number;
  isActive?: boolean;
  features?: string[];
}

type StatusFilter = "all" | "active" | "inactive";

const STATUS_FILTERS: StatusFilter[] = ["all", "active", "inactive"];
const COLUMN_COUNT = 7;

export default function PackagesPage() {
  const [packages, setPackages] = useState<PackageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const { confirm, dialogProps } = useConfirm();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await packageApi.getAllIncludingInactive();
      setPackages(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching packages:", err);
      setError(
        apiErrorMessage(
          err,
          "Could not load packages. Check your connection and try again.",
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
    let active = 0;
    for (const pkg of packages) {
      if (pkg.isActive !== false) active += 1;
    }
    return { all: packages.length, active, inactive: packages.length - active };
  }, [packages]);

  const rowFilter = useCallback(
    (pkg: PackageRecord) => {
      const isActive = pkg.isActive !== false;
      if (statusFilter === "active" && !isActive) return false;
      if (statusFilter === "inactive" && isActive) return false;
      return true;
    },
    [statusFilter],
  );

  const table = useTableControls<PackageRecord>({
    data: packages,
    searchKeys: ["name", "description"],
    filter: rowFilter,
    initialPageSize: 25,
    initialSortKey: "price",
    initialSortDirection: "asc",
  });

  useEffect(() => {
    table.setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const requestDelete = (pkg: PackageRecord) =>
    confirm({
      title: "Delete this package?",
      description: `“${pkg.name}” will be removed from the pricing page. Existing subscriptions are not affected.`,
      confirmLabel: "Delete package",
      onConfirm: async () => {
        try {
          setBusyId(pkg._id);
          await packageApi.delete(pkg._id);
          setPackages((previous) =>
            previous.filter((item) => item._id !== pkg._id),
          );
          toast.success("Package deleted");
        } catch (err) {
          console.error("Error deleting package:", err);
          toast.error("Could not delete package", {
            description: apiErrorMessage(err, "Please try again."),
          });
        } finally {
          setBusyId(null);
        }
      },
    });

  const SortButton = ({
    column,
    children,
  }: {
    column: keyof PackageRecord;
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

  const addButton = (
    <Button asChild>
      <Link href="/dashboard/packages/add">
        <PlusCircle className="mr-2 h-4 w-4" />
        Add Package
      </Link>
    </Button>
  );

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5">
      <PageHeader
        title="Packages"
        description="Subscription plans agents can buy to list properties."
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
              <Link href="/dashboard/subscriptions">View Subscriptions</Link>
            </Button>
            {addButton}
          </>
        }
      />

      <DataCard flush>
        <div className="space-y-4 border-b p-5">
          <TableToolbar
            search={table.search}
            onSearchChange={table.setSearch}
            placeholder="Search by package name…"
          />
          <FilterChips<StatusFilter>
            aria-label="Filter by status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_FILTERS.map((status) => ({
              value: status,
              label: status.charAt(0).toUpperCase() + status.slice(1),
              count: statusCounts[status],
            }))}
          />
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[220px]">
                  <SortButton column="name">Package</SortButton>
                </TableHead>
                <TableHead>
                  <SortButton column="price">Price</SortButton>
                </TableHead>
                <TableHead>
                  <SortButton column="duration">Duration</SortButton>
                </TableHead>
                <TableHead>
                  <SortButton column="propertyLimit">Listings</SortButton>
                </TableHead>
                <TableHead>Featured</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableSkeleton rows={6} columns={COLUMN_COUNT} />
              ) : error ? (
                <ErrorRow
                  colSpan={COLUMN_COUNT}
                  message={error}
                  onRetry={() => void load()}
                />
              ) : packages.length === 0 ? (
                <EmptyRow
                  colSpan={COLUMN_COUNT}
                  icon={Package2}
                  title="No packages yet"
                  description="Create a plan so agents have something to subscribe to."
                  action={addButton}
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
                table.rows.map((pkg) => {
                  const busy = busyId === pkg._id;
                  return (
                    <TableRow
                      key={pkg._id}
                      className={cn(busy && "opacity-60")}
                    >
                      <TableCell>
                        <p className="font-medium">{pkg.name}</p>
                        {pkg.description && (
                          <p className="mt-0.5 max-w-[280px] truncate text-xs text-muted-foreground">
                            {pkg.description}
                          </p>
                        )}
                        {(pkg.features?.length ?? 0) > 0 && (
                          <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Check className="h-3 w-3" />
                            {pkg.features?.length} features
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="font-semibold tabular-nums">
                        Rs {pkg.price?.toLocaleString("en-PK") ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {pkg.duration} days
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground tabular-nums">
                        {pkg.propertyLimit ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground tabular-nums">
                        {pkg.featuredListings ?? 0}
                      </TableCell>
                      <TableCell>
                        {pkg.isActive !== false ? (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                asChild
                              >
                                <Link
                                  href={`/dashboard/purchase-package?packageId=${pkg._id}`}
                                >
                                  <ShoppingCart className="h-4 w-4" />
                                  <span className="sr-only">Purchase</span>
                                </Link>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Purchase for a user</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                asChild
                              >
                                <Link
                                  href={`/dashboard/packages/${pkg._id}/edit`}
                                >
                                  <SquarePen className="h-4 w-4" />
                                  <span className="sr-only">Edit</span>
                                </Link>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                disabled={busy}
                                onClick={() => requestDelete(pkg)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                          </Tooltip>
                        </div>
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
              itemLabel="packages"
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

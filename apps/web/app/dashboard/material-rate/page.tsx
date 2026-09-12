"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Info,
  Minus,
  Package,
  PlusCircle,
  RefreshCcw,
  SquarePen,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
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
import materialRateApi, {
  type MaterialRateData,
} from "@/lib/api/material-rate/material-rate.api";
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

const MATERIAL_TYPES = [
  "All",
  "Door",
  "Wood",
  "Sand",
  "Tile",
  "Bajri",
  "Steel",
  "Bricks",
] as const;

type MaterialType = (typeof MATERIAL_TYPES)[number];

const COLUMN_COUNT = 9;

function ChangeIndicator({ change }: { change?: number }) {
  if (!change) {
    return (
      <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <Minus className="h-3 w-3" />0
      </span>
    );
  }
  if (change > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600">
        <TrendingUp className="h-3 w-3" />+{change.toLocaleString("en-PK")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-sm font-medium text-red-600">
      <TrendingDown className="h-3 w-3" />
      {change.toLocaleString("en-PK")}
    </span>
  );
}

export default function MaterialRatesPage() {
  const [rates, setRates] = useState<MaterialRateData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [materialType, setMaterialType] = useState<MaterialType>("All");
  const [busyId, setBusyId] = useState<string | null>(null);

  const { confirm, dialogProps } = useConfirm();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const type =
        materialType === "All" ? undefined : materialType.toLowerCase();
      const data = await materialRateApi.getAllRates(type);
      setRates(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching material rates:", err);
      setError(
        apiErrorMessage(
          err,
          "Could not load material rates. Check your connection and try again.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [materialType]);

  useEffect(() => {
    void load();
  }, [load]);

  // The type filter is applied server-side, so counts are per fetched page.
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const rate of rates) {
      const key = (rate.materialType ?? "").toLowerCase();
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [rates]);

  const table = useTableControls<MaterialRateData>({
    data: rates,
    searchKeys: ["brand", "city", "category", "unit", "materialType"],
    initialPageSize: 10,
    initialSortKey: "createdAt",
    initialSortDirection: "desc",
  });

  const requestDelete = (rate: MaterialRateData) =>
    confirm({
      title: "Delete this material rate?",
      description: `“${rate.brand}” will be permanently removed.`,
      confirmLabel: "Delete",
      onConfirm: async () => {
        try {
          setBusyId(rate._id ?? null);
          await materialRateApi.deleteRate(rate._id!);
          setRates((previous) =>
            previous.filter((item) => item._id !== rate._id),
          );
          toast.success("Material rate deleted");
        } catch (err) {
          toast.error("Could not delete", {
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
    column: keyof MaterialRateData;
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
      <Link href="/dashboard/material-rate/add">
        <PlusCircle className="mr-2 h-4 w-4" />
        Add Material Rate
      </Link>
    </Button>
  );

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5">
      <PageHeader
        title="Material Rates (Unified)"
        description="A single collection covering all seven material types."
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
            {addButton}
          </>
        }
      />

      {/*
        This screen writes to the `materialrates` collection, but every public
        rate page still reads its own per-material endpoint (/door-rate,
        /steel-rate, …). Rates entered here therefore do not appear on the
        website. Kept reachable so existing records stay visible and editable —
        see the audit notes for the consolidation plan.
      */}
      <div className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <Info className="mt-0.5 h-4.5 w-4.5 shrink-0 text-blue-600" />
        <div className="space-y-1">
          <p className="font-medium">
            This is the unified rates table — the public website does not read
            from it yet.
          </p>
          <p className="text-blue-800">
            Public rate pages are served from the individual material endpoints.
            To publish a rate visitors will see, use the matching page under{" "}
            <span className="font-medium">Material Rates</span> in the sidebar
            (Cement, Bricks, Sand, Bajri, Steel, Wood, Doors, Tiles).
          </p>
        </div>
      </div>

      <DataCard flush>
        <div className="space-y-4 border-b p-5">
          <TableToolbar
            search={table.search}
            onSearchChange={table.setSearch}
            placeholder="Search by brand, city, category or type…"
          >
            {table.search && (
              <Button variant="ghost" size="sm" onClick={table.resetFilters}>
                <X className="mr-1.5 h-3.5 w-3.5" />
                Clear
              </Button>
            )}
          </TableToolbar>

          <FilterChips<MaterialType>
            aria-label="Filter by material type"
            value={materialType}
            onChange={setMaterialType}
            options={MATERIAL_TYPES.map((type) => ({
              value: type,
              label: type,
              count:
                type === "All"
                  ? materialType === "All"
                    ? rates.length
                    : undefined
                  : materialType === "All"
                    ? (typeCounts[type.toLowerCase()] ?? 0)
                    : undefined,
            }))}
          />
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[160px]">
                  <SortButton column="brand">Brand</SortButton>
                </TableHead>
                <TableHead>
                  <SortButton column="price">Price</SortButton>
                </TableHead>
                <TableHead>
                  <SortButton column="change">Change</SortButton>
                </TableHead>
                <TableHead>
                  <SortButton column="city">City</SortButton>
                </TableHead>
                <TableHead>
                  <SortButton column="category">Category</SortButton>
                </TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>
                  <SortButton column="materialType">Type</SortButton>
                </TableHead>
                <TableHead>Status</TableHead>
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
              ) : rates.length === 0 ? (
                <EmptyRow
                  colSpan={COLUMN_COUNT}
                  icon={Package}
                  title={
                    materialType === "All"
                      ? "No material rates yet"
                      : `No ${materialType.toLowerCase()} rates yet`
                  }
                  description="Nothing has been added to the unified rates table."
                  action={addButton}
                />
              ) : table.matchedCount === 0 ? (
                <NoResultsRow
                  colSpan={COLUMN_COUNT}
                  search={table.search}
                  onReset={table.resetFilters}
                />
              ) : (
                table.rows.map((rate) => {
                  const busy = busyId === rate._id;
                  return (
                    <TableRow
                      key={rate._id}
                      className={cn(busy && "opacity-60")}
                    >
                      <TableCell className="font-medium">
                        {rate.brand}
                      </TableCell>
                      <TableCell className="font-semibold tabular-nums">
                        Rs {rate.price?.toLocaleString("en-PK") ?? "—"}
                      </TableCell>
                      <TableCell>
                        <ChangeIndicator change={rate.change} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {rate.city || "—"}
                      </TableCell>
                      <TableCell>
                        {rate.category ? (
                          <Badge variant="secondary" className="font-normal">
                            {rate.category}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {rate.unit || "Per Unit"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {rate.materialType || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {rate.isActive !== false ? (
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
                                  href={`/dashboard/material-rate/edit/${rate._id}`}
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
                                onClick={() => requestDelete(rate)}
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
              itemLabel="material rates"
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

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import api from "@/lib/api";
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
import { apiErrorMessage } from "./api-error";

/** Shape shared by every construction-material rate collection. */
export interface RateRecord {
  _id: string;
  brand: string;
  price: number;
  change?: number;
  city?: string;
  unit?: string;
  category?: string;
  weightKg?: number;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

type ActiveFilter = "all" | "active" | "inactive";

const ACTIVE_FILTERS: ActiveFilter[] = ["all", "active", "inactive"];

/** Optional columns, so cement (weight) and the rest (city/unit) share one table. */
export type RateColumn = "city" | "unit" | "category" | "weight";

export interface RateListPageProps {
  /** Plural display name, e.g. "Cement Rates". */
  title: string;
  description: string;
  /** Singular noun used in buttons and dialogs, e.g. "cement rate". */
  itemName: string;
  /** Plural noun for the row counter, e.g. "cement rates". */
  itemNamePlural: string;
  /** Dashboard base path, e.g. "/dashboard/cement-rate". */
  basePath: string;
  /** Admin list endpoint, e.g. "/cement-rate/admin/all". */
  listEndpoint: string;
  /** Delete endpoint prefix, e.g. "/cement-rate". */
  deleteEndpoint: string;
  /** Which optional columns to render. */
  columns?: RateColumn[];
  /** Default unit label when a record has none. */
  defaultUnit?: string;
}

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

/**
 * One list screen for all nine material-rate types. They were nine
 * near-identical files built on raw <table> markup with no pagination, no
 * search, and an error path that rendered the "add your first rate" empty state
 * — so a failed request looked like an empty collection.
 */
export function RateListPage({
  title,
  description,
  itemName,
  itemNamePlural,
  basePath,
  listEndpoint,
  deleteEndpoint,
  columns = ["city", "unit", "category"],
  defaultUnit = "Per Unit",
}: RateListPageProps) {
  const [rates, setRates] = useState<RateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const { confirm, dialogProps } = useConfirm();

  const showCity = columns.includes("city");
  const showUnit = columns.includes("unit");
  const showCategory = columns.includes("category");
  const showWeight = columns.includes("weight");

  // Brand, Price, Change, Status, Added, Actions + the optional ones.
  const columnCount =
    6 + [showCity, showUnit, showCategory, showWeight].filter(Boolean).length;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(listEndpoint);
      setRates(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error(`Error fetching ${itemNamePlural}:`, err);
      setError(
        apiErrorMessage(
          err,
          `Could not load ${itemNamePlural}. Check your connection and try again.`,
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [listEndpoint, itemNamePlural]);

  useEffect(() => {
    void load();
  }, [load]);

  const cities = useMemo(() => {
    const set = new Set<string>();
    for (const rate of rates) {
      if (rate.city) set.add(rate.city);
    }
    return [...set].sort();
  }, [rates]);

  const statusCounts = useMemo(() => {
    let active = 0;
    for (const rate of rates) {
      if (rate.isActive !== false) active += 1;
    }
    return { all: rates.length, active, inactive: rates.length - active };
  }, [rates]);

  const rowFilter = useCallback(
    (rate: RateRecord) => {
      // isActive is optional in the payload; absent means active.
      const isActive = rate.isActive !== false;
      if (activeFilter === "active" && !isActive) return false;
      if (activeFilter === "inactive" && isActive) return false;
      if (cityFilter !== "all" && rate.city !== cityFilter) return false;
      return true;
    },
    [activeFilter, cityFilter],
  );

  const table = useTableControls<RateRecord>({
    data: rates,
    searchKeys: ["brand", "city", "category", "unit"],
    filter: rowFilter,
    initialPageSize: 10,
    initialSortKey: "createdAt",
    initialSortDirection: "desc",
  });

  useEffect(() => {
    table.setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter, cityFilter]);

  const requestDelete = (rate: RateRecord) =>
    confirm({
      title: `Delete this ${itemName}?`,
      description: `“${rate.brand}” will be permanently removed and will disappear from the public rate page.`,
      confirmLabel: "Delete",
      onConfirm: async () => {
        try {
          setBusyId(rate._id);
          await api.delete(`${deleteEndpoint}/${rate._id}`);
          setRates((previous) =>
            previous.filter((item) => item._id !== rate._id),
          );
          toast.success(
            `${itemName.charAt(0).toUpperCase() + itemName.slice(1)} deleted`,
          );
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
    column: keyof RateRecord;
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

  const filtersActive =
    activeFilter !== "all" || cityFilter !== "all" || table.search !== "";
  const resetAll = () => {
    setActiveFilter("all");
    setCityFilter("all");
    table.resetFilters();
  };

  const addButton = (
    <Button asChild>
      <Link href={`${basePath}/add`}>
        <PlusCircle className="mr-2 h-4 w-4" />
        Add {itemName.replace(/\brate\b/i, "Rate")}
      </Link>
    </Button>
  );

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5">
      <PageHeader
        title={title}
        description={description}
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

      <DataCard flush>
        <div className="space-y-4 border-b p-5">
          <TableToolbar
            search={table.search}
            onSearchChange={table.setSearch}
            placeholder="Search by brand, city or category…"
          >
            {showCity && cities.length > 1 && (
              <Select value={cityFilter} onValueChange={setCityFilter}>
                <SelectTrigger
                  className="w-[160px]"
                  aria-label="Filter by city"
                >
                  <SelectValue placeholder="All cities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All cities</SelectItem>
                  {cities.map((city) => (
                    <SelectItem key={city} value={city}>
                      {city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {filtersActive && (
              <Button variant="ghost" size="sm" onClick={resetAll}>
                <X className="mr-1.5 h-3.5 w-3.5" />
                Clear
              </Button>
            )}
          </TableToolbar>

          <FilterChips<ActiveFilter>
            aria-label="Filter by status"
            value={activeFilter}
            onChange={setActiveFilter}
            options={ACTIVE_FILTERS.map((value) => ({
              value,
              label:
                value === "all"
                  ? "All"
                  : value === "active"
                    ? "Active"
                    : "Inactive",
              count: statusCounts[value],
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
                {showCity && (
                  <TableHead>
                    <SortButton column="city">City</SortButton>
                  </TableHead>
                )}
                {showCategory && (
                  <TableHead>
                    <SortButton column="category">Category</SortButton>
                  </TableHead>
                )}
                {showUnit && <TableHead>Unit</TableHead>}
                {showWeight && <TableHead>Weight</TableHead>}
                <TableHead>Status</TableHead>
                <TableHead className="whitespace-nowrap">
                  <SortButton column="createdAt">Added</SortButton>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableSkeleton rows={8} columns={columnCount} />
              ) : error ? (
                <ErrorRow
                  colSpan={columnCount}
                  message={error}
                  onRetry={() => void load()}
                />
              ) : rates.length === 0 ? (
                <EmptyRow
                  colSpan={columnCount}
                  icon={Package}
                  title={`No ${itemNamePlural} yet`}
                  description={`Add your first ${itemName} and it will appear on the public rate page.`}
                  action={addButton}
                />
              ) : table.matchedCount === 0 ? (
                <NoResultsRow
                  colSpan={columnCount}
                  search={table.search}
                  onReset={resetAll}
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
                      {showCity && (
                        <TableCell className="text-sm text-muted-foreground">
                          {rate.city || "—"}
                        </TableCell>
                      )}
                      {showCategory && (
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
                      )}
                      {showUnit && (
                        <TableCell className="text-sm text-muted-foreground">
                          {rate.unit || defaultUnit}
                        </TableCell>
                      )}
                      {showWeight && (
                        <TableCell className="text-sm text-muted-foreground">
                          {rate.weightKg ?? 50} Kg
                        </TableCell>
                      )}
                      <TableCell>
                        {rate.isActive !== false ? (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDate(rate.createdAt)}
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
                                <Link href={`${basePath}/edit/${rate._id}`}>
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
              itemLabel={itemNamePlural}
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

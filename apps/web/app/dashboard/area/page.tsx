"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  MapPin,
  PlusCircle,
  RefreshCcw,
  SquarePen,
  Trash2,
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
import areaApi from "@/lib/api/area/area.api";
import cityApi from "@/lib/api/city/city.api";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";
import {
  ConfirmDialog,
  DataCard,
  EmptyRow,
  ErrorRow,
  NoResultsRow,
  PageHeader,
  PaginationBar,
  TableSkeleton,
  TableToolbar,
  useConfirm,
  useTableControls,
} from "@/components/dashboard";
import { apiErrorMessage } from "@/components/dashboard/api-error";

interface CityRef {
  _id: string;
  name: string;
}

interface AreaRecord {
  _id: string;
  name: string;
  areaSlug?: string;
  city?: CityRef | string;
  createdAt?: string;
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

export default function AreasPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [areas, setAreas] = useState<AreaRecord[]>([]);
  const [cities, setCities] = useState<CityRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cityFilter, setCityFilter] = useState("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const { confirm, dialogProps } = useConfirm();
  const columnCount = isAdmin ? 5 : 4;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Cities are only needed to label areas whose `city` came back unpopulated;
      // a failure there must not hide the areas themselves.
      const [areasResult, citiesResult] = await Promise.allSettled([
        areaApi.getAll(),
        cityApi.getAll(),
      ]);

      if (areasResult.status === "rejected") throw areasResult.reason;
      setAreas(Array.isArray(areasResult.value) ? areasResult.value : []);

      if (
        citiesResult.status === "fulfilled" &&
        Array.isArray(citiesResult.value)
      ) {
        setCities(citiesResult.value);
      }
    } catch (err) {
      console.error("Error fetching areas:", err);
      setError(
        apiErrorMessage(
          err,
          "Could not load areas. Check your connection and try again.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const cityNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const city of cities) map.set(city._id, city.name);
    return map;
  }, [cities]);

  const cityNameOf = useCallback(
    (area: AreaRecord): string => {
      if (!area.city) return "";
      if (typeof area.city === "string")
        return cityNameById.get(area.city) ?? "";
      return area.city.name ?? "";
    },
    [cityNameById],
  );

  const cityOptions = useMemo(() => {
    const set = new Set<string>();
    for (const area of areas) {
      const name = cityNameOf(area);
      if (name) set.add(name);
    }
    return [...set].sort();
  }, [areas, cityNameOf]);

  const rowFilter = useCallback(
    (area: AreaRecord) =>
      cityFilter === "all" || cityNameOf(area) === cityFilter,
    [cityFilter, cityNameOf],
  );

  const searchAccessor = useCallback(
    (area: AreaRecord) => [area.name, area.areaSlug, cityNameOf(area)],
    [cityNameOf],
  );

  const table = useTableControls<AreaRecord>({
    data: areas,
    searchAccessor,
    filter: rowFilter,
    initialPageSize: 25,
    initialSortKey: "name",
    initialSortDirection: "asc",
  });

  useEffect(() => {
    table.setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityFilter]);

  const requestDelete = (area: AreaRecord) =>
    confirm({
      title: "Delete this area?",
      description: `“${area.name}” will be removed. Properties linked to it may stop resolving their location.`,
      confirmLabel: "Delete area",
      onConfirm: async () => {
        try {
          setBusyId(area._id);
          await areaApi.delete(area._id);
          setAreas((previous) =>
            previous.filter((item) => item._id !== area._id),
          );
          toast.success("Area deleted");
        } catch (err) {
          console.error("Error deleting area:", err);
          toast.error("Could not delete area", {
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
    column: keyof AreaRecord;
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

  const filtersActive = cityFilter !== "all" || table.search !== "";
  const resetAll = () => {
    setCityFilter("all");
    table.resetFilters();
  };

  const addButton = isAdmin ? (
    <Button asChild>
      <Link href="/dashboard/area/add-area">
        <PlusCircle className="mr-2 h-4 w-4" />
        Add Area
      </Link>
    </Button>
  ) : null;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5">
      <PageHeader
        title="Areas"
        description="Societies, sectors and phases that properties can be listed under."
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
              <Link href="/dashboard/city">View Cities</Link>
            </Button>
            {addButton}
          </>
        }
      />

      <DataCard flush>
        <div className="border-b p-5">
          <TableToolbar
            search={table.search}
            onSearchChange={table.setSearch}
            placeholder="Search by area or city…"
          >
            {cityOptions.length > 1 && (
              <Select value={cityFilter} onValueChange={setCityFilter}>
                <SelectTrigger
                  className="w-[180px]"
                  aria-label="Filter by city"
                >
                  <SelectValue placeholder="All cities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All cities</SelectItem>
                  {cityOptions.map((city) => (
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
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">
                  <SortButton column="name">Area</SortButton>
                </TableHead>
                <TableHead>City</TableHead>
                <TableHead>
                  <SortButton column="areaSlug">Slug</SortButton>
                </TableHead>
                <TableHead className="whitespace-nowrap">
                  <SortButton column="createdAt">Created</SortButton>
                </TableHead>
                {isAdmin && (
                  <TableHead className="text-right">Actions</TableHead>
                )}
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
              ) : areas.length === 0 ? (
                <EmptyRow
                  colSpan={columnCount}
                  icon={MapPin}
                  title="No areas yet"
                  description="Add an area so properties can be grouped by neighbourhood."
                  action={addButton ?? undefined}
                />
              ) : table.matchedCount === 0 ? (
                <NoResultsRow
                  colSpan={columnCount}
                  search={table.search}
                  onReset={resetAll}
                />
              ) : (
                table.rows.map((area) => {
                  const busy = busyId === area._id;
                  const city = cityNameOf(area);
                  return (
                    <TableRow
                      key={area._id}
                      className={cn(busy && "opacity-60")}
                    >
                      <TableCell className="font-medium">{area.name}</TableCell>
                      <TableCell>
                        {city ? (
                          <Badge variant="outline">{city}</Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            Unassigned
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs text-muted-foreground">
                          {area.areaSlug || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDate(area.createdAt)}
                      </TableCell>
                      {isAdmin && (
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
                                    href={`/dashboard/area/edit/${area._id}`}
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
                                  onClick={() => requestDelete(area)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      )}
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
              itemLabel="areas"
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

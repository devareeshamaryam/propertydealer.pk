"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Eye,
  EyeOff,
  GitMerge,
  MapPin,
  PlusCircle,
  RefreshCcw,
  SquarePen,
  Trash2,
  Undo2,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
  mergedInto?: string;
  mergedIntoSlug?: string;
  hidden?: boolean;
  listings?: number;
}

/** Which areas the table shows. "Active" are the ones offered on the site. */
type StatusFilter = "active" | "listings" | "empty" | "merged" | "hidden" | "all";
const STATUS_LABELS: Record<StatusFilter, string> = {
  active: "Active",
  listings: "Active, with listings",
  empty: "Active, no listings",
  merged: "Merged duplicates",
  hidden: "Hidden",
  all: "All areas",
};
const isActive = (a: AreaRecord) => !a.mergedInto && !a.hidden;
const cityIdOf = (a: AreaRecord) =>
  typeof a.city === "string" ? a.city : (a.city?._id ?? "");

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
  const [status, setStatus] = useState<StatusFilter>("active");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [mergeFrom, setMergeFrom] = useState<AreaRecord | null>(null);
  const [mergeQuery, setMergeQuery] = useState("");
  const [merging, setMerging] = useState(false);
  // Status and listing counts come from the admin overview; others get the plain list.
  const [withCounts, setWithCounts] = useState(false);

  const { confirm, dialogProps } = useConfirm();
  const columnCount = isAdmin ? 6 : 4;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Cities are only needed to label areas whose `city` came back unpopulated;
      // a failure there must not hide the areas themselves.
      const [areasResult, citiesResult] = await Promise.allSettled([
        isAdmin
          ? areaApi.adminOverview()
          : Promise.reject(new Error("overview is for admins")),
        cityApi.getNames(),
      ]);

      if (areasResult.status === "fulfilled") {
        setAreas(areasResult.value);
        setWithCounts(true);
      } else {
        // An older API without the overview: the plain list, no status or counts.
        const plain = await areaApi.getAll();
        setAreas(Array.isArray(plain) ? plain : []);
        setWithCounts(false);
      }

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
  }, [isAdmin]);

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

  const byId = useMemo(() => new Map(areas.map((a) => [a._id, a])), [areas]);

  const matchesStatus = useCallback(
    (area: AreaRecord): boolean => {
      if (!withCounts) return true;
      switch (status) {
        case "active":
          return isActive(area);
        case "listings":
          return isActive(area) && (area.listings ?? 0) > 0;
        case "empty":
          return isActive(area) && (area.listings ?? 0) === 0;
        case "merged":
          return !!area.mergedInto;
        case "hidden":
          return !!area.hidden && !area.mergedInto;
        default:
          return true;
      }
    },
    [status, withCounts],
  );

  const rowFilter = useCallback(
    (area: AreaRecord) =>
      matchesStatus(area) &&
      (cityFilter === "all" || cityNameOf(area) === cityFilter),
    [cityFilter, cityNameOf, matchesStatus],
  );

  const summary = useMemo(() => {
    const inCity = areas.filter(
      (a) => cityFilter === "all" || cityNameOf(a) === cityFilter,
    );
    return {
      active: inCity.filter(isActive).length,
      listings: inCity.filter((a) => isActive(a) && (a.listings ?? 0) > 0)
        .length,
      merged: inCity.filter((a) => a.mergedInto).length,
      hidden: inCity.filter((a) => a.hidden && !a.mergedInto).length,
    };
  }, [areas, cityFilter, cityNameOf]);

  /** Where the area being merged can go: active areas of the same city, matching the search. */
  const mergeTargets = useMemo(() => {
    if (!mergeFrom) return [];
    const city = cityIdOf(mergeFrom);
    const q = mergeQuery.trim().toLowerCase();
    return areas
      .filter(
        (a) => a._id !== mergeFrom._id && isActive(a) && cityIdOf(a) === city,
      )
      .filter(
        (a) =>
          !q ||
          a.name.toLowerCase().includes(q) ||
          (a.areaSlug ?? "").includes(q),
      )
      .sort(
        (a, b) =>
          (b.listings ?? 0) - (a.listings ?? 0) || a.name.localeCompare(b.name),
      )
      .slice(0, 40);
  }, [areas, mergeFrom, mergeQuery]);

  const openMerge = (area: AreaRecord) => {
    setMergeFrom(area);
    // Start from the area's first word — duplicates usually share it.
    setMergeQuery(area.name.split(/[\s,]+/)[0] ?? "");
  };

  const doMerge = async (target: AreaRecord) => {
    if (!mergeFrom) return;
    try {
      setMerging(true);
      const res = await areaApi.merge(mergeFrom._id, target._id);
      toast.success(`Merged into “${target.name}”`, {
        description: `${res.moved} listing${res.moved === 1 ? "" : "s"} moved. The old URL keeps working and points to ${res.keptSlug}.`,
      });
      setMergeFrom(null);
      await load();
    } catch (err) {
      toast.error("Could not merge", {
        description: apiErrorMessage(err, "Please try again."),
      });
    } finally {
      setMerging(false);
    }
  };

  const runAction = async (
    area: AreaRecord,
    action: () => Promise<unknown>,
    done: string,
  ) => {
    try {
      setBusyId(area._id);
      await action();
      toast.success(done);
      await load();
    } catch (err) {
      toast.error("Could not update the area", {
        description: apiErrorMessage(err, "Please try again."),
      });
    } finally {
      setBusyId(null);
    }
  };

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
  }, [cityFilter, status]);

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

  const filtersActive =
    cityFilter !== "all" || status !== "active" || table.search !== "";
  const resetAll = () => {
    setCityFilter("all");
    setStatus("active");
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

  const n = (v: number) => v.toLocaleString("en-PK");

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5">
      <PageHeader
        title="Areas"
        description={
          withCounts
            ? `${n(summary.active)} active · ${n(summary.listings)} with listings · ${n(summary.merged)} merged duplicates · ${n(summary.hidden)} hidden. Merge a duplicate or misspelling into the right area: its listings move and its URL keeps working.`
            : "Societies, sectors and phases that properties can be listed under."
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
            {withCounts && (
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as StatusFilter)}
              >
                <SelectTrigger
                  className="w-[200px]"
                  aria-label="Filter by status"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {STATUS_LABELS[k]}
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
                {isAdmin && (
                  <TableHead className="whitespace-nowrap">
                    <SortButton column="listings">Listings</SortButton>
                  </TableHead>
                )}
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
                  const listings = area.listings ?? 0;
                  return (
                    <TableRow
                      key={area._id}
                      className={cn(busy && "opacity-60")}
                    >
                      <TableCell className="font-medium">
                        <span>{area.name}</span>
                        {area.hidden && !area.mergedInto && (
                          <Badge
                            variant="secondary"
                            className="ml-2 align-middle"
                          >
                            Hidden
                          </Badge>
                        )}
                        {area.mergedInto && (
                          <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                            Merged into{" "}
                            <span className="font-medium text-foreground">
                              {byId.get(area.mergedInto)?.name ??
                                area.mergedIntoSlug}
                            </span>
                          </span>
                        )}
                      </TableCell>
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
                      {isAdmin && (
                        <TableCell className="text-sm tabular-nums">
                          {withCounts ? n(listings) : "—"}
                        </TableCell>
                      )}
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDate(area.createdAt)}
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {withCounts && !area.mergedInto && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    disabled={busy}
                                    onClick={() => openMerge(area)}
                                  >
                                    <GitMerge className="h-4 w-4" />
                                    <span className="sr-only">Merge</span>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Merge into the right area (duplicate or
                                  misspelling)
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {withCounts && area.mergedInto && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    disabled={busy}
                                    onClick={() =>
                                      void runAction(
                                        area,
                                        () => areaApi.unmerge(area._id),
                                        "Area is active again",
                                      )
                                    }
                                  >
                                    <Undo2 className="h-4 w-4" />
                                    <span className="sr-only">Unmerge</span>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Undo the merge (moved listings stay where they
                                  are)
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {withCounts && !area.mergedInto && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    disabled={busy}
                                    onClick={() =>
                                      void runAction(
                                        area,
                                        () =>
                                          areaApi.setHidden(
                                            area._id,
                                            !area.hidden,
                                          ),
                                        area.hidden
                                          ? "Area is offered again"
                                          : "Area hidden from pickers",
                                      )
                                    }
                                  >
                                    {area.hidden ? (
                                      <Eye className="h-4 w-4" />
                                    ) : (
                                      <EyeOff className="h-4 w-4" />
                                    )}
                                    <span className="sr-only">
                                      {area.hidden ? "Unhide" : "Hide"}
                                    </span>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {area.hidden
                                    ? "Offer in area pickers again"
                                    : "Hide from area pickers (its page and listings stay)"}
                                </TooltipContent>
                              </Tooltip>
                            )}
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
                                {/* A span keeps the tooltip working on the disabled button. */}
                                <span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    disabled={busy || listings > 0}
                                    onClick={() => requestDelete(area)}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {listings > 0
                                  ? "Has listings — merge it instead"
                                  : "Delete"}
                              </TooltipContent>
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

      <Dialog
        open={!!mergeFrom}
        onOpenChange={(open) => !open && !merging && setMergeFrom(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Merge “{mergeFrom?.name}”</DialogTitle>
            <DialogDescription>
              Choose the area to keep
              {mergeFrom && cityNameOf(mergeFrom)
                ? ` in ${cityNameOf(mergeFrom)}`
                : ""}
              . {mergeFrom?.listings ?? 0} listing
              {mergeFrom?.listings === 1 ? "" : "s"} move there; the old URL (
              {mergeFrom?.areaSlug}) keeps working and points to the kept area.
              Nothing is deleted.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={mergeQuery}
            onChange={(e) => setMergeQuery(e.target.value)}
            placeholder="Search the area to keep…"
            autoFocus
          />
          <div className="max-h-[320px] overflow-y-auto rounded-md border">
            {mergeTargets.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                No matching area in this city.
              </p>
            ) : (
              mergeTargets.map((a) => (
                <button
                  key={a._id}
                  type="button"
                  disabled={merging}
                  onClick={() => void doMerge(a)}
                  className="flex w-full items-center justify-between gap-3 border-b px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-accent disabled:opacity-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{a.name}</span>
                    <span className="block truncate font-mono text-xs text-muted-foreground">
                      {a.areaSlug}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {n(a.listings ?? 0)} listings
                  </span>
                </button>
              ))
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMergeFrom(null)}
              disabled={merging}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building,
  PlusCircle,
  RefreshCcw,
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

interface CityRecord {
  _id: string;
  name: string;
  areaSlug?: string;
  state?: string;
  country?: string;
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

export default function CitiesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [cities, setCities] = useState<CityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { confirm, dialogProps } = useConfirm();
  const columnCount = isAdmin ? 5 : 4;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await cityApi.getAll();
      setCities(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching cities:", err);
      setError(
        apiErrorMessage(
          err,
          "Could not load cities. Check your connection and try again.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const table = useTableControls<CityRecord>({
    data: cities,
    searchKeys: ["name", "state", "country", "areaSlug"],
    initialPageSize: 25,
    initialSortKey: "name",
    initialSortDirection: "asc",
  });

  const requestDelete = (city: CityRecord) =>
    confirm({
      title: "Delete this city?",
      description: `“${city.name}” will be removed. Areas and properties linked to it may stop resolving.`,
      confirmLabel: "Delete city",
      onConfirm: async () => {
        try {
          setBusyId(city._id);
          await cityApi.delete(city._id);
          setCities((previous) =>
            previous.filter((item) => item._id !== city._id),
          );
          toast.success("City deleted");
        } catch (err) {
          console.error("Error deleting city:", err);
          toast.error("Could not delete city", {
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
    column: keyof CityRecord;
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

  const addButton = isAdmin ? (
    <Button asChild>
      <Link href="/dashboard/city/add-city">
        <PlusCircle className="mr-2 h-4 w-4" />
        Add City
      </Link>
    </Button>
  ) : null;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5">
      <PageHeader
        title="Cities"
        description="Cities available when listing a property or browsing the website."
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
              <Link href="/dashboard/area">View Areas</Link>
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
            placeholder="Search by city, state or country…"
          />
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px]">
                  <SortButton column="name">City</SortButton>
                </TableHead>
                <TableHead>
                  <SortButton column="state">State / Province</SortButton>
                </TableHead>
                <TableHead>
                  <SortButton column="country">Country</SortButton>
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
              ) : cities.length === 0 ? (
                <EmptyRow
                  colSpan={columnCount}
                  icon={Building}
                  title="No cities yet"
                  description="Add a city before creating areas and listings."
                  action={addButton ?? undefined}
                />
              ) : table.matchedCount === 0 ? (
                <NoResultsRow
                  colSpan={columnCount}
                  search={table.search}
                  onReset={table.resetFilters}
                />
              ) : (
                table.rows.map((city) => {
                  const busy = busyId === city._id;
                  return (
                    <TableRow
                      key={city._id}
                      className={cn(busy && "opacity-60")}
                    >
                      <TableCell className="font-medium">{city.name}</TableCell>
                      <TableCell>
                        {city.state ? (
                          <Badge variant="outline" className="capitalize">
                            {city.state}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {city.country || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDate(city.createdAt)}
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
                                    href={`/dashboard/city/edit/${city._id}`}
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
                                  onClick={() => requestDelete(city)}
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
              itemLabel="cities"
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

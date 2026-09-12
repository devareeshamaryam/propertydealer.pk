"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  FolderTree,
  ImageOff,
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
import { apiErrorMessage } from "@/components/dashboard/api-error";

interface Subcategory {
  name: string;
  slug: string;
}

interface TileCategoryRecord {
  _id: string;
  name: string;
  slug: string;
  image?: string;
  order?: number;
  isActive?: boolean;
  subcategories?: Subcategory[];
  createdAt?: string;
}

type StatusFilter = "all" | "active" | "inactive";

const STATUS_FILTERS: StatusFilter[] = ["all", "active", "inactive"];
const COLUMN_COUNT = 7;

function Thumbnail({ src, alt }: { src?: string; alt: string }) {
  // Track which src failed, so a row whose image changes retries on its own.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = Boolean(src) && failedSrc === src;

  if (!src || failed) {
    return (
      <div className="flex h-10 w-12 items-center justify-center rounded-md bg-muted">
        <ImageOff className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailedSrc(src)}
      className="h-10 w-12 rounded-md border object-cover"
    />
  );
}

export default function TileCategoriesPage() {
  const [categories, setCategories] = useState<TileCategoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const { confirm, dialogProps } = useConfirm();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get("/tile-category/admin/all");
      setCategories(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error("Error fetching tile categories:", err);
      setError(
        apiErrorMessage(
          err,
          "Could not load tile categories. Check your connection and try again.",
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
    for (const category of categories) {
      if (category.isActive !== false) active += 1;
    }
    return {
      all: categories.length,
      active,
      inactive: categories.length - active,
    };
  }, [categories]);

  const rowFilter = useCallback(
    (category: TileCategoryRecord) => {
      const isActive = category.isActive !== false;
      if (statusFilter === "active" && !isActive) return false;
      if (statusFilter === "inactive" && isActive) return false;
      return true;
    },
    [statusFilter],
  );

  const searchAccessor = useCallback(
    (category: TileCategoryRecord) => [
      category.name,
      category.slug,
      ...(category.subcategories ?? []).map((sub) => sub.name),
    ],
    [],
  );

  const table = useTableControls<TileCategoryRecord>({
    data: categories,
    searchAccessor,
    filter: rowFilter,
    initialPageSize: 25,
    initialSortKey: "order",
    initialSortDirection: "asc",
  });

  useEffect(() => {
    table.setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const requestDelete = (category: TileCategoryRecord) =>
    confirm({
      title: "Delete this category?",
      description: `“${category.name}” and its ${
        category.subcategories?.length ?? 0
      } subcategories will be removed.`,
      confirmLabel: "Delete category",
      onConfirm: async () => {
        try {
          setBusyId(category._id);
          await api.delete(`/tile-category/${category._id}`);
          setCategories((previous) =>
            previous.filter((item) => item._id !== category._id),
          );
          toast.success("Category deleted");
        } catch (err) {
          console.error("Error deleting tile category:", err);
          toast.error("Could not delete category", {
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
    column: keyof TileCategoryRecord;
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
      <Link href="/dashboard/tile-category/add">
        <PlusCircle className="mr-2 h-4 w-4" />
        Add Category
      </Link>
    </Button>
  );

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5">
      <PageHeader
        title="Tile Categories"
        description="Groups and subcategories used to organise tile rates on the website."
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
              <Link href="/dashboard/tile-rate">View Tile Rates</Link>
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
            placeholder="Search by name, slug or subcategory…"
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
                <TableHead className="w-20">
                  <SortButton column="order">Order</SortButton>
                </TableHead>
                <TableHead className="w-20">Image</TableHead>
                <TableHead className="min-w-[180px]">
                  <SortButton column="name">Name</SortButton>
                </TableHead>
                <TableHead>Slug</TableHead>
                <TableHead className="min-w-[200px]">Subcategories</TableHead>
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
              ) : categories.length === 0 ? (
                <EmptyRow
                  colSpan={COLUMN_COUNT}
                  icon={FolderTree}
                  title="No tile categories yet"
                  description="Add a category so tile rates can be grouped on the public page."
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
                table.rows.map((category) => {
                  const busy = busyId === category._id;
                  const subs = category.subcategories ?? [];
                  return (
                    <TableRow
                      key={category._id}
                      className={cn(busy && "opacity-60")}
                    >
                      <TableCell>
                        <Badge variant="outline" className="tabular-nums">
                          {category.order ?? 0}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Thumbnail src={category.image} alt={category.name} />
                      </TableCell>
                      <TableCell className="font-medium">
                        {category.name}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs text-muted-foreground">
                          {category.slug || "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {subs.length > 0 ? (
                          <div className="flex max-w-[240px] flex-wrap gap-1">
                            {subs.slice(0, 3).map((sub, index) => (
                              <Badge
                                key={`${sub.slug}-${index}`}
                                variant="secondary"
                                className="font-normal"
                              >
                                {sub.name}
                              </Badge>
                            ))}
                            {subs.length > 3 && (
                              <Badge variant="outline" className="font-normal">
                                +{subs.length - 3}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            None
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {category.isActive !== false ? (
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
                                {/*
                                  This used to 404: the list linked to
                                  /edit/<id> while the route file sat at
                                  /edit with no [id] segment.
                                */}
                                <Link
                                  href={`/dashboard/tile-category/edit/${category._id}`}
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
                                onClick={() => requestDelete(category)}
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
              itemLabel="categories"
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

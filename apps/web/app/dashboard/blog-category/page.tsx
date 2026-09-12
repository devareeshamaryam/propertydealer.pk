"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  FolderTree,
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
import blogCategoryApi from "@/lib/api/blog-category/blog-category.api";
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

const COLUMN_COUNT = 6;

interface CategoryRecord {
  _id: string;
  name: string;
  slug?: string;
  description?: string;
  parent?: { name?: string } | string | null;
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

function parentName(category: CategoryRecord): string {
  if (!category.parent) return "";
  return typeof category.parent === "object"
    ? (category.parent.name ?? "")
    : String(category.parent);
}

export default function BlogCategoriesPage() {
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { confirm, dialogProps } = useConfirm();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await blogCategoryApi.getAllCategories();
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching categories:", err);
      setError(
        apiErrorMessage(
          err,
          "Could not load categories. Check your connection and try again.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const searchAccessor = useCallback(
    (category: CategoryRecord) => [
      category.name,
      category.slug,
      category.description,
      parentName(category),
    ],
    [],
  );

  const table = useTableControls<CategoryRecord>({
    data: categories,
    searchAccessor,
    initialPageSize: 25,
    initialSortKey: "name",
    initialSortDirection: "asc",
  });

  const requestDelete = (category: CategoryRecord) =>
    confirm({
      title: "Delete this category?",
      description: `“${category.name}” will be removed. Posts assigned to it will lose this category.`,
      confirmLabel: "Delete category",
      onConfirm: async () => {
        try {
          setBusyId(category._id);
          await blogCategoryApi.deleteCategory(category._id);
          setCategories((previous) =>
            previous.filter((item) => item._id !== category._id),
          );
          toast.success("Category deleted");
        } catch (err) {
          console.error("Error deleting category:", err);
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
    column: keyof CategoryRecord;
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
      <Link href="/dashboard/blog-category/add-category">
        <PlusCircle className="mr-2 h-4 w-4" />
        Add Category
      </Link>
    </Button>
  );

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5">
      <PageHeader
        title="Blog Categories"
        description="Organise your posts into categories and sub-categories."
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
              <Link href="/dashboard/blog">Back to Posts</Link>
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
            placeholder="Search by name, slug or description…"
          />
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px]">
                  <SortButton column="name">Name</SortButton>
                </TableHead>
                <TableHead>
                  <SortButton column="slug">Slug</SortButton>
                </TableHead>
                <TableHead className="min-w-[260px]">Description</TableHead>
                <TableHead>Parent</TableHead>
                <TableHead className="whitespace-nowrap">
                  <SortButton column="createdAt">Created</SortButton>
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
              ) : categories.length === 0 ? (
                <EmptyRow
                  colSpan={COLUMN_COUNT}
                  icon={FolderTree}
                  title="No categories yet"
                  description="Create a category so posts can be grouped on the website."
                  action={addButton}
                />
              ) : table.matchedCount === 0 ? (
                <NoResultsRow
                  colSpan={COLUMN_COUNT}
                  search={table.search}
                  onReset={table.resetFilters}
                />
              ) : (
                table.rows.map((category) => {
                  const busy = busyId === category._id;
                  const parent = parentName(category);
                  return (
                    <TableRow
                      key={category._id}
                      className={cn(busy && "opacity-60")}
                    >
                      <TableCell className="font-medium">
                        {category.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {category.slug || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <p className="max-w-[320px] truncate text-sm text-muted-foreground">
                          {category.description || "—"}
                        </p>
                      </TableCell>
                      <TableCell>
                        {parent ? (
                          <Badge variant="secondary" className="font-normal">
                            {parent}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            None
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDate(category.createdAt)}
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
                                  href={`/dashboard/blog-category/edit/${category._id}`}
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

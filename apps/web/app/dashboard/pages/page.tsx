"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ExternalLink,
  Eye,
  FileText,
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import pageApi from "@/lib/api/page/page.api";
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

type StatusFilter = "all" | "published" | "draft";

const STATUS_FILTERS: StatusFilter[] = ["all", "published", "draft"];
const COLUMN_COUNT = 6;

interface PageRecord {
  _id: string;
  title: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  status?: string;
  views?: number;
  keywords?: string[];
  metaTitle?: string;
  metaDescription?: string;
  createdAt?: string;
  updatedAt?: string;
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

function StatusBadge({ status }: { status?: string }) {
  if (status === "published") {
    return (
      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
        Published
      </Badge>
    );
  }
  return <Badge variant="secondary">Draft</Badge>;
}

export default function StaticPagesPage() {
  const [pages, setPages] = useState<PageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [preview, setPreview] = useState<PageRecord | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  const { confirm, dialogProps } = useConfirm();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await pageApi.getAllPages();
      setPages(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching pages:", err);
      setError(
        apiErrorMessage(
          err,
          "Could not load pages. Check your connection and try again.",
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
    let published = 0;
    for (const page of pages) {
      if (page.status === "published") published += 1;
    }
    return { all: pages.length, published, draft: pages.length - published };
  }, [pages]);

  const rowFilter = useCallback(
    (page: PageRecord) =>
      statusFilter === "all" || page.status === statusFilter,
    [statusFilter],
  );

  const searchAccessor = useCallback(
    (page: PageRecord) => [
      page.title,
      page.slug,
      page.excerpt,
      page.metaTitle,
      ...(page.keywords ?? []),
    ],
    [],
  );

  const table = useTableControls<PageRecord>({
    data: pages,
    searchAccessor,
    filter: rowFilter,
    initialPageSize: 10,
    initialSortKey: "createdAt",
    initialSortDirection: "desc",
  });

  useEffect(() => {
    table.setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const openPreview = async (pageId: string) => {
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreview(pages.find((page) => page._id === pageId) ?? null);
    try {
      const detail = await pageApi.getPageById(pageId);
      setPreview(detail);
    } catch (err) {
      toast.error("Could not load page", {
        description: apiErrorMessage(err, "Please try again."),
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  const requestDelete = (page: PageRecord) =>
    confirm({
      title: "Delete this page?",
      description: `“${page.title}” will be permanently removed from the website.`,
      confirmLabel: "Delete page",
      onConfirm: async () => {
        try {
          setBusyId(page._id);
          await pageApi.deletePage(page._id);
          setPages((previous) =>
            previous.filter((item) => item._id !== page._id),
          );
          toast.success("Page deleted");
        } catch (err) {
          console.error("Error deleting page:", err);
          toast.error("Could not delete page", {
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
    column: keyof PageRecord;
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

  const filtersActive = statusFilter !== "all" || table.search !== "";
  const resetAll = () => {
    setStatusFilter("all");
    table.resetFilters();
  };

  const addButton = (
    <Button asChild>
      <Link href="/dashboard/pages/add-page">
        <PlusCircle className="mr-2 h-4 w-4" />
        Add Page
      </Link>
    </Button>
  );

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5">
      <PageHeader
        title="Static Pages"
        description="SEO landing pages and content pages served on the website."
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
            placeholder="Search by title, slug or keyword…"
          >
            {filtersActive && (
              <Button variant="ghost" size="sm" onClick={resetAll}>
                <X className="mr-1.5 h-3.5 w-3.5" />
                Clear
              </Button>
            )}
          </TableToolbar>

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
                <TableHead className="min-w-[300px]">
                  <SortButton column="title">Title</SortButton>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="min-w-[180px]">Keywords</TableHead>
                <TableHead>
                  <SortButton column="views">Views</SortButton>
                </TableHead>
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
              ) : pages.length === 0 ? (
                <EmptyRow
                  colSpan={COLUMN_COUNT}
                  icon={FileText}
                  title="No pages yet"
                  description="Create a page to add SEO content to the website."
                  action={addButton}
                />
              ) : table.matchedCount === 0 ? (
                <NoResultsRow
                  colSpan={COLUMN_COUNT}
                  search={table.search}
                  onReset={resetAll}
                />
              ) : (
                table.rows.map((page) => {
                  const busy = busyId === page._id;
                  const keywords = page.keywords ?? [];
                  return (
                    <TableRow
                      key={page._id}
                      className={cn(busy && "opacity-60")}
                    >
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => void openPreview(page._id)}
                          className="block max-w-[320px] truncate text-left font-medium hover:text-primary hover:underline"
                        >
                          {page.title}
                        </button>
                        <p className="mt-0.5 max-w-[320px] truncate font-mono text-xs text-muted-foreground">
                          /{page.slug ?? "—"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={page.status} />
                      </TableCell>
                      <TableCell>
                        {keywords.length > 0 ? (
                          <div className="flex max-w-[220px] flex-wrap gap-1">
                            {keywords.slice(0, 2).map((keyword, index) => (
                              <Badge
                                key={`${keyword}-${index}`}
                                variant="secondary"
                                className="font-normal"
                              >
                                {keyword}
                              </Badge>
                            ))}
                            {keywords.length > 2 && (
                              <Badge variant="outline" className="font-normal">
                                +{keywords.length - 2}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            None
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums text-sm text-muted-foreground">
                        {(page.views ?? 0).toLocaleString("en-PK")}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDate(page.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => void openPreview(page._id)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Preview</TooltipContent>
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
                                  href={`/dashboard/pages/edit/${page._id}`}
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
                                onClick={() => requestDelete(page)}
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
              itemLabel="pages"
              onPageChange={table.setPage}
              onPageSizeChange={table.setPageSize}
            />
          </div>
        )}
      </DataCard>

      {/* Page preview */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[90vh] w-[min(96vw,900px)] gap-0 overflow-hidden p-0 sm:max-w-[900px]">
          {previewLoading && !preview ? (
            <div className="space-y-4 p-6">
              <DialogHeader className="sr-only">
                <DialogTitle>Loading page</DialogTitle>
                <DialogDescription>Fetching page details</DialogDescription>
              </DialogHeader>
              <Skeleton className="h-7 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-48 w-full rounded-lg" />
            </div>
          ) : (
            preview && (
              <>
                <DialogHeader className="space-y-0 border-b px-6 py-4 text-left">
                  <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
                    <div className="min-w-0">
                      <DialogTitle className="text-lg font-semibold">
                        {preview.title}
                      </DialogTitle>
                      <DialogDescription className="mt-1 font-mono text-sm">
                        /{preview.slug ?? "—"}
                      </DialogDescription>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={preview.status} />
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/dashboard/pages/edit/${preview._id}`}>
                          <SquarePen className="mr-2 h-3.5 w-3.5" />
                          Edit
                        </Link>
                      </Button>
                      {preview.status === "published" && preview.slug && (
                        <Button variant="outline" size="sm" asChild>
                          <Link
                            href={`/${preview.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="mr-2 h-3.5 w-3.5" />
                            Live page
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                </DialogHeader>

                <div className="max-h-[calc(90vh-8rem)] overflow-y-auto p-6">
                  {/* SEO block — the reason most of these pages exist */}
                  <div className="mb-5 space-y-3 rounded-xl border bg-muted/40 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      SEO
                    </p>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Meta title
                      </p>
                      <p className="text-sm font-medium">
                        {preview.metaTitle || preview.title}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Meta description
                      </p>
                      <p className="text-sm">
                        {preview.metaDescription || preview.excerpt || "—"}
                      </p>
                    </div>
                    {(preview.keywords?.length ?? 0) > 0 && (
                      <div>
                        <p className="mb-1.5 text-xs text-muted-foreground">
                          Keywords
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {preview.keywords?.map((keyword, index) => (
                            <Badge
                              key={`${keyword}-${index}`}
                              variant="secondary"
                            >
                              {keyword}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <Separator className="my-5" />

                  {/* Content is stored as editor HTML, so it is rendered, not printed. */}
                  <div
                    className="prose prose-sm max-w-none prose-headings:font-semibold prose-a:text-primary"
                    dangerouslySetInnerHTML={{
                      __html: preview.content ?? "<p>No content.</p>",
                    }}
                  />
                </div>
              </>
            )
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}

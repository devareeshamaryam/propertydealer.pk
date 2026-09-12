"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  Eye,
  ExternalLink,
  FileText,
  ImageOff,
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
import blogApi from "@/lib/api/blog/blog.api";
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

interface BlogRecord {
  _id: string;
  title: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  status?: string;
  views?: number;
  tags?: string[];
  categories?: ({ name?: string } | string)[];
  coverImage?: string;
  featuredImage?: string;
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

function categoryNames(blog: BlogRecord): string[] {
  if (!Array.isArray(blog.categories)) return [];
  return blog.categories
    .map((category) =>
      typeof category === "object" ? (category?.name ?? "") : String(category),
    )
    .filter(Boolean);
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

export default function BlogPostsPage() {
  const [blogs, setBlogs] = useState<BlogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [preview, setPreview] = useState<BlogRecord | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  const { confirm, dialogProps } = useConfirm();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const status = statusFilter === "all" ? undefined : statusFilter;
      const data = await blogApi.getAllBlogs(status);
      setBlogs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching blogs:", err);
      setError(
        apiErrorMessage(
          err,
          "Could not load blog posts. Check your connection and try again.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const blog of blogs) {
      for (const name of categoryNames(blog)) set.add(name);
    }
    return [...set].sort();
  }, [blogs]);

  const statusCounts = useMemo(() => {
    let published = 0;
    for (const blog of blogs) {
      if (blog.status === "published") published += 1;
    }
    return { all: blogs.length, published, draft: blogs.length - published };
  }, [blogs]);

  const rowFilter = useCallback(
    (blog: BlogRecord) =>
      categoryFilter === "all" || categoryNames(blog).includes(categoryFilter),
    [categoryFilter],
  );

  const searchAccessor = useCallback(
    (blog: BlogRecord) => [
      blog.title,
      blog.excerpt,
      blog.slug,
      ...categoryNames(blog),
      ...(blog.tags ?? []),
    ],
    [],
  );

  const table = useTableControls<BlogRecord>({
    data: blogs,
    searchAccessor,
    filter: rowFilter,
    initialPageSize: 10,
    initialSortKey: "createdAt",
    initialSortDirection: "desc",
  });

  useEffect(() => {
    table.setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, categoryFilter]);

  const openPreview = async (blogId: string) => {
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreview(blogs.find((blog) => blog._id === blogId) ?? null);
    try {
      const detail = await blogApi.getBlogById(blogId);
      setPreview(detail);
    } catch (err) {
      toast.error("Could not load post", {
        description: apiErrorMessage(err, "Please try again."),
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  const requestDelete = (blog: BlogRecord) =>
    confirm({
      title: "Delete this post?",
      description: `“${blog.title}” will be permanently removed from the website.`,
      confirmLabel: "Delete post",
      onConfirm: async () => {
        try {
          setBusyId(blog._id);
          await blogApi.deleteBlog(blog._id);
          setBlogs((previous) =>
            previous.filter((item) => item._id !== blog._id),
          );
          toast.success("Post deleted");
        } catch (err) {
          console.error("Error deleting blog:", err);
          toast.error("Could not delete post", {
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
    column: keyof BlogRecord;
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
    statusFilter !== "all" || categoryFilter !== "all" || table.search !== "";
  const resetAll = () => {
    setStatusFilter("all");
    setCategoryFilter("all");
    table.resetFilters();
  };

  const addButton = (
    <Button asChild>
      <Link href="/dashboard/blog/add-blog">
        <PlusCircle className="mr-2 h-4 w-4" />
        Write New Post
      </Link>
    </Button>
  );

  const previewImage = preview?.coverImage ?? preview?.featuredImage;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5">
      <PageHeader
        title="Blog Posts"
        description="Write, publish and manage the articles on your website."
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
              <Link href="/dashboard/blog-category">Manage Categories</Link>
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
            placeholder="Search by title, excerpt, tag or category…"
          >
            {categories.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  variant={categoryFilter === "all" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setCategoryFilter("all")}
                >
                  All categories
                </Button>
                {categories.slice(0, 4).map((category) => (
                  <Button
                    key={category}
                    variant={
                      categoryFilter === category ? "secondary" : "ghost"
                    }
                    size="sm"
                    onClick={() => setCategoryFilter(category)}
                  >
                    {category}
                  </Button>
                ))}
              </div>
            )}
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
              // Counts reflect the current fetch; the endpoint filters by status.
              count: statusFilter === "all" ? statusCounts[status] : undefined,
            }))}
          />
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[320px]">
                  <SortButton column="title">Title</SortButton>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="min-w-[160px]">Categories</TableHead>
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
              ) : blogs.length === 0 ? (
                <EmptyRow
                  colSpan={COLUMN_COUNT}
                  icon={FileText}
                  title={
                    statusFilter === "all"
                      ? "No posts yet"
                      : `No ${statusFilter} posts`
                  }
                  description="Write your first article and it will show up here."
                  action={addButton}
                />
              ) : table.matchedCount === 0 ? (
                <NoResultsRow
                  colSpan={COLUMN_COUNT}
                  search={table.search}
                  onReset={resetAll}
                />
              ) : (
                table.rows.map((blog) => {
                  const busy = busyId === blog._id;
                  const names = categoryNames(blog);
                  return (
                    <TableRow
                      key={blog._id}
                      className={cn(busy && "opacity-60")}
                    >
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => void openPreview(blog._id)}
                          className="block max-w-[320px] truncate text-left font-medium hover:text-primary hover:underline"
                        >
                          {blog.title}
                        </button>
                        {blog.excerpt && (
                          <p className="mt-0.5 max-w-[320px] truncate text-xs text-muted-foreground">
                            {blog.excerpt}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={blog.status} />
                      </TableCell>
                      <TableCell>
                        {names.length > 0 ? (
                          <div className="flex max-w-[200px] flex-wrap gap-1">
                            {names.slice(0, 2).map((name, index) => (
                              <Badge
                                key={`${name}-${index}`}
                                variant="secondary"
                                className="font-normal"
                              >
                                {name}
                              </Badge>
                            ))}
                            {names.length > 2 && (
                              <Badge variant="outline" className="font-normal">
                                +{names.length - 2}
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
                        {(blog.views ?? 0).toLocaleString("en-PK")}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDate(blog.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => void openPreview(blog._id)}
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
                                <Link href={`/dashboard/blog/edit/${blog._id}`}>
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
                                onClick={() => requestDelete(blog)}
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
              itemLabel="posts"
              onPageChange={table.setPage}
              onPageSizeChange={table.setPageSize}
            />
          </div>
        )}
      </DataCard>

      {/* Post preview */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[90vh] w-[min(96vw,900px)] gap-0 overflow-hidden p-0 sm:max-w-[900px]">
          {previewLoading && !preview ? (
            <div className="space-y-4 p-6">
              <DialogHeader className="sr-only">
                <DialogTitle>Loading post</DialogTitle>
                <DialogDescription>Fetching post details</DialogDescription>
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
                      <DialogDescription className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(preview.createdAt)}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Eye className="h-3.5 w-3.5" />
                          {(preview.views ?? 0).toLocaleString("en-PK")} views
                        </span>
                      </DialogDescription>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={preview.status} />
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/dashboard/blog/edit/${preview._id}`}>
                          <SquarePen className="mr-2 h-3.5 w-3.5" />
                          Edit
                        </Link>
                      </Button>
                      {preview.status === "published" && preview.slug && (
                        <Button variant="outline" size="sm" asChild>
                          <Link
                            href={`/blog/${preview.slug}`}
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
                  {previewImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewImage}
                      alt={preview.title}
                      className="mb-5 h-56 w-full rounded-lg border object-cover"
                    />
                  ) : (
                    <div className="mb-5 flex h-32 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-muted-foreground">
                      <ImageOff className="h-5 w-5" />
                      <span className="text-xs">No cover image</span>
                    </div>
                  )}

                  {preview.excerpt && (
                    <p className="mb-5 border-l-2 border-primary pl-4 text-sm italic text-muted-foreground">
                      {preview.excerpt}
                    </p>
                  )}

                  {/*
                    Content comes from the rich-text editor as HTML. The old
                    preview printed it as plain text, so editors saw raw <p> and
                    <h2> tags instead of the formatted article.
                  */}
                  <div
                    className="prose prose-sm max-w-none prose-headings:font-semibold prose-a:text-primary"
                    dangerouslySetInnerHTML={{
                      __html: preview.content ?? "<p>No content.</p>",
                    }}
                  />

                  {((preview.tags?.length ?? 0) > 0 ||
                    categoryNames(preview).length > 0) && (
                    <>
                      <Separator className="my-5" />
                      <div className="space-y-3">
                        {categoryNames(preview).length > 0 && (
                          <div>
                            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Categories
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {categoryNames(preview).map((name, index) => (
                                <Badge
                                  key={`${name}-${index}`}
                                  variant="secondary"
                                >
                                  {name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {(preview.tags?.length ?? 0) > 0 && (
                          <div>
                            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Tags
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {preview.tags?.map((tag, index) => (
                                <Badge
                                  key={`${tag}-${index}`}
                                  variant="outline"
                                >
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
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

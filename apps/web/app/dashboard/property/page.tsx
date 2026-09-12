"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building2,
  Check,
  Eye,
  ImageOff,
  PlusCircle,
  RefreshCcw,
  Send,
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
import { propertyApi } from "@/lib/api";
import type { BackendProperty } from "@/lib/types/property-utils";
import { useAuth } from "@/context/auth-context";
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
import { PropertyPreviewDialog } from "@/components/dashboard/property-preview-dialog";

type StatusFilter = "all" | "draft" | "pending" | "approved" | "rejected";

const STATUS_FILTERS: StatusFilter[] = [
  "all",
  "draft",
  "pending",
  "approved",
  "rejected",
];

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  pending: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  rejected: "bg-red-100 text-red-800 hover:bg-red-100",
  draft: "bg-slate-200 text-slate-700 hover:bg-slate-200",
};

const COLUMN_COUNT = 7;

/** "pending" -> "Pending"; never renders "undefinedundefined" for a missing status. */
function titleCase(value?: string) {
  if (!value) return "Unknown";
  return value.charAt(0).toUpperCase() + value.slice(1);
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

/** Thumbnail that degrades to an icon rather than calling a dead placeholder host. */
function Thumbnail({ src, alt }: { src?: string; alt: string }) {
  // Track which src failed, so a row whose image changes retries on its own.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = Boolean(src) && failedSrc === src;

  if (!src || failed) {
    return (
      <div className="flex h-11 w-14 shrink-0 items-center justify-center rounded-md bg-muted">
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
      className="h-11 w-14 shrink-0 rounded-md border object-cover"
    />
  );
}

export default function PropertiesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [properties, setProperties] = useState<BackendProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [preview, setPreview] = useState<BackendProperty | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  const { confirm, dialogProps } = useConfirm();

  // Honour ?status= so the overview KPI cards can deep-link into a filtered view.
  useEffect(() => {
    const status = searchParams.get("status");
    if (status && STATUS_FILTERS.includes(status as StatusFilter)) {
      setStatusFilter(status as StatusFilter);
    }
  }, [searchParams]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await propertyApi.getAllProperties();
      setProperties(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching properties:", err);
      setError(
        "Could not load properties. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: properties.length };
    for (const property of properties) {
      const status = property.status ?? "draft";
      counts[status] = (counts[status] ?? 0) + 1;
    }
    return counts;
  }, [properties]);

  const propertyTypes = useMemo(() => {
    const types = new Set<string>();
    for (const property of properties) {
      if (property.propertyType) types.add(property.propertyType);
    }
    return [...types].sort();
  }, [properties]);

  const rowFilter = useCallback(
    (property: BackendProperty) => {
      if (statusFilter !== "all" && property.status !== statusFilter)
        return false;
      if (typeFilter !== "all" && property.propertyType !== typeFilter)
        return false;
      return true;
    },
    [statusFilter, typeFilter],
  );

  const searchAccessor = useCallback(
    (property: BackendProperty) => [
      property.title,
      property.location,
      property.city,
      property.contactNumber,
      property.propertyType,
      typeof property.area === "object" ? property.area?.name : property.area,
      typeof property.area === "object" ? property.area?.city?.name : undefined,
    ],
    [],
  );

  const table = useTableControls<BackendProperty>({
    data: properties,
    searchAccessor,
    filter: rowFilter,
    initialPageSize: 10,
    initialSortKey: "createdAt",
    initialSortDirection: "desc",
  });

  // A filter change can leave the viewer on a page that no longer exists.
  useEffect(() => {
    table.setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, typeFilter]);

  const openPreview = async (propertyId: string) => {
    setPreviewOpen(true);
    setPreviewLoading(true);
    // Show what the list already knows while the full record loads.
    setPreview(
      properties.find((property) => property._id === propertyId) ?? null,
    );
    try {
      const detail = await propertyApi.getPropertyById({ id: propertyId });
      setPreview(detail);
    } catch (err) {
      toast.error("Could not load property", {
        description: apiErrorMessage(err, "Please try again."),
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  const changeStatus = async (
    property: BackendProperty,
    target?: "pending" | "approved" | "rejected" | "draft",
  ) => {
    const next =
      target ?? (property.status === "approved" ? "pending" : "approved");
    try {
      setBusyId(property._id);
      const response = await propertyApi.updateStatus(property._id, next);
      if (response?.success === false) {
        toast.error(response.message ?? "Could not update status");
        return;
      }
      // Update in place so the current page, scroll position and filters survive.
      setProperties((previous) =>
        previous.map((item) =>
          item._id === property._id ? { ...item, status: next } : item,
        ),
      );
      toast.success(
        next === "approved"
          ? "Property published"
          : next === "pending"
            ? "Sent for approval"
            : `Status set to ${next}`,
      );
    } catch (err) {
      console.error("Error updating status:", err);
      toast.error("Could not update status", {
        description: apiErrorMessage(err, "Please try again."),
      });
    } finally {
      setBusyId(null);
    }
  };

  const requestDelete = (property: BackendProperty) =>
    confirm({
      title: "Delete this property?",
      description: `“${property.title}” will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete property",
      onConfirm: async () => {
        try {
          await propertyApi.delete(property._id);
          setProperties((previous) =>
            previous.filter((item) => item._id !== property._id),
          );
          toast.success("Property deleted");
        } catch (err) {
          console.error("Error deleting property:", err);
          toast.error("Could not delete property", {
            description: apiErrorMessage(err, "Please try again."),
          });
        }
      },
    });

  const SortButton = ({
    column,
    children,
    className,
  }: {
    column: keyof BackendProperty;
    children: React.ReactNode;
    className?: string;
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
          "-ml-2 inline-flex items-center gap-1.5 rounded px-2 py-1 text-left font-medium transition-colors hover:bg-accent",
          active && "text-foreground",
          className,
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
    statusFilter !== "all" || typeFilter !== "all" || table.search !== "";

  const resetAll = () => {
    setStatusFilter("all");
    setTypeFilter("all");
    table.resetFilters();
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5">
      <PageHeader
        title={isAdmin ? "Properties" : "My Listings"}
        description={
          isAdmin
            ? "Review, approve and manage every listing on the platform."
            : "Manage the properties you have listed."
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
            <Button
              onClick={() => router.push("/dashboard/property/add-property")}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Property
            </Button>
          </>
        }
      />

      <DataCard flush>
        {/* Toolbar: search, status chips and type filter */}
        <div className="space-y-4 border-b p-5">
          <TableToolbar
            search={table.search}
            onSearchChange={table.setSearch}
            placeholder="Search by title, location, city or phone…"
          >
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger
                className="w-[170px]"
                aria-label="Filter by property type"
              >
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {propertyTypes.map((type) => (
                  <SelectItem key={type} value={type} className="capitalize">
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

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
              count: statusCounts[status] ?? 0,
            }))}
          />
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[280px]">
                  <SortButton column="title">Property</SortButton>
                </TableHead>
                <TableHead>
                  <SortButton column="propertyType">Type</SortButton>
                </TableHead>
                <TableHead className="min-w-[150px]">
                  <SortButton column="location">Location</SortButton>
                </TableHead>
                <TableHead>
                  <SortButton column="price">Price</SortButton>
                </TableHead>
                <TableHead>
                  <SortButton column="status">Status</SortButton>
                </TableHead>
                <TableHead className="whitespace-nowrap">
                  <SortButton column="createdAt">Created</SortButton>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableSkeleton
                  rows={table.pageSize > 10 ? 10 : table.pageSize}
                  columns={COLUMN_COUNT}
                />
              ) : error ? (
                <ErrorRow
                  colSpan={COLUMN_COUNT}
                  message={error}
                  onRetry={() => void load()}
                />
              ) : properties.length === 0 ? (
                <EmptyRow
                  colSpan={COLUMN_COUNT}
                  icon={Building2}
                  title="No properties yet"
                  description="Add your first listing and it will show up here."
                  action={
                    <Button
                      size="sm"
                      onClick={() =>
                        router.push("/dashboard/property/add-property")
                      }
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add Property
                    </Button>
                  }
                />
              ) : table.matchedCount === 0 ? (
                <NoResultsRow
                  colSpan={COLUMN_COUNT}
                  search={table.search}
                  onReset={resetAll}
                />
              ) : (
                table.rows.map((property) => {
                  const busy = busyId === property._id;
                  return (
                    <TableRow
                      key={property._id}
                      className={cn(busy && "opacity-60")}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Thumbnail
                            src={property.mainPhotoUrl}
                            alt={property.title}
                          />
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => void openPreview(property._id)}
                              className="block max-w-[260px] truncate text-left font-medium hover:text-primary hover:underline"
                            >
                              {property.title}
                            </button>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {property.bedrooms ?? 0} beds ·{" "}
                              {property.bathrooms ?? 0} baths ·{" "}
                              {property.areaSize ?? 0} sq ft
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {property.propertyType ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <p className="max-w-[170px] truncate text-sm">
                          {property.location ?? "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {typeof property.area === "object"
                            ? (property.area?.city?.name ?? property.city ?? "")
                            : (property.city ?? "")}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className="font-semibold tabular-nums">
                          Rs {property.price?.toLocaleString("en-PK") ?? "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {property.listingType === "rent"
                            ? "per month"
                            : "total"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            STATUS_STYLES[property.status] ??
                            "bg-muted text-muted-foreground"
                          }
                        >
                          {titleCase(property.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDate(property.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {property.status === "draft" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 hover:bg-emerald-50"
                                  disabled={busy}
                                  onClick={() =>
                                    void changeStatus(
                                      property,
                                      isAdmin ? "approved" : "pending",
                                    )
                                  }
                                >
                                  <Send className="h-4 w-4 text-emerald-600" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {isAdmin ? "Publish" : "Submit for approval"}
                              </TooltipContent>
                            </Tooltip>
                          )}

                          {isAdmin && property.status !== "draft" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  disabled={busy}
                                  onClick={() => void changeStatus(property)}
                                >
                                  {property.status === "approved" ? (
                                    <X className="h-4 w-4 text-amber-600" />
                                  ) : (
                                    <Check className="h-4 w-4 text-emerald-600" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {property.status === "approved"
                                  ? "Unpublish"
                                  : "Approve"}
                              </TooltipContent>
                            </Tooltip>
                          )}

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => void openPreview(property._id)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Preview</TooltipContent>
                          </Tooltip>

                          {isAdmin && (
                            <>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    asChild
                                  >
                                    <Link
                                      href={`/dashboard/property/edit/${property._id}`}
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
                                    onClick={() => requestDelete(property)}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Delete</TooltipContent>
                              </Tooltip>
                            </>
                          )}
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
              itemLabel="properties"
              onPageChange={table.setPage}
              onPageSizeChange={table.setPageSize}
            />
          </div>
        )}
      </DataCard>

      <PropertyPreviewDialog
        property={preview}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        loading={previewLoading && !preview}
        canEdit={isAdmin}
      />

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}

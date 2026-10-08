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
  ShieldAlert,
  ShieldCheck,
  SquarePen,
  Trash2,
  X,
  Play,
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
import { Skeleton } from "@/components/ui/skeleton";
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
import { PROPERTY_TYPE_ORDER } from "@/lib/types/property-utils";
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
  useServerTable,
} from "@/components/dashboard";
import { apiErrorMessage } from "@/components/dashboard/api-error";
import { amountShort, propertySizeLabel } from "@/lib/pk";
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

// Property, Type, Location, Price, Status, Views, Created, Actions.
const COLUMN_COUNT = 8;

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
/**
 * Why the brain held this listing — or that it published it itself.
 *
 * The reasons are the whole point: "Phone number in the description" is a
 * ten-second decision, an unexplained queue is an afternoon.
 */
function ModerationNote({
  property,
}: {
  property: {
    status?: string;
    moderationScore?: number;
    moderationReasons?: string[];
    autoPublished?: boolean;
  };
}) {
  const score = property.moderationScore ?? 0;
  const reasons = property.moderationReasons ?? [];

  if (property.status === "pending" && reasons.length > 0) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="mt-1 inline-flex cursor-help items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
            <ShieldAlert className="h-3 w-3" />
            Held · {score}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="mb-1 font-semibold">Why this needs checking</p>
          <ul className="list-disc space-y-0.5 pl-4 text-xs">
            {reasons.slice(0, 6).map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (property.autoPublished && property.status === "approved") {
    return (
      <span
        title={`Published automatically — risk score ${score}/100`}
        className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800"
      >
        <ShieldCheck className="h-3 w-3" />
        Auto
      </span>
    );
  }

  return null;
}

/** Call taps + WhatsApp taps: the enquiries a listing produced. */
function contactsOf(property: {
  phoneClicks?: number;
  whatsappClicks?: number;
}): number {
  return (property.phoneClicks ?? 0) + (property.whatsappClicks ?? 0);
}

function Thumbnail({
  src,
  alt,
  videoUrl,
  videoPosterUrl,
}: {
  src?: string;
  alt: string;
  videoUrl?: string | null;
  videoPosterUrl?: string | null;
}) {
  // Track which src failed, so a row whose image changes retries on its own.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const effectiveSrc = src || videoPosterUrl || "";
  const failed = Boolean(effectiveSrc) && failedSrc === effectiveSrc;
  const isVideo = Boolean(videoUrl || videoPosterUrl);

  if ((!effectiveSrc || failed) && !videoUrl) {
    return (
      <div className="flex h-11 w-14 shrink-0 items-center justify-center rounded-md bg-muted">
        <ImageOff className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="relative h-11 w-14 shrink-0 overflow-hidden rounded-md border bg-black">
      {effectiveSrc && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={effectiveSrc}
          alt={alt}
          loading="lazy"
          onError={() => setFailedSrc(effectiveSrc)}
          className="h-full w-full object-cover"
        />
      ) : videoUrl ? (
        <video
          src={`${videoUrl}#t=0.5`}
          preload="metadata"
          muted
          playsInline
          className="h-full w-full object-cover pointer-events-none"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-muted">
          <ImageOff className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      {isVideo && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/20">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white shadow">
            <Play className="h-2.5 w-2.5 fill-white text-white ml-0.5" />
          </div>
        </div>
      )}
    </div>
  );
}

export default function PropertiesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  // Status counts come from a single aggregation rather than from counting a
  // full download of every property in the browser.
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});

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

  const loadStats = useCallback(async () => {
    try {
      const stats = await propertyApi.getDashboardStats();
      setStatusCounts({ all: stats.total, ...stats.byStatus });
    } catch {
      // Counts are decoration on the filter chips; the table still works.
      setStatusCounts({});
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const filters = useMemo(
    () => ({ status: statusFilter, propertyType: typeFilter }),
    [statusFilter, typeFilter],
  );

  const fetchPage = useCallback(
    async (
      query: {
        page: number;
        limit: number;
        search: string;
        sortBy: string | null;
        sortDir: "asc" | "desc";
      },
      signal: AbortSignal,
    ) => {
      const result = await propertyApi.getAllProperties(
        {
          page: query.page,
          limit: query.limit,
          search: query.search,
          status: statusFilter,
          propertyType: typeFilter,
          sortBy: query.sortBy ?? undefined,
          sortDir: query.sortDir,
        },
        signal,
      );
      return { rows: result.properties, total: result.total };
    },
    [statusFilter, typeFilter],
  );

  const table = useServerTable<BackendProperty>({
    fetchPage,
    filters,
    initialPageSize: 25,
    initialSortKey: "createdAt",
    initialSortDirection: "desc",
  });

  const openPreview = async (propertyId: string) => {
    setPreviewOpen(true);
    setPreviewLoading(true);
    // Show what the list already knows while the full record loads. The list
    // no longer carries `description` or the photo gallery, so the detail
    // request is what fills those in.
    setPreview(
      table.rows.find((property) => property._id === propertyId) ?? null,
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
      // Patch in place so the current page, scroll position and filters survive.
      table.patchRow((item) => item._id === property._id, { status: next });
      void loadStats();
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
          table.removeRow((item) => item._id === property._id);
          void loadStats();
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
    column: string;
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

  // Nothing at all vs. nothing matching this filter — only the second offers
  // "clear filters". The page payload can no longer tell us the unfiltered
  // total, so the stats aggregation answers that.
  const totalEverything = statusCounts.all ?? 0;
  const showEmptyState =
    table.matchedCount === 0 && !filtersActive && totalEverything === 0;

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
              onClick={() => {
                table.reload();
                void loadStats();
              }}
              disabled={table.refreshing}
            >
              <RefreshCcw
                className={cn(
                  "mr-2 h-4 w-4",
                  table.refreshing && "animate-spin",
                )}
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
                {PROPERTY_TYPE_ORDER.map((type) => (
                  <SelectItem key={type} value={type} className="capitalize">
                    {titleCase(type)}
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
              label: titleCase(status),
              count: statusCounts[status],
            }))}
          />
        </div>

        {/*
          Phones get cards. The table stays for tablets and up, where seven
          columns actually fit.
        */}
        <div
          className={cn(
            "space-y-3 p-4 transition-opacity md:hidden",
            table.refreshing && "opacity-60",
          )}
        >
          {table.loading ? (
            [0, 1, 2, 3, 4].map((row) => (
              <Skeleton key={row} className="h-32 w-full rounded-xl" />
            ))
          ) : table.error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm">
              <p className="font-medium text-red-900">{table.error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={table.reload}
              >
                Try again
              </Button>
            </div>
          ) : table.rows.length === 0 ? (
            <div className="py-10 text-center">
              <Building2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {showEmptyState
                  ? "No properties yet."
                  : "Nothing matches those filters."}
              </p>
              {showEmptyState ? (
                <Button
                  size="sm"
                  className="mt-4"
                  onClick={() => router.push("/dashboard/property/add-property")}
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Property
                </Button>
              ) : (
                <Button variant="outline" size="sm" className="mt-4" onClick={resetAll}>
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            table.rows.map((property) => {
              const busy = busyId === property._id;
              const contacts = contactsOf(property);

              return (
                <div
                  key={property._id}
                  className={cn(
                    "rounded-xl border bg-card p-3",
                    busy && "opacity-60",
                  )}
                >
                  <div className="flex gap-3">
                    <Thumbnail
                      src={property.mainPhotoUrl}
                      alt={property.title}
                      videoUrl={property.videoUrl}
                      videoPosterUrl={property.videoPosterUrl}
                    />
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => void openPreview(property._id)}
                        className="block w-full truncate text-left text-sm font-semibold"
                      >
                        {property.title}
                      </button>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {property.location ?? "—"}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-sm font-semibold tabular-nums">
                          {amountShort(property.price) || "—"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {propertySizeLabel(property)}
                        </span>
                        <span className="ml-auto flex shrink-0 flex-col items-end">
                          <Badge
                            className={cn(
                              STATUS_STYLES[property.status] ??
                                "bg-muted text-muted-foreground",
                            )}
                          >
                            {titleCase(property.status)}
                          </Badge>
                          <ModerationNote property={property} />
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-center gap-4 border-t pt-2.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 tabular-nums">
                      <Eye className="h-3.5 w-3.5" />
                      {(property.views ?? 0).toLocaleString("en-PK")}
                    </span>
                    {contacts > 0 && (
                      <span className="font-medium text-emerald-700">
                        {contacts} enquir{contacts === 1 ? "y" : "ies"}
                      </span>
                    )}
                    <span className="ml-auto">
                      {formatDate(property.createdAt)}
                    </span>
                  </div>

                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {property.status === "draft" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          void changeStatus(
                            property,
                            isAdmin ? "approved" : "pending",
                          )
                        }
                      >
                        <Send className="mr-1.5 h-3.5 w-3.5" />
                        {isAdmin ? "Publish" : "Submit"}
                      </Button>
                    )}
                    {isAdmin && property.status !== "draft" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void changeStatus(property)}
                      >
                        {property.status === "approved" ? (
                          <>
                            <X className="mr-1.5 h-3.5 w-3.5" />
                            Unpublish
                          </>
                        ) : (
                          <>
                            <Check className="mr-1.5 h-3.5 w-3.5" />
                            Approve
                          </>
                        )}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/dashboard/property/edit/${property._id}`}>
                        <SquarePen className="mr-1.5 h-3.5 w-3.5" />
                        Edit
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void openPreview(property._id)}
                    >
                      <Eye className="mr-1.5 h-3.5 w-3.5" />
                      Preview
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto text-destructive hover:text-destructive"
                      disabled={busy}
                      onClick={() => requestDelete(property)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div
          className={cn(
            "hidden overflow-x-auto transition-opacity md:block",
            table.refreshing && "opacity-60",
          )}
        >
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
                  <SortButton column="views">Views</SortButton>
                </TableHead>
                <TableHead className="whitespace-nowrap">
                  <SortButton column="createdAt">Created</SortButton>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.loading ? (
                <TableSkeleton rows={10} columns={COLUMN_COUNT} />
              ) : table.error ? (
                <ErrorRow
                  colSpan={COLUMN_COUNT}
                  message={table.error}
                  onRetry={table.reload}
                />
              ) : showEmptyState ? (
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
                            videoUrl={property.videoUrl}
                            videoPosterUrl={property.videoPosterUrl}
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
                              {propertySizeLabel(property)}
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
                        {/* The same amount the way it is advertised. */}
                        <p className="text-xs font-medium text-emerald-700">
                          {amountShort(property.price)}
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
                        <ModerationNote property={property} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span className="flex items-center gap-1.5 text-sm tabular-nums">
                          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                          {(property.views ?? 0).toLocaleString("en-PK")}
                        </span>
                        {contactsOf(property) > 0 && (
                          <span className="mt-0.5 block text-xs text-emerald-700">
                            {contactsOf(property)} enquir
                            {contactsOf(property) === 1 ? "y" : "ies"}
                          </span>
                        )}
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

                          {/*
                            Edit and Delete used to be admin-only here. The
                            dashboard list is owner-scoped and the API checks
                            ownership on both routes, so every row an agent can
                            see is one they are allowed to change — hiding the
                            buttons just meant going the long way round.
                          */}
                          {true && (
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

        {!table.loading && !table.error && table.matchedCount > 0 && (
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
        canEdit
      />

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}

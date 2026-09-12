"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  FileEdit,
  FileText,
  Layers,
  MapPin,
  PlusCircle,
  RefreshCcw,
  Upload,
  Users,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { propertyApi, userApi } from "@/lib/api";
import type { BackendProperty } from "@/lib/types/property-utils";
import { useAuth } from "@/context/auth-context";
import {
  DataCard,
  DataCardHeader,
  DataCardTitle,
  EmptyRow,
  ErrorRow,
  PageHeader,
  StatCard,
  TableSkeleton,
  type StatTone,
} from "@/components/dashboard";

type PropertyStatus = "draft" | "pending" | "approved" | "rejected";

const STATUS_STYLES: Record<PropertyStatus, string> = {
  approved: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  pending: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  rejected: "bg-red-100 text-red-800 hover:bg-red-100",
  draft: "bg-slate-200 text-slate-700 hover:bg-slate-200",
};

function StatusBadge({ status }: { status: string }) {
  const style =
    STATUS_STYLES[status as PropertyStatus] ?? "bg-muted text-muted-foreground";
  return (
    <Badge className={style}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
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

function formatPrice(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return `Rs ${value.toLocaleString("en-PK")}`;
}

interface QuickAction {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "Add Property",
    href: "/dashboard/property/add-property",
    icon: PlusCircle,
  },
  {
    label: "Bulk Import",
    href: "/dashboard/import",
    icon: Upload,
    adminOnly: true,
  },
  {
    label: "Write Blog Post",
    href: "/dashboard/blog/add-blog",
    icon: FileText,
    adminOnly: true,
  },
  {
    label: "Material Rates",
    href: "/dashboard/cement-rate",
    icon: Layers,
    adminOnly: true,
  },
  { label: "Add Area", href: "/dashboard/area/add-area", icon: MapPin },
  {
    label: "Manage Users",
    href: "/dashboard/users",
    icon: Users,
    adminOnly: true,
  },
];

export default function DashboardOverview() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [recent, setRecent] = useState<BackendProperty[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [userCount, setUserCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Two small requests instead of one enormous one.
   *
   * This page used to call `getAllProperties()` with no arguments — every
   * property the user could see — purely to show eight rows and count four
   * statuses. Now the counts come from an aggregation and the table asks for
   * exactly the eight rows it renders.
   */
  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [stats, page] = await Promise.all([
        propertyApi.getDashboardStats(),
        propertyApi.getAllProperties({
          page: 1,
          limit: 8,
          sortBy: "createdAt",
          sortDir: "desc",
        }),
      ]);
      setCounts({ all: stats.total, ...stats.byStatus });
      setRecent(page.properties);
    } catch (err) {
      console.error("Error loading dashboard:", err);
      setError(
        "Could not reach the server. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Admin-only side metric. Failure here must not blank out the whole page.
  // Uses the counts endpoint rather than downloading every user to read
  // `.length` off the array.
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await userApi.getStats();
        if (!cancelled) setUserCount(data.total);
      } catch {
        if (!cancelled) setUserCount(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const stats: {
    label: string;
    value: number | string;
    icon: React.ComponentType<{ className?: string }>;
    tone: StatTone;
    hint?: string;
    href?: string;
  }[] = [
    {
      label: isAdmin ? "Total Properties" : "My Properties",
      value: counts.all ?? 0,
      icon: Building2,
      tone: "info",
      href: "/dashboard/property",
    },
    {
      label: "Published",
      value: counts.approved ?? 0,
      icon: CheckCircle2,
      tone: "success",
      hint: "Live on the website",
      href: "/dashboard/property?status=approved",
    },
    {
      label: isAdmin ? "Awaiting Review" : "Submitted",
      value: counts.pending ?? 0,
      icon: Clock,
      tone: "warning",
      hint: isAdmin ? "Needs your approval" : "Waiting for admin approval",
      href: "/dashboard/property?status=pending",
    },
    {
      label: "Drafts",
      value: counts.draft ?? 0,
      icon: FileEdit,
      tone: "neutral",
      hint: "Not submitted yet",
      href: "/dashboard/property?status=draft",
    },
  ];

  if (isAdmin) {
    stats.push(
      {
        label: "Rejected",
        value: counts.rejected ?? 0,
        icon: XCircle,
        tone: "danger",
        href: "/dashboard/property?status=rejected",
      },
      {
        label: "Registered Users",
        value: userCount ?? "—",
        icon: Users,
        tone: "neutral",
        hint: userCount === null ? "Unavailable" : "Agents and customers",
        href: "/dashboard/users",
      },
    );
  }

  const actions = QUICK_ACTIONS.filter(
    (action) => isAdmin || !action.adminOnly,
  );
  const pendingCount = counts.pending ?? 0;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <PageHeader
        title={`Welcome back${user?.name ? `, ${user.name.split(" ")[0]}` : ""}`}
        description={
          isAdmin
            ? "Portfolio health, pending approvals and recent activity across the platform."
            : "Your listings at a glance."
        }
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCcw
                className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
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

      {/* Approval nudge - the one thing an admin most often opens this page for. */}
      {isAdmin && !loading && pendingCount > 0 && (
        <Link
          href="/dashboard/property?status=pending"
          className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm transition-colors hover:bg-amber-100"
        >
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
          <span className="text-amber-900">
            <span className="font-semibold">
              {pendingCount}{" "}
              {pendingCount === 1 ? "property is" : "properties are"}
            </span>{" "}
            waiting for approval.
          </span>
          <span className="ml-auto shrink-0 font-medium text-amber-900">
            Review now →
          </span>
        </Link>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} loading={loading} />
        ))}
      </div>

      {/* Quick actions */}
      <DataCard>
        <DataCardTitle hint="Jump straight to the work">
          Quick actions
        </DataCardTitle>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {actions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="flex flex-col items-center gap-2 rounded-lg border bg-background p-4 text-center text-sm font-medium transition-colors hover:border-primary/40 hover:bg-accent"
            >
              <action.icon className="h-5 w-5 text-primary" />
              <span>{action.label}</span>
            </Link>
          ))}
        </div>
      </DataCard>

      {/* Recent activity */}
      <DataCard flush>
        <DataCardHeader>
          <DataCardTitle hint="The 8 most recently created listings">
            Recent properties
          </DataCardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/property">View all</Link>
          </Button>
        </DataCardHeader>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[220px]">Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="min-w-[140px]">Location</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableSkeleton rows={5} columns={7} />
              ) : error ? (
                <ErrorRow
                  colSpan={7}
                  message={error}
                  onRetry={() => void load()}
                />
              ) : recent.length === 0 ? (
                <EmptyRow
                  colSpan={7}
                  icon={Building2}
                  title="No properties yet"
                  description="Add your first listing to see it appear here."
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
              ) : (
                recent.map((property) => (
                  <TableRow key={property._id}>
                    <TableCell>
                      <p className="max-w-[280px] truncate font-medium">
                        {property.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {property.bedrooms ?? 0} beds ·{" "}
                        {property.bathrooms ?? 0} baths ·{" "}
                        {property.areaSize ?? 0} sq ft
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {property.propertyType ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <p className="max-w-[160px] truncate text-sm">
                        {property.location ?? "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {property.city ?? ""}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold tabular-nums">
                        {formatPrice(property.price)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {property.listingType === "rent"
                          ? "per month"
                          : "total"}
                      </p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={property.status ?? "draft"} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(property.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      {/*
                        These three buttons used to be console.log stubs - the
                        delete even asked for confirmation and then did nothing.
                        Management lives on the Properties page, so this links
                        there instead of half-implementing it twice.
                      */}
                      <Button variant="ghost" size="sm" asChild>
                        <Link href="/dashboard/property">Manage</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DataCard>
    </div>
  );
}

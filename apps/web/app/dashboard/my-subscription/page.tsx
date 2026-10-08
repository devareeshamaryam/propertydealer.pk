"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  CreditCard,
  Layers,
  Loader2,
  PlusCircle,
  RefreshCcw,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { subscriptionApi } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";
import {
  ConfirmDialog,
  DataCard,
  DataCardTitle,
  PageHeader,
  StatCard,
  useConfirm,
} from "@/components/dashboard";
import { apiErrorMessage } from "@/components/dashboard/api-error";
import { CheckoutDialog } from "@/components/billing/checkout-dialog";
import { amountShort } from "@/lib/pk";

interface PackageRef {
  name?: string;
  price?: number;
  propertyLimit?: number;
  duration?: number;
}

/** What GET /subscriptions/my-plan returns — the Free tier included. */
interface EffectivePlan {
  tier: "free" | "paid";
  name: string;
  propertyLimit: number;
  used: number;
  remaining: number;
  canCreate: boolean;
}

interface SubscriptionRecord {
  _id: string;
  status?: string;
  /* The invoice half of a purchase — see subscription.schema.ts. */
  invoiceNumber?: string;
  amount?: number;
  planName?: string;
  planDurationDays?: number;
  planPropertyLimit?: number;
  paymentStatus?: string;
  rejectionReason?: string;
  startDate?: string;
  endDate?: string;
  propertiesUsed?: number;
  packageId?: PackageRef | string | null;
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  pending: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  expired: "bg-slate-200 text-slate-700 hover:bg-slate-200",
  cancelled: "bg-red-100 text-red-800 hover:bg-red-100",
};

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-PK", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * `packageId` comes back populated on some endpoints and as a bare ObjectId on
 * others. The previous version read `.packageId.name` directly, which threw
 * and blanked the page whenever it was not populated.
 */
function packageOf(sub?: SubscriptionRecord | null): PackageRef {
  if (sub?.packageId && typeof sub.packageId === "object") return sub.packageId;
  return {};
}

function daysRemaining(endDate?: string) {
  if (!endDate) return null;
  const end = new Date(endDate);
  if (Number.isNaN(end.getTime())) return null;
  const diff = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

export default function MySubscriptionPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [active, setActive] = useState<SubscriptionRecord | null>(null);
  /** The entitlement in force when there is no paid subscription. */
  const [freePlan, setFreePlan] = useState<EffectivePlan | null>(null);
  const [history, setHistory] = useState<SubscriptionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [checkout, setCheckout] = useState<SubscriptionRecord | null>(null);

  const { confirm, dialogProps } = useConfirm();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // The active subscription is optional (a 404 is a normal "no plan"
      // answer), so it must not take the history down with it.
      const [activeResult, historyResult, planResult] =
        await Promise.allSettled([
          subscriptionApi.getActiveSubscription(),
          subscriptionApi.getMySubscriptions(),
          subscriptionApi.getMyPlan(),
        ]);

      setActive(
        activeResult.status === "fulfilled"
          ? (activeResult.value ?? null)
          : null,
      );

      // Optional: an older API build has no /my-plan. The card then falls back
      // to naming the Free plan without the usage numbers.
      setFreePlan(
        planResult.status === "fulfilled" ? (planResult.value ?? null) : null,
      );

      if (historyResult.status === "fulfilled") {
        setHistory(
          Array.isArray(historyResult.value) ? historyResult.value : [],
        );
      } else {
        throw historyResult.reason;
      }
    } catch (err) {
      console.error("Error fetching subscriptions:", err);
      setError(
        apiErrorMessage(
          err,
          "Could not load your subscription. Check your connection and try again.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      // The layout redirects; just stop the spinner.
      setLoading(false);
      return;
    }
    void load();
  }, [authLoading, isAuthenticated, load]);

  const plan = packageOf(active);
  const remaining = daysRemaining(active?.endDate);
  const used = active?.propertiesUsed ?? 0;
  const limit = plan.propertyLimit;
  const usagePercent =
    typeof limit === "number" && limit > 0
      ? Math.min(100, Math.round((used / limit) * 100))
      : null;

  /*
   * A purchase that has not been paid for yet, or whose payment was rejected.
   *
   * This is the thing an agent comes back to this page for, and before the
   * checkout existed there was nothing to come back to: the row said "pending"
   * with no amount, no account and no way to say they had paid.
   */
  const unpaid = useMemo(
    () =>
      history.find(
        (row) =>
          row.status !== "active" &&
          (row.paymentStatus === "pending" || row.paymentStatus === "failed"),
      ) ?? null,
    [history],
  );

  const awaitingReview = useMemo(
    () => history.find((row) => row.paymentStatus === "submitted") ?? null,
    [history],
  );

  const sortedHistory = useMemo(
    () =>
      [...history].sort(
        (a, b) =>
          new Date(b.startDate ?? 0).getTime() -
          new Date(a.startDate ?? 0).getTime(),
      ),
    [history],
  );

  const requestCancel = () => {
    if (!active) return;
    confirm({
      title: "Cancel your subscription?",
      description: `You will keep access until ${formatDate(
        active.endDate,
      )}, after which you will not be able to publish new listings.`,
      confirmLabel: "Cancel subscription",
      onConfirm: async () => {
        try {
          setCancelling(true);
          await subscriptionApi.cancel(active._id);
          toast.success("Subscription cancelled");
          await load();
        } catch (err) {
          console.error("Error cancelling subscription:", err);
          toast.error("Could not cancel subscription", {
            description: apiErrorMessage(err, "Please try again."),
          });
        } finally {
          setCancelling(false);
        }
      },
    });
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-5">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <PageHeader
        title="My Subscription"
        description="Your current plan, listing usage and billing history."
        actions={
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm">
          <TriangleAlert className="mt-0.5 h-4.5 w-4.5 shrink-0 text-red-600" />
          <div className="flex-1">
            <p className="font-medium text-red-900">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => void load()}
            >
              Try again
            </Button>
          </div>
        </div>
      )}

      {/* Unpaid invoice: the one action that matters on this page. */}
      {unpaid && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              {unpaid.paymentStatus === "failed"
                ? "Your payment could not be verified"
                : "Payment pending"}
            </p>
            <p className="mt-0.5 text-sm">
              {unpaid.invoiceNumber ? `${unpaid.invoiceNumber} · ` : ""}
              {unpaid.planName ?? "Plan"}
              {typeof unpaid.amount === "number" ? ` · ${amountShort(unpaid.amount)}` : ""}
              {unpaid.rejectionReason ? ` — ${unpaid.rejectionReason}` : ""}
            </p>
          </div>
          <Button className="shrink-0" onClick={() => setCheckout(unpaid)}>
            <CreditCard className="mr-2 h-4 w-4" />
            {unpaid.paymentStatus === "failed" ? "Try again" : "Complete payment"}
          </Button>
        </div>
      )}

      {awaitingReview && (
        <div className="rounded-xl border bg-muted/40 p-4 text-sm">
          <p className="font-semibold">Payment submitted — being verified</p>
          <p className="mt-0.5 text-muted-foreground">
            {awaitingReview.invoiceNumber ? `${awaitingReview.invoiceNumber} · ` : ""}
            {awaitingReview.planName ?? "Plan"} — your plan activates as soon as
            an admin checks the screenshot.
          </p>
        </div>
      )}

      {active ? (
        <>
          {/* Current plan */}
          <div className="rounded-xl bg-gradient-to-br from-primary to-primary/80 p-6 text-primary-foreground shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm text-primary-foreground/80">
                  Current plan
                </p>
                <h2 className="mt-1 text-2xl font-bold">
                  {plan.name ?? "Subscription"}
                </h2>
                {typeof plan.price === "number" && (
                  <p className="mt-1 text-sm text-primary-foreground/80">
                    Rs {plan.price.toLocaleString("en-PK")}
                    {plan.duration ? ` · ${plan.duration} days` : ""}
                  </p>
                )}
              </div>
              <Badge className="bg-primary-foreground text-primary hover:bg-primary-foreground">
                {(active.status ?? "active").charAt(0).toUpperCase() +
                  (active.status ?? "active").slice(1)}
              </Badge>
            </div>

            {usagePercent !== null && (
              <div className="mt-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-primary-foreground/80">
                    Listings used
                  </span>
                  <span className="font-semibold tabular-nums">
                    {used} / {limit}
                  </span>
                </div>
                <Progress
                  value={usagePercent}
                  className="mt-2 h-2 bg-primary-foreground/20 [&>div]:bg-primary-foreground"
                />
                {usagePercent >= 90 && (
                  <p className="mt-2 text-sm text-primary-foreground/90">
                    You have nearly reached your listing limit.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Key numbers */}
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Days remaining"
              value={remaining ?? "—"}
              icon={CalendarClock}
              tone={remaining !== null && remaining <= 7 ? "warning" : "info"}
              hint={
                remaining === 0
                  ? "Expired"
                  : `Expires ${formatDate(active.endDate)}`
              }
            />
            <StatCard
              label="Listings used"
              value={typeof limit === "number" ? `${used} / ${limit}` : used}
              icon={Layers}
              tone={
                usagePercent !== null && usagePercent >= 90
                  ? "warning"
                  : "neutral"
              }
              hint="Against your plan limit"
            />
            <StatCard
              label="Started on"
              value={formatDate(active.startDate)}
              icon={CreditCard}
              tone="neutral"
            />
          </div>

          {/* Actions */}
          <DataCard>
            <DataCardTitle hint="Manage your plan">Actions</DataCardTitle>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/dashboard/property/add-property">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  List New Property
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/dashboard/purchase-package">Change Package</Link>
              </Button>
              <Button
                variant="outline"
                onClick={requestCancel}
                disabled={cancelling}
              >
                {cancelling && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Cancel Subscription
              </Button>
            </div>
          </DataCard>
        </>
      ) : (
        !error && (
          /*
           * The Free plan, not an empty state.
           *
           * This card used to read "No active subscription — buy a package to
           * start publishing", which was wrong: every account can publish its
           * first listing without paying. The numbers come from the API's own
           * entitlement check, so what this says and what a save is allowed to
           * do cannot drift apart.
           */
          <>
            <div className="rounded-xl border bg-muted/40 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Current plan</p>
                  <h2 className="mt-1 text-2xl font-bold">
                    {freePlan?.name ?? "Free"}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Included with your account — no payment needed.
                  </p>
                </div>
                <Badge variant="secondary">Active</Badge>
              </div>

              {freePlan && freePlan.propertyLimit > 0 && (
                <div className="mt-6">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Listings used</span>
                    <span className="font-semibold tabular-nums">
                      {freePlan.used} / {freePlan.propertyLimit}
                    </span>
                  </div>
                  <Progress
                    value={Math.min(
                      100,
                      Math.round(
                        (freePlan.used / freePlan.propertyLimit) * 100,
                      ),
                    )}
                    className="mt-2 h-2"
                  />
                  <p className="mt-2 text-sm text-muted-foreground">
                    {freePlan.canCreate
                      ? `You can publish ${freePlan.remaining} more ${
                          freePlan.remaining === 1 ? "listing" : "listings"
                        } on the Free plan.`
                      : "You have used your free listing. Choose a package to publish more."}
                  </p>
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-2">
                {/* Hidden rather than disabled when the free listing is used
                    up: `asChild` hands rendering to the Link, which ignores
                    `disabled` and would stay clickable. */}
                {(!freePlan || freePlan.canCreate) && (
                  <Button asChild>
                    <Link href="/dashboard/property/add-property">
                      <PlusCircle className="mr-2 h-4 w-4" />
                      List New Property
                    </Link>
                  </Button>
                )}
                <Button variant="outline" asChild>
                  <Link href="/dashboard/purchase-package">
                    <CreditCard className="mr-2 h-4 w-4" />
                    View Packages
                  </Link>
                </Button>
              </div>
            </div>
          </>
        )
      )}

      {/* History */}
      <DataCard>
        <DataCardTitle hint="Every plan you have had">
          Subscription history
        </DataCardTitle>
        <Separator className="my-4" />
        {sortedHistory.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            No subscription history yet.
          </p>
        ) : (
          <ul className="divide-y">
            {sortedHistory.map((sub) => {
              const subPlan = packageOf(sub);
              return (
                <li
                  key={sub._id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {subPlan.name ?? "Subscription"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(sub.startDate)} – {formatDate(sub.endDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {typeof subPlan.price === "number" && (
                      <span className="text-sm tabular-nums text-muted-foreground">
                        Rs {subPlan.price.toLocaleString("en-PK")}
                      </span>
                    )}
                    <Badge
                      className={cn(
                        STATUS_STYLES[sub.status ?? ""] ??
                          "bg-muted text-muted-foreground",
                      )}
                    >
                      {(sub.status ?? "unknown").charAt(0).toUpperCase() +
                        (sub.status ?? "unknown").slice(1)}
                    </Badge>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </DataCard>

      <ConfirmDialog {...dialogProps} />

      <CheckoutDialog
        invoice={checkout}
        onClose={() => setCheckout(null)}
        onSubmitted={() => void load()}
      />
    </div>
  );
}

"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, Loader2, Package2, RefreshCcw, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { packageApi, subscriptionApi, type MyPlan } from "@/lib/api";
import PlanCards from "@/components/plans/PlanCards";
import { planBenefits, planDuration, type Plan } from "@/lib/plans";
import { cn } from "@/lib/utils";
import {
  DataCard,
  DataCardTitle,
  PageHeader,
} from "@/components/dashboard";
import { apiErrorMessage } from "@/components/dashboard/api-error";
import {
  CheckoutDialog,
  type CheckoutInvoice,
} from "@/components/billing/checkout-dialog";

interface PackageRecord {
  _id: string;
  name: string;
  description?: string;
  price: number;
  duration: number;
  propertyLimit?: number;
  featuredListings?: number;
  photosPerProperty?: number;
  features?: string[];
  isActive?: boolean;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function PurchaseContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const packageId = searchParams?.get("packageId") ?? null;

  const [selected, setSelected] = useState<PackageRecord | null>(null);
  const [options, setOptions] = useState<PackageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  /*
   * Why the checkout did not open, on the page rather than in a toast.
   *
   * ConfirmDialog closes as soon as onConfirm resolves, and onConfirm here
   * catches its own errors — so a refused purchase looked like the dialog
   * simply shutting, with a toast that was gone before anyone read it. The
   * reason now stays on screen until the next attempt.
   */
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<CheckoutInvoice | null>(null);
  const [myPlan, setMyPlan] = useState<MyPlan | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    subscriptionApi.getMyPlan().then(setMyPlan).catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (packageId) {
        const data = await packageApi.getById(packageId);
        setSelected(data ?? null);
        return;
      }

      // Reaching this page without ?packageId used to leave the spinner
      // running forever, because the fetch (and its finally block) was
      // skipped entirely. Now it shows the plans to choose from.
      const data = await packageApi.getAll();
      setOptions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching package:", err);
      setError(
        apiErrorMessage(
          err,
          "Could not load package details. Check your connection and try again.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [packageId]);

  useEffect(() => {
    void load();
  }, [load]);

  /*
   * One tap, straight to the checkout.
   *
   * There used to be a confirmation dialog in front of this — "Subscribe to
   * Starter? … Continue to payment" — and it was pure cost. It confirmed
   * nothing destructive (an unpaid invoice is replaced the moment a different
   * plan is chosen), it added a second popup to a flow that already ends in
   * one, and it was the exact control that broke twice: the dialog closed on
   * confirm whether the call had worked or not, so a failure and a success
   * looked identical from the outside.
   *
   * The checkout itself is the confirmation. It names the plan, shows the
   * amount, and nothing has been paid until the agent says so.
   */
  const startCheckout = async (pkg: PackageRecord) => {
    try {
      setPurchasing(true);
      setBusyId(pkg._id);
      setPurchaseError(null);

      const invoice = await subscriptionApi.purchase(pkg._id);

      // Free (or anything already settled) needs no checkout.
      if (invoice?.free || invoice?.paymentStatus === "completed") {
        toast.success(`${invoice?.planName ?? pkg.name} is your plan`, {
          description: "Nothing to pay — you can start listing now.",
        });
        router.push("/dashboard/my-subscription");
        return;
      }

      setCheckout({
        _id: String(invoice?._id ?? ""),
        invoiceNumber: invoice?.invoiceNumber,
        planName: invoice?.planName ?? pkg.name,
        amount: invoice?.amount ?? pkg.price,
        planDurationDays: invoice?.planDurationDays ?? pkg.duration,
        planPropertyLimit: invoice?.planPropertyLimit ?? pkg.propertyLimit,
        paymentStatus: invoice?.paymentStatus,
      });
    } catch (err) {
      console.error("Error purchasing package:", err);
      const reason = apiErrorMessage(err, "Please try again.");
      setPurchaseError(reason);
      toast.error("Could not open the checkout", { description: reason });
    } finally {
      setPurchasing(false);
      setBusyId(null);
    }
  };

  /*
   * Every branch below produces the page body, and the two dialogs are
   * rendered once, after it.
   *
   * They used to be pasted into the single-package branch only. So an agent
   * who arrived from the pricing page (/dashboard/purchase-package?packageId=…)
   * got a checkout, and an agent who arrived from the sidebar's "Buy a Plan"
   * — the list, with no packageId — clicked Continue and watched nothing
   * happen. The purchase itself went through, which is why the invoice turned
   * up in the admin screen and My Subscription started showing a pending
   * payment for a screen the agent had never been shown.
   *
   * Rendered out here, a branch cannot forget them.
   */
  const body = (() => {
  if (loading) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <PageHeader title="Purchase a Package" />
        <DataCard className="py-12 text-center">
          <p className="font-medium">{error}</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => void load()}
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </DataCard>
      </div>
    );
  }

  // Single package, chosen via ?packageId
  if (packageId) {
    if (!selected) {
      return (
        <div className="mx-auto w-full max-w-3xl space-y-5">
          <PageHeader title="Purchase a Package" />
          <DataCard className="py-12 text-center">
            <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Package2 className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Package not found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  It may have been removed or deactivated.
                </p>
              </div>
              <Button variant="outline" asChild>
                <Link href="/dashboard/purchase-package">
                  See available packages
                </Link>
              </Button>
            </div>
          </DataCard>
        </div>
      );
    }

    return (
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2"
          onClick={() => router.back()}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <PageHeader
          title={selected.name}
          description={
            selected.description || "Review the plan before confirming."
          }
        />

        {purchaseError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            <span className="font-semibold">Could not start the checkout.</span>{" "}
            {purchaseError}
          </div>
        )}

        <DataCard>
          <DataCardTitle hint="What this plan includes">
            Plan details
          </DataCardTitle>
          <Separator className="my-4" />

          <div className="divide-y">
            <Row
              label="Price"
              value={
                <span className="text-xl font-bold tabular-nums text-primary">
                  Rs {selected.price?.toLocaleString("en-PK")}
                </span>
              }
            />
            <Row label="Valid for" value={planDuration(selected as Plan)} />
            <Row
              label="Listing limit"
              value={`${selected.propertyLimit ?? "—"} properties`}
            />
            {typeof selected.featuredListings === "number" && (
              <Row
                label="Featured listings"
                value={selected.featuredListings}
              />
            )}
            {typeof selected.photosPerProperty === "number" && (
              <Row
                label="Photos per property"
                value={selected.photosPerProperty}
              />
            )}
          </div>

          <Separator className="my-4" />
          {/* Worked out from the plan's own limits and switches, like the cards. */}
          <ul className="grid gap-2 sm:grid-cols-2">
            {planBenefits(selected as Plan).map((b) => (
              <li
                key={b.key}
                className={cn(
                  "flex items-start gap-2.5 rounded-lg border p-3 text-sm",
                  !b.on && "opacity-55",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full",
                    b.on ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400",
                  )}
                >
                  {b.on ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                </span>
                <span>
                  <span className="block font-medium">{b.label}</span>
                  <span className="block text-xs text-muted-foreground">{b.hint}</span>
                </span>
              </li>
            ))}
          </ul>

          {myPlan?.team.role === "agent" ? (
            <p className="mt-6 rounded-lg bg-slate-50 p-3 text-center text-sm text-muted-foreground">
              Your agency manages the plan for your account. Ask your agency owner to upgrade.
            </p>
          ) : !selected.price ? (
            <p className="mt-6 rounded-lg bg-emerald-50 p-3 text-center text-sm text-emerald-800">
              Free is included with every account — there is nothing to buy.{" "}
              <Link href="/dashboard/property/add-property" className="font-semibold underline">Post a property</Link>
            </p>
          ) : myPlan?.name?.toLowerCase() === selected.name.toLowerCase() ? (
            <Button className="mt-6 w-full" size="lg" disabled={purchasing} onClick={() => void startCheckout(selected)}>
              {purchasing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Renew {selected.name}
            </Button>
          ) : (
            <>
              <Button
                className="mt-6 w-full"
                size="lg"
                disabled={purchasing}
                onClick={() => void startCheckout(selected)}
              >
                {purchasing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm purchase
              </Button>
              <p className="mt-3 text-center text-sm text-muted-foreground">
                You pay by bank transfer at the next step; the plan starts once the payment is verified.
              </p>
            </>
          )}
        </DataCard>

      </div>
    );
  }

  // No packageId: let the user pick.
  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <PageHeader
        title="Purchase a Package"
        description="Pick a plan to start publishing property listings."
        actions={
          <Button variant="outline" asChild>
            <Link href="/dashboard/my-subscription">My Subscription</Link>
          </Button>
        }
      />

      {purchaseError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <span className="font-semibold">Could not start the checkout.</span>{" "}
          {purchaseError}
        </div>
      )}

      {myPlan?.team.role === "agent" && (
        <div className="rounded-xl border bg-slate-50 px-4 py-3 text-sm text-slate-700">
          You are an agent of an agency — your listings use your agency&apos;s plan ({myPlan.name}). Only the agency owner can change it.
        </div>
      )}

      {options.length === 0 ? (
        <DataCard className="py-12 text-center">
          <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Package2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">No packages available</p>
              <p className="mt-1 text-sm text-muted-foreground">
                No active plans are on offer right now. Please check back later.
              </p>
            </div>
          </div>
        </DataCard>
      ) : (
        <PlanCards
          plans={options as Plan[]}
          current={myPlan?.name ?? null}
          busyId={busyId}
          onChoose={myPlan?.team.role === "agent" ? undefined : (p) => void startCheckout(p as PackageRecord)}
        />
      )}

    </div>
    );
  })();

  return (
    <>
      {body}

      <CheckoutDialog
        invoice={checkout}
        onClose={() => setCheckout(null)}
        onSubmitted={() => router.push("/dashboard/my-subscription")}
      />
    </>
  );
}

export default function PurchasePackagePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-3xl space-y-5">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      }
    >
      <PurchaseContent />
    </Suspense>
  );
}

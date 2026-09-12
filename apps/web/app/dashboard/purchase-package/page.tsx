"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, Loader2, Package2, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { packageApi, subscriptionApi } from "@/lib/api";
import {
  ConfirmDialog,
  DataCard,
  DataCardTitle,
  PageHeader,
  useConfirm,
} from "@/components/dashboard";
import { apiErrorMessage } from "@/components/dashboard/api-error";

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

  const { confirm, dialogProps } = useConfirm();

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

  const requestPurchase = (pkg: PackageRecord) =>
    confirm({
      title: `Subscribe to ${pkg.name}?`,
      description: `Rs ${pkg.price?.toLocaleString("en-PK")} for ${
        pkg.duration
      } days. The request is sent to an administrator for approval.`,
      confirmLabel: "Confirm purchase",
      destructive: false,
      onConfirm: async () => {
        try {
          setPurchasing(true);
          await subscriptionApi.purchase(pkg._id);
          toast.success("Subscription requested", {
            description: "An administrator will activate it shortly.",
          });
          router.push("/dashboard/my-subscription");
        } catch (err) {
          console.error("Error purchasing package:", err);
          // The old handler used window.alert() for both success and failure.
          toast.error("Could not complete purchase", {
            description: apiErrorMessage(err, "Please try again."),
          });
        } finally {
          setPurchasing(false);
        }
      },
    });

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
            <Row label="Duration" value={`${selected.duration} days`} />
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

          {(selected.features?.length ?? 0) > 0 && (
            <>
              <Separator className="my-4" />
              <ul className="space-y-2">
                {selected.features?.map((feature, index) => (
                  <li
                    key={`${feature}-${index}`}
                    className="flex items-start gap-2 text-sm"
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    {feature}
                  </li>
                ))}
              </ul>
            </>
          )}

          <Button
            className="mt-6 w-full"
            size="lg"
            disabled={purchasing}
            onClick={() => requestPurchase(selected)}
          >
            {purchasing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm purchase
          </Button>
          <p className="mt-3 text-center text-sm text-muted-foreground">
            Your request is sent to an administrator for approval.
          </p>
        </DataCard>

        <ConfirmDialog {...dialogProps} />
      </div>
    );
  }

  // No packageId: let the user pick.
  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <PageHeader
        title="Purchase a Package"
        description="Pick a plan to start publishing property listings."
        actions={
          <Button variant="outline" asChild>
            <Link href="/dashboard/my-subscription">My Subscription</Link>
          </Button>
        }
      />

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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {options.map((pkg) => (
            <DataCard key={pkg._id} className="flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-lg font-semibold">{pkg.name}</h3>
                {pkg.isActive === false && (
                  <Badge variant="secondary">Inactive</Badge>
                )}
              </div>
              {pkg.description && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {pkg.description}
                </p>
              )}

              <p className="mt-4 text-3xl font-bold tabular-nums text-primary">
                Rs {pkg.price?.toLocaleString("en-PK")}
              </p>
              <p className="text-sm text-muted-foreground">
                for {pkg.duration} days
              </p>

              <Separator className="my-4" />

              <ul className="flex-1 space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  {pkg.propertyLimit ?? "—"} property listings
                </li>
                {typeof pkg.featuredListings === "number" &&
                  pkg.featuredListings > 0 && (
                    <li className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      {pkg.featuredListings} featured listings
                    </li>
                  )}
                {pkg.features?.slice(0, 3).map((feature, index) => (
                  <li
                    key={`${feature}-${index}`}
                    className="flex items-start gap-2"
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Button
                className="mt-5 w-full"
                disabled={purchasing}
                onClick={() => requestPurchase(pkg)}
              >
                Choose {pkg.name}
              </Button>
            </DataCard>
          ))}
        </div>
      )}

      <ConfirmDialog {...dialogProps} />
    </div>
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

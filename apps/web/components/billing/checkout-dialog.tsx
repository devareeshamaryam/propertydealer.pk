"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  Landmark,
  Loader2,
  Smartphone,
  TriangleAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageField } from "@/components/media";
import { apiErrorMessage } from "@/components/dashboard/api-error";
import { subscriptionApi, type PaymentMethodRecord } from "@/lib/api";
import { amountShort } from "@/lib/pk";
import { cn } from "@/lib/utils";

/**
 * Checkout, Pakistani style.
 *
 * There is no card gateway — and for this market that is not a shortcut, it is
 * the normal way: the agent sends money by JazzCash, Easypaisa or a bank
 * transfer and then shows the screenshot. So the job of this screen is to make
 * that three steps and no guessing: here is where to send it, here is the exact
 * amount, upload the proof.
 *
 * The accounts come from the database, so the admin can change a bank account
 * without a deploy.
 */

export interface CheckoutInvoice {
  _id: string;
  invoiceNumber?: string;
  planName?: string;
  amount?: number;
  planDurationDays?: number;
  planPropertyLimit?: number;
  paymentStatus?: string;
  rejectionReason?: string;
}

interface CheckoutDialogProps {
  invoice: CheckoutInvoice | null;
  onClose: () => void;
  /** Called after a successful submission, so the caller can reload. */
  onSubmitted?: () => void;
}

const TYPE_ICON: Record<string, typeof Smartphone> = {
  jazzcash: Smartphone,
  easypaisa: Smartphone,
  bank: Landmark,
  other: Landmark,
};

export function CheckoutDialog({
  invoice,
  onClose,
  onSubmitted,
}: CheckoutDialogProps) {
  const [methods, setMethods] = useState<PaymentMethodRecord[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(true);
  const [method, setMethod] = useState("");
  const [note, setNote] = useState("");
  const [screenshot, setScreenshot] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!invoice) return;
    let cancelled = false;

    (async () => {
      try {
        setLoadingMethods(true);
        const list = await subscriptionApi.getPaymentMethods();
        if (cancelled) return;
        setMethods(list);
        setMethod(list[0]?.label ?? "");
      } catch {
        if (!cancelled) setMethods([]);
      } finally {
        if (!cancelled) setLoadingMethods(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [invoice]);

  if (!invoice) return null;

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } catch {
      toast.error("Could not copy — select the number and copy it by hand");
    }
  };

  const submit = async () => {
    if (!screenshot) {
      toast.error("Please upload the payment screenshot");
      return;
    }

    try {
      setBusy(true);
      await subscriptionApi.submitPayment(invoice._id, {
        paymentScreenshotUrl: screenshot,
        paymentMethod: method,
        paymentNote: note,
      });
      setDone(true);
      onSubmitted?.();
      setTimeout(onClose, 2200);
    } catch (error) {
      toast.error("Could not submit the payment", {
        description: apiErrorMessage(error, "Please try again."),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => !busy && onClose()}
      />

      <div className="relative z-10 flex max-h-[92vh] w-full flex-col gap-4 overflow-y-auto rounded-t-2xl border bg-card p-5 shadow-xl sm:max-w-md sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold">
              Pay {amountShort(invoice.amount) || "—"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {invoice.invoiceNumber ? `${invoice.invoiceNumber} · ` : ""}
              {invoice.planName ?? "Plan"}
              {invoice.planDurationDays ? ` · ${invoice.planDurationDays} days` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => !busy && onClose()}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-emerald-50">
              <Check className="h-7 w-7 text-emerald-600" />
            </div>
            <p className="font-semibold">Payment submitted</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Your plan activates as soon as an admin verifies the payment —
              usually the same day.
            </p>
          </div>
        ) : (
          <>
            {invoice.paymentStatus === "failed" && invoice.rejectionReason && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  <span className="font-semibold">
                    The last payment could not be verified.
                  </span>{" "}
                  {invoice.rejectionReason}
                </span>
              </div>
            )}

            {/* Step 1 — where to send it */}
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                1 · Send the money to any one of these
              </p>

              {loadingMethods ? (
                <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading payment details…
                </div>
              ) : methods.length === 0 ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900">
                  No payment accounts have been set up yet. Please contact the
                  administrator before paying.
                </p>
              ) : (
                <div className="space-y-2">
                  {methods.map((entry) => {
                    const Icon = TYPE_ICON[entry.type] ?? Landmark;
                    return (
                      <div key={entry._id} className="rounded-xl border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2 text-sm font-bold">
                            <Icon className="h-4 w-4 text-primary" />
                            {entry.label}
                          </span>
                          <button
                            type="button"
                            onClick={() => void copy(entry.accountNumber)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                          >
                            <Copy className="h-3 w-3" />
                            Copy
                          </button>
                        </div>
                        <p className="mt-1 break-all font-mono text-sm">
                          {entry.accountNumber}
                        </p>
                        {entry.accountTitle && (
                          <p className="text-xs text-muted-foreground">
                            Title: {entry.accountTitle}
                          </p>
                        )}
                        {entry.instructions && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {entry.instructions}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Step 2 — tell us how */}
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                2 · Which account did you use?
              </p>

              <div className="flex flex-wrap gap-2">
                {methods.map((entry) => (
                  <button
                    key={entry._id}
                    type="button"
                    onClick={() => setMethod(entry.label)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition-colors",
                      method === entry.label
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "hover:bg-muted",
                    )}
                  >
                    {entry.label}
                  </button>
                ))}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="checkout-note">
                  Transaction ID or sender number{" "}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="checkout-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="e.g. TID 884512 / 0300 1234567"
                />
              </div>
            </div>

            {/* Step 3 — the proof */}
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                3 · Upload the payment screenshot
              </p>
              <ImageField
                value={screenshot}
                onChange={setScreenshot}
                folder="payments"
                context={`Payment proof ${invoice.invoiceNumber ?? ""}`}
                aspect="wide"
                allowUrl={false}
                hint="The confirmation screen from JazzCash, Easypaisa or your bank app."
              />
            </div>

            <Button
              className="h-12 w-full"
              disabled={busy || !screenshot || methods.length === 0}
              onClick={() => void submit()}
            >
              {busy ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Check className="mr-2 h-5 w-5" />
              )}
              I have paid — submit for verification
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Nothing is charged automatically. An admin checks the screenshot
              and activates your plan.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default CheckoutDialog;

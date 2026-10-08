"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check, Flag, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import api from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import { loginUrl } from "@/lib/auth-intent";
import { apiErrorMessage } from "@/components/dashboard/api-error";
import { cn } from "@/lib/utils";

/**
 * "Report this listing" / "Report this agent".
 *
 * Property fraud here is social — a plot sold twice, a file that does not
 * exist, a dealer who takes a token and vanishes — and the people who find out
 * first are the buyers who called. This is how they tell somebody.
 *
 * Signing in is required: an anonymous report button is a weapon rival dealers
 * use on each other, and a name behind the complaint is what makes a pattern
 * worth acting on.
 */

const FALLBACK_REASONS = [
  "Scam or fraud",
  "Property already sold or rented",
  "Wrong or fake photos",
  "Price is not real (bait)",
  "Agent is not reachable",
  "Duplicate listing",
  "Wrong location or details",
  "Agent asked for advance payment",
  "Rude or abusive behaviour",
  "Offensive or illegal content",
  "Something else",
];

interface ReportButtonProps {
  type: "listing" | "agent";
  propertyId?: string;
  agentId?: string;
  label?: string;
  className?: string;
}

export function ReportButton({
  type,
  propertyId,
  agentId,
  label = "Report",
  className,
}: ReportButtonProps) {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [reasons, setReasons] = useState<string[]>(FALLBACK_REASONS);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // The list is maintained on the API; the local copy is only a fallback.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    api
      .get("/reports/reasons")
      .then((response) => {
        const list = response.data?.data;
        if (!cancelled && Array.isArray(list) && list.length) setReasons(list);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [open]);

  const trigger = () => {
    if (!isAuthenticated) {
      toast.info("Sign in to report this", {
        description: "We ask for an account so reports can be followed up.",
      });
      router.push(loginUrl(pathname || "/"));
      return;
    }
    setOpen(true);
  };

  const submit = async () => {
    if (!reason) {
      toast.error("Please choose a reason");
      return;
    }

    setBusy(true);
    try {
      await api.post("/reports", { type, propertyId, agentId, reason, message });
      setDone(true);
      setTimeout(() => {
        setOpen(false);
        setDone(false);
        setReason("");
        setMessage("");
      }, 1400);
    } catch (error) {
      toast.error("Could not send the report", {
        description: apiErrorMessage(error, "Please try again."),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={trigger}
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-destructive",
          className,
        )}
      >
        <Flag className="h-3.5 w-3.5" />
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !busy && setOpen(false)}
          />

          <div className="relative z-10 flex w-full flex-col gap-3 rounded-t-2xl border bg-card p-5 shadow-xl sm:max-w-md sm:rounded-xl">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-bold">
                <Flag className="h-4 w-4 text-destructive" />
                Report this {type === "agent" ? "agent" : "listing"}
              </h3>
              <button
                type="button"
                onClick={() => !busy && setOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {done ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <div className="grid h-12 w-12 place-items-center rounded-lg bg-emerald-50">
                  <Check className="h-6 w-6 text-emerald-600" />
                </div>
                <p className="text-sm font-semibold">
                  Report sent. Thank you — we will look into it.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  {reasons.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setReason(option)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                        reason === option
                          ? "border-destructive bg-destructive/5 font-medium"
                          : "hover:bg-muted",
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-4 w-4 shrink-0 place-items-center rounded-full border",
                          reason === option
                            ? "border-destructive bg-destructive"
                            : "border-muted-foreground/40",
                        )}
                      >
                        {reason === option && (
                          <Check className="h-2.5 w-2.5 text-white" />
                        )}
                      </span>
                      {option}
                    </button>
                  ))}
                </div>

                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="Anything else we should know? (optional)"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-destructive/30"
                />

                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={busy || !reason}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-destructive font-semibold text-white transition-opacity disabled:opacity-50"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Send report
                </button>

                <p className="text-center text-xs text-muted-foreground">
                  False reports are also reviewed — please only report real
                  problems.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default ReportButton;

"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Landmark,
  Loader2,
  Plus,
  RefreshCcw,
  Save,
  Smartphone,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ConfirmDialog,
  DataCard,
  DataCardTitle,
  PageHeader,
  apiErrorMessage,
  useConfirm,
} from "@/components/dashboard";
import { subscriptionApi, type PaymentMethodRecord } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Where agents send money.
 *
 * These numbers were previously nowhere: a purchase created a pending
 * subscription and the agent was told an admin would "activate it shortly",
 * with no amount and no account. They live in the database so a bank account
 * can be changed from a phone, not a deploy.
 */

const TYPES: { value: PaymentMethodRecord["type"]; label: string }[] = [
  { value: "jazzcash", label: "JazzCash" },
  { value: "easypaisa", label: "Easypaisa" },
  { value: "bank", label: "Bank transfer" },
  { value: "other", label: "Other" },
];

type Draft = Omit<PaymentMethodRecord, "_id"> & { _id?: string };

const BLANK: Draft = {
  label: "",
  type: "jazzcash",
  accountNumber: "",
  accountTitle: "",
  instructions: "",
  isActive: true,
  order: 0,
};

export default function PaymentMethodsPage() {
  const [rows, setRows] = useState<PaymentMethodRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { confirm, dialogProps } = useConfirm();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setRows(await subscriptionApi.getAllPaymentMethods());
    } catch (err) {
      setError(apiErrorMessage(err, "Could not load payment methods."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!draft) return;
    if (!draft.label.trim() || !draft.accountNumber.trim()) {
      toast.error("A name and an account number are needed");
      return;
    }

    try {
      setSaving(true);
      await subscriptionApi.savePaymentMethod(draft._id ?? null, draft);
      toast.success(draft._id ? "Saved" : "Payment method added");
      setDraft(null);
      await load();
    } catch (err) {
      toast.error("Could not save", {
        description: apiErrorMessage(err, "Please try again."),
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row: PaymentMethodRecord) => {
    try {
      setBusyId(row._id);
      await subscriptionApi.savePaymentMethod(row._id, {
        isActive: !row.isActive,
      });
      setRows((previous) =>
        previous.map((item) =>
          item._id === row._id ? { ...item, isActive: !item.isActive } : item,
        ),
      );
    } catch (err) {
      toast.error("Could not update", {
        description: apiErrorMessage(err, "Please try again."),
      });
    } finally {
      setBusyId(null);
    }
  };

  const requestDelete = (row: PaymentMethodRecord) =>
    confirm({
      title: `Delete ${row.label}?`,
      description:
        "Agents will no longer see this account at checkout. If you only want to pause it, switch it off instead — that keeps old invoices readable.",
      confirmLabel: "Delete",
      destructive: true,
      onConfirm: async () => {
        try {
          setBusyId(row._id);
          await subscriptionApi.deletePaymentMethod(row._id);
          setRows((previous) => previous.filter((item) => item._id !== row._id));
          toast.success("Deleted");
        } catch (err) {
          toast.error("Could not delete", {
            description: apiErrorMessage(err, "Please try again."),
          });
        } finally {
          setBusyId(null);
        }
      },
    });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <PageHeader
        title="Payment methods"
        description="The accounts agents pay into when they buy a plan."
        actions={
          <>
            <Button variant="outline" onClick={() => void load()}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button onClick={() => setDraft({ ...BLANK, order: rows.length })}>
              <Plus className="mr-2 h-4 w-4" />
              Add account
            </Button>
          </>
        }
      />

      {!loading && rows.filter((row) => row.isActive).length === 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="font-semibold">No active account.</span> Until one is
          added, the checkout page has nowhere to send agents — they cannot buy
          a plan.
        </div>
      )}

      {draft && (
        <DataCard>
          <DataCardTitle>
            {draft._id ? "Edit account" : "New account"}
          </DataCardTitle>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={draft.type}
                onValueChange={(value) =>
                  setDraft({
                    ...draft,
                    type: value as PaymentMethodRecord["type"],
                    // The label follows the type until it is edited by hand.
                    label:
                      draft.label.trim() === "" ||
                      TYPES.some((entry) => entry.label === draft.label)
                        ? (TYPES.find((entry) => entry.value === value)?.label ?? draft.label)
                        : draft.label,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((entry) => (
                    <SelectItem key={entry.value} value={entry.value}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pm-label">Shown to the agent as *</Label>
              <Input
                id="pm-label"
                value={draft.label}
                onChange={(event) => setDraft({ ...draft, label: event.target.value })}
                placeholder="JazzCash / Meezan Bank"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pm-account">Account number / IBAN *</Label>
              <Input
                id="pm-account"
                value={draft.accountNumber}
                onChange={(event) =>
                  setDraft({ ...draft, accountNumber: event.target.value })
                }
                placeholder="0300 1234567 / PK00 MEZN 0000 0000"
                className="font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pm-title">Account title</Label>
              <Input
                id="pm-title"
                value={draft.accountTitle}
                onChange={(event) =>
                  setDraft({ ...draft, accountTitle: event.target.value })
                }
                placeholder="PropertyDealer"
              />
              <p className="text-xs text-muted-foreground">
                People check the name before sending — leaving it out costs you
                payments.
              </p>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="pm-instructions">Instructions</Label>
              <Textarea
                id="pm-instructions"
                rows={2}
                maxLength={500}
                value={draft.instructions}
                onChange={(event) =>
                  setDraft({ ...draft, instructions: event.target.value })
                }
                placeholder="e.g. Send the screenshot to 0300 1234567 as well."
              />
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save
            </Button>
            <Button variant="ghost" onClick={() => setDraft(null)} disabled={saving}>
              Cancel
            </Button>
          </div>
        </DataCard>
      )}

      <DataCard>
        <DataCardTitle hint="Switched-off accounts stay out of checkout">
          Accounts
        </DataCardTitle>

        {loading ? (
          <div className="mt-4 space-y-3">
            {[0, 1].map((row) => (
              <Skeleton key={row} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm">
            <p className="font-medium text-red-900">{error}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => void load()}>
              Try again
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No accounts yet. Add JazzCash, Easypaisa or a bank account.
          </p>
        ) : (
          <ul className="mt-4 divide-y">
            {rows.map((row) => {
              const Icon = row.type === "bank" ? Landmark : Smartphone;
              const busy = busyId === row._id;

              return (
                <li
                  key={row._id}
                  className={cn(
                    "flex flex-wrap items-center gap-3 py-3",
                    busy && "opacity-60",
                    !row.isActive && "opacity-60",
                  )}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-semibold">
                      {row.label}
                      {!row.isActive && (
                        <Badge variant="outline" className="text-xs">
                          Off
                        </Badge>
                      )}
                    </p>
                    <p className="break-all font-mono text-sm text-muted-foreground">
                      {row.accountNumber}
                    </p>
                    {row.accountTitle && (
                      <p className="text-xs text-muted-foreground">
                        Title: {row.accountTitle}
                      </p>
                    )}
                    {row.instructions && (
                      <p className="text-xs text-muted-foreground">{row.instructions}</p>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void toggleActive(row)}
                    >
                      {row.isActive ? "Switch off" : "Switch on"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => setDraft({ ...row })}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      disabled={busy}
                      onClick={() => requestDelete(row)}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </DataCard>

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}

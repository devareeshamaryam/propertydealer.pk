"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { BadgeCheck, ExternalLink, Gift, List, Loader2, Search, Users } from "lucide-react";
import { packageApi, subscriptionApi, type AccountRow, type AccountsPage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DataCard } from "@/components/dashboard/data-card";
import { apiErrorMessage } from "@/components/dashboard/api-error";
import { agentProfilePath } from "@/lib/agent";
import { cn } from "@/lib/utils";

/*
 * Every account and the plan it is on — Free ones included, which a list of
 * subscriptions never showed (Free is "no paid plan", not a row). Searched and
 * paged on the server. From each row: the public profile, the account's
 * listings, and "Give a plan" (no invoice, for a cash payment or an offer).
 */

const FILTERS = [
  { value: "", label: "All accounts" },
  { value: "paid", label: "Paid plans" },
  { value: "free", label: "Free" },
  { value: "pending", label: "Payment pending" },
];

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" }) : "");

export default function AccountsPanel() {
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [plan, setPlan] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AccountsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [granting, setGranting] = useState<AccountRow | null>(null);
  const [plans, setPlans] = useState<{ _id: string; name: string; price: number }[]>([]);
  const [planId, setPlanId] = useState("");
  const [saving, setSaving] = useState(false);

  // Search as you type, a moment after typing stops.
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await subscriptionApi.getAccounts({ search: q || undefined, plan: plan || undefined, page, limit: 25 }));
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not load accounts"));
    } finally {
      setLoading(false);
    }
  }, [q, plan, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const openGrant = async (row: AccountRow) => {
    setGranting(row);
    if (!plans.length) {
      try {
        const all = await packageApi.getAllIncludingInactive();
        setPlans((Array.isArray(all) ? all : []).filter((p: { price: number }) => p.price > 0));
      } catch {
        setPlans([]);
      }
    }
  };

  const grant = async () => {
    if (!granting || !planId) return;
    setSaving(true);
    try {
      await subscriptionApi.assignPlan(granting._id, planId);
      toast.success(`Plan given to ${granting.name || granting.email}`);
      setGranting(null);
      setPlanId("");
      void load();
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not give the plan"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DataCard flush>
      <div className="flex flex-wrap items-center gap-2 border-b p-4">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, email, phone or agency" className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => {
                setPlan(f.value);
                setPage(1);
              }}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                plan === f.value ? "border-primary bg-primary text-white" : "border-slate-200 hover:border-slate-400",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        {data && <span className="ml-auto text-xs text-muted-foreground">{data.total.toLocaleString("en-PK")} accounts</span>}
      </div>

      {loading && !data ? (
        <div className="grid place-items-center p-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : !data?.rows.length ? (
        <p className="p-10 text-center text-sm text-muted-foreground">No accounts match.</p>
      ) : (
        <ul className={cn("divide-y", loading && "opacity-60")}>
          {data.rows.map((r) => {
            const profile = agentProfilePath({ _id: r._id, name: r.name, companyName: r.companyName });
            return (
              <li key={r._id} className="flex flex-wrap items-center gap-3 p-3 lg:flex-nowrap">
                <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/10 font-semibold text-primary">
                  {r.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (r.name || r.email).slice(0, 1).toUpperCase()
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-semibold">
                    {r.companyName || r.name || "No name"}
                    {!r.isActive && <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">Inactive</span>}
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{r.role}</span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.email}
                    {r.phone ? ` · ${r.phone}` : ""} · joined {fmt(r.createdAt)}
                  </p>
                  {(r.agency || r.teamSize > 0) && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-violet-700">
                      <Users className="h-3 w-3" />
                      {r.agency ? `Agent of ${r.agency.name}` : `Agency with ${r.teamSize} agent${r.teamSize === 1 ? "" : "s"}`}
                    </p>
                  )}
                </div>

                <div className="w-40 shrink-0">
                  <p className={cn("flex items-center gap-1 text-sm font-semibold", r.plan.paid || r.plan.granted ? "text-primary" : "text-slate-700")}>
                    {r.plan.name}
                    {r.verified && <BadgeCheck className="h-4 w-4 text-sky-500" aria-label="Verified" />}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.plan.endDate ? `until ${fmt(r.plan.endDate)}` : r.plan.name === "Free" ? "1 live listing" : ""}
                    {r.plan.granted ? " · given by admin" : ""}
                  </p>
                  {r.pendingInvoice && (
                    <p className="mt-0.5 text-xs font-medium text-amber-700">
                      {r.pendingInvoice.status === "submitted" ? "Paid — verify" : "Invoice open"}: {r.pendingInvoice.planName}
                    </p>
                  )}
                </div>

                <div className="w-24 shrink-0 text-sm">
                  <p className="font-semibold">{r.listings.live} live</p>
                  <p className="text-xs text-muted-foreground">{r.listings.total} total</p>
                </div>

                <div className="flex shrink-0 gap-1">
                  {profile && (
                    <Button variant="ghost" size="sm" asChild title="View profile">
                      <a href={profile} target="_blank" rel="noopener">
                        <ExternalLink className="mr-1 h-3.5 w-3.5" /> Profile
                      </a>
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" asChild title="Their listings">
                    <Link href={`/dashboard/property?ownerId=${r._id}&owner=${encodeURIComponent(r.companyName || r.name || r.email)}`}>
                      <List className="mr-1 h-3.5 w-3.5" /> Listings
                    </Link>
                  </Button>
                  {!r.agency && (
                    <Button variant="outline" size="sm" onClick={() => void openGrant(r)}>
                      <Gift className="mr-1 h-3.5 w-3.5" /> Give plan
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between border-t p-3 text-sm">
          <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-muted-foreground">
            Page {data.page} of {data.totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= data.totalPages || loading} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}

      <Dialog open={!!granting} onOpenChange={(o) => !o && setGranting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Give a plan to {granting?.companyName || granting?.name || granting?.email}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Starts now, with no invoice — for a payment made outside the site, or an offer.</p>
          <select value={planId} onChange={(e) => setPlanId(e.target.value)} className="h-10 w-full rounded-md border px-3 text-sm">
            <option value="">Choose a plan</option>
            {plans.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name} — Rs {p.price.toLocaleString("en-PK")}
              </option>
            ))}
          </select>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setGranting(null)}>Cancel</Button>
            <Button onClick={() => void grant()} disabled={!planId || saving}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Give plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DataCard>
  );
}

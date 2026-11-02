"use client";

import { useCallback, useEffect, useState } from "react";
import { Home, Loader2, MessageCircle, Phone, RefreshCcw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import api from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DataCard, DataCardTitle, FilterChips, PageHeader, apiErrorMessage } from "@/components/dashboard";
import { amountShort } from "@/lib/pk";
import { cn } from "@/lib/utils";

/**
 * "Find a property for me" requests from /find-property-for-me: who wants
 * what, where, for how much — and a call / WhatsApp button. New ones first;
 * move each along as the team works on it.
 */

type Status = "new" | "contacted" | "found" | "closed";
const FILTERS: (Status | "all")[] = ["new", "contacted", "found", "closed", "all"];
const STATUS_STYLES: Record<Status, string> = {
  new: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  contacted: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  found: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  closed: "bg-slate-200 text-slate-700 hover:bg-slate-200",
};
const TYPE_LABEL: Record<string, string> = {
  any: "Any property", house: "House", plot: "Plot", flat: "Flat", "upper-portion": "Upper portion", "lower-portion": "Lower portion",
  commercial: "Commercial", shop: "Shop", office: "Office", farmhouse: "Farmhouse", room: "Room",
};
const WHEN: Record<string, string> = { asap: "Right away", "1month": "Within a month", "3months": "1–3 months", exploring: "Just exploring" };

interface Row {
  _id: string;
  name: string;
  phone: string;
  whatsapp: boolean;
  purpose: "sale" | "rent";
  type: string;
  city: string;
  areas: string;
  minPrice: number | null;
  maxPrice: number | null;
  minMarla: number | null;
  maxMarla: number | null;
  beds: number | null;
  timeline: string;
  notes: string;
  status: Status;
  adminNote: string;
  createdAt: string;
}

const size = (m: number | null) => (!m ? "" : m >= 20 && m % 20 === 0 ? `${m / 20} Kanal` : `${m} Marla`);
const span = (a: string, b: string) => (a && b ? (a === b ? a : `${a} – ${b}`) : a ? `${a}+` : b ? `up to ${b}` : "");
const when = (v: string) =>
  new Date(v).toLocaleString("en-PK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function PropertyRequestsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<Status | "all">("new");
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const r = await api.get("/property-requests", { params: { status, q: term } });
      setRows(r.data?.requests ?? []);
      setCounts(r.data?.counts ?? {});
    } catch (err) {
      setError(apiErrorMessage(err, "Could not load requests."));
    } finally {
      setLoading(false);
    }
  }, [status, term]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (row: Row, patch: Partial<Pick<Row, "status" | "adminNote">>) => {
    try {
      setBusyId(row._id);
      await api.patch(`/property-requests/${row._id}`, patch);
      if (patch.status && patch.status !== row.status) {
        setCounts((c) => ({ ...c, [row.status]: Math.max(0, (c[row.status] ?? 1) - 1), [patch.status!]: (c[patch.status!] ?? 0) + 1 }));
        setRows((all) => (status === "all" ? all.map((r) => (r._id === row._id ? { ...r, ...patch } : r)) : all.filter((r) => r._id !== row._id)));
      } else setRows((all) => all.map((r) => (r._id === row._id ? { ...r, ...patch } : r)));
      if (patch.adminNote !== undefined) toast.success("Note saved");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not update."));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (row: Row) => {
    if (!window.confirm(`Delete ${row.name}'s request? This cannot be undone.`)) return;
    try {
      setBusyId(row._id);
      await api.delete(`/property-requests/${row._id}`);
      setRows((all) => all.filter((r) => r._id !== row._id));
      setCounts((c) => ({ ...c, [row.status]: Math.max(0, (c[row.status] ?? 1) - 1), all: Math.max(0, (c.all ?? 1) - 1) }));
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not delete."));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Property requests"
        description="People who asked the team to find a property for them (from /find-property-for-me)."
        actions={
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCcw className={cn("mr-1.5 h-4 w-4", loading && "animate-spin")} /> Refresh
          </Button>
        }
      />

      <DataCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <DataCardTitle hint="Newest first">Requests</DataCardTitle>
          <FilterChips<Status | "all">
            aria-label="Filter by status"
            value={status}
            onChange={setStatus}
            options={FILTERS.map((value) => ({ value, label: value === "all" ? "All" : value[0]!.toUpperCase() + value.slice(1), count: counts[value] }))}
          />
        </div>
        <form
          className="relative mt-3 max-w-sm"
          onSubmit={(e) => {
            e.preventDefault();
            setTerm(q.trim());
          }}
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, phone, city, area…"
            className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
          />
        </form>

        {loading ? (
          <div className="mt-4 space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
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
          <div className="py-12 text-center">
            <Home className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">{status === "new" ? "No new requests." : "No requests here."}</p>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {rows.map((row) => {
              const busy = busyId === row._id;
              const wa = `92${row.phone.slice(1)}`;
              const budget = span(row.minPrice ? amountShort(row.minPrice) : "", row.maxPrice ? amountShort(row.maxPrice) : "");
              const area = span(size(row.minMarla), size(row.maxMarla));
              return (
                <li key={row._id} className={cn("rounded-xl border p-4", busy && "opacity-60")}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={STATUS_STYLES[row.status]}>{row.status}</Badge>
                        <span className="text-[15px] font-semibold">
                          {row.purpose === "rent" ? "Rent" : "Buy"} · {TYPE_LABEL[row.type] ?? row.type}
                        </span>
                        <span className="text-xs text-muted-foreground">{when(row.createdAt)}</span>
                      </div>
                      <p className="mt-1 text-sm">
                        <span className="font-medium">{[row.areas, row.city].filter(Boolean).join(", ") || "—"}</span>
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                        {budget && <span className="rounded-md bg-muted px-2 py-1">💰 {budget}{row.purpose === "rent" ? " /mo" : ""}</span>}
                        {area && <span className="rounded-md bg-muted px-2 py-1">📐 {area}</span>}
                        {row.beds ? <span className="rounded-md bg-muted px-2 py-1">🛏 {row.beds}+ beds</span> : null}
                        {row.timeline && <span className="rounded-md bg-muted px-2 py-1">⏱ {WHEN[row.timeline] ?? row.timeline}</span>}
                      </div>
                      {row.notes && <p className="mt-2 whitespace-pre-line rounded-lg bg-muted/60 px-3 py-2 text-sm">{row.notes}</p>}
                      <p className="mt-2 text-sm">
                        <span className="font-semibold">{row.name}</span> · {row.phone}
                        {row.whatsapp ? " · on WhatsApp" : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline">
                        <a href={`tel:${row.phone}`}>
                          <Phone className="mr-1.5 h-4 w-4" /> Call
                        </a>
                      </Button>
                      {row.whatsapp && (
                        <Button asChild size="sm" className="bg-[#1a9e52] hover:bg-[#15843f]">
                          <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">
                            <MessageCircle className="mr-1.5 h-4 w-4" /> WhatsApp
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                    {(["new", "contacted", "found", "closed"] as Status[]).map((s) => (
                      <Button key={s} size="sm" variant={row.status === s ? "default" : "outline"} disabled={busy || row.status === s} onClick={() => void save(row, { status: s })} className="capitalize">
                        {s}
                      </Button>
                    ))}
                    <div className="flex min-w-[220px] flex-1 items-center gap-2">
                      <input
                        value={notes[row._id] ?? row.adminNote ?? ""}
                        onChange={(e) => setNotes((n) => ({ ...n, [row._id]: e.target.value }))}
                        placeholder="Team note (only admins see this)"
                        className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/30"
                      />
                      {notes[row._id] !== undefined && notes[row._id] !== (row.adminNote ?? "") && (
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => void save(row, { adminNote: notes[row._id] })}>
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                        </Button>
                      )}
                    </div>
                    <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" disabled={busy} onClick={() => void remove(row)} aria-label="Delete">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </DataCard>
    </div>
  );
}

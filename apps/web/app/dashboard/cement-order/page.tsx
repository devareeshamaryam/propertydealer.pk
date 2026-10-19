"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Banknote,
  CalendarClock,
  ClipboardList,
  ExternalLink,
  Loader2,
  MessageCircle,
  Phone,
  Printer,
  RefreshCcw,
  Search,
  ShoppingBag,
  Truck,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { DataCard, PageHeader, StatCard, apiErrorMessage } from "@/components/dashboard";
import { ORDER_STATUS_LABEL, imageSrc, rs, shopApi, type AdminOrder } from "@/lib/shop";
import { waDigits } from "@/lib/site-settings";
import { cn } from "@/lib/utils";

/**
 * Shop orders — the office's queue.
 *
 * It was a read-only list: no way to move an order along, no notes, no
 * search, no way to see what had been ordered without opening the database.
 * Now: today's numbers on top, filter by status, search by order number /
 * name / phone, and a side panel per order with the items, the customer, one
 * tap to call or WhatsApp them, the next valid status (pending → confirmed →
 * out for delivery → delivered), payment status, an internal note and the
 * order's history.
 */

const STATUS_TABS = ["all", "PENDING", "CONFIRMED", "PROCESSING", "OUT_FOR_DELIVERY", "DELIVERED", "COMPLETED", "CANCELLED"];

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-800 ring-amber-200",
  CONFIRMED: "bg-blue-50 text-blue-800 ring-blue-200",
  PROCESSING: "bg-indigo-50 text-indigo-800 ring-indigo-200",
  OUT_FOR_DELIVERY: "bg-violet-50 text-violet-800 ring-violet-200",
  DELIVERED: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  COMPLETED: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  CANCELLED: "bg-slate-100 text-slate-600 ring-slate-200",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex whitespace-nowrap rounded-md px-2 py-0.5 text-[11.5px] font-semibold ring-1", STATUS_STYLE[status] ?? STATUS_STYLE.PENDING)}>
      {ORDER_STATUS_LABEL[status] ?? status}
    </span>
  );
}

const when = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("en-PK", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—";

export default function OrdersPage() {
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Awaited<ReturnType<typeof shopApi.adminOrders>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await shopApi.adminOrders({ status, search: query, page, limit: 20 }));
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load orders"));
    } finally {
      setLoading(false);
    }
  }, [status, query, page]);

  useEffect(() => { void load(); }, [load]);

  // Search as you type, a beat after typing stops.
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); setQuery(search.trim()); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const stats = data?.stats;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description="Construction materials orders from the shop."
        actions={
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="New today" value={stats?.today ?? 0} icon={CalendarClock} tone="info" loading={!stats} />
        <StatCard label="Waiting to confirm" value={stats?.counts?.PENDING ?? 0} icon={ClipboardList} tone="warning" loading={!stats} />
        <StatCard label="Open orders" value={stats?.open ?? 0} icon={Truck} loading={!stats} />
        <StatCard label="Delivered value" value={stats ? rs(stats.revenue) : "—"} icon={Banknote} tone="success" loading={!stats} />
      </div>

      <DataCard flush className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="hide-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1">
            {STATUS_TABS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => { setStatus(s); setPage(1); }}
                className={cn(
                  "shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
                  status === s ? "bg-primary text-white" : "text-slate-600 hover:bg-slate-100",
                )}
              >
                {s === "all" ? "All" : ORDER_STATUS_LABEL[s]}
                {s !== "all" && stats?.counts?.[s] ? <span className="ml-1 opacity-70">{stats.counts[s]}</span> : null}
              </button>
            ))}
          </div>
          <label className="relative sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Order no., name, phone…" className="pl-9" />
          </label>
        </div>

        {loading && !data ? (
          <div className="grid place-items-center py-16 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : !data || data.orders.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <ShoppingBag className="mx-auto mb-2 h-8 w-8 text-slate-300" />
            {query || status !== "all" ? "No orders match." : "No orders yet."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead className="bg-slate-50 text-left text-[12px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Order</th>
                  <th className="px-4 py-2.5">Customer</th>
                  <th className="hidden px-4 py-2.5 md:table-cell">Items</th>
                  <th className="px-4 py-2.5 text-right">Total</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="hidden px-4 py-2.5 lg:table-cell">Placed</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.orders.map((o) => (
                  <tr key={o._id} onClick={() => setOpenId(o._id)} className="cursor-pointer hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">{o.orderNumber ?? `#${o._id.slice(-6).toUpperCase()}`}</td>
                    <td className="px-4 py-3">
                      <span className="block font-medium text-slate-900">{o.customerName}</span>
                      <span className="text-[12px] text-slate-500">{o.customerPhone}{o.customerCity ? ` · ${o.customerCity}` : ""}</span>
                    </td>
                    <td className="hidden max-w-[260px] px-4 py-3 text-slate-600 md:table-cell">
                      <span className="line-clamp-2">{o.items.map((i) => `${i.quantity} × ${i.title || i.brand}`).join(", ")}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{rs(o.total)}</td>
                    <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                    <td className="hidden px-4 py-3 text-slate-500 lg:table-cell">{when(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3 text-[13px] text-slate-600">
            <span>Page {data.page} of {data.totalPages} · {data.total} orders</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </DataCard>

      <OrderSheet id={openId} onClose={() => setOpenId(null)} onChanged={() => void load()} />
    </div>
  );
}

function OrderSheet({ id, onClose, onChanged }: { id: string | null; onClose: () => void; onChanged: () => void }) {
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!id) { setOrder(null); return; }
    let cancelled = false;
    shopApi.adminOrder(id)
      .then((o) => { if (!cancelled) { setOrder(o); setNote(o.adminNote ?? ""); } })
      .catch((err) => toast.error(apiErrorMessage(err, "Could not open the order")));
    return () => { cancelled = true; };
  }, [id]);

  const update = async (body: Parameters<typeof shopApi.updateOrder>[1], label: string) => {
    if (!order) return;
    setBusy(label);
    try {
      const next = await shopApi.updateOrder(order._id, body);
      setOrder(next);
      setNote(next.adminNote ?? "");
      onChanged();
      toast.success("Order updated");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not update the order"));
    } finally {
      setBusy(null);
    }
  };

  const ref = order?.orderNumber ?? (order ? `#${order._id.slice(-6).toUpperCase()}` : "");

  return (
    <Sheet open={!!id} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-lg">
        {!order ? (
          <div className="grid flex-1 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
        ) : (
          <>
            <div className="border-b px-5 py-4">
              <div className="flex items-center justify-between gap-2">
                <SheetTitle className="text-[18px] font-bold">{ref}</SheetTitle>
                <StatusBadge status={order.status} />
              </div>
              <p className="text-[13px] text-slate-500">Placed {when(order.createdAt)}</p>
            </div>

            <div className="space-y-5 px-5 py-4">
              {/* Customer */}
              <section>
                <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-slate-400">Customer</h3>
                <p className="font-semibold text-slate-900">{order.customerName}</p>
                <p className="text-[13.5px] text-slate-600">{order.customerPhone}{order.customerEmail ? ` · ${order.customerEmail}` : ""}</p>
                <p className="mt-1 text-[13.5px] text-slate-600">{order.address}{order.customerCity ? `, ${order.customerCity}` : ""}</p>
                {order.deliveryInstruction && <p className="mt-1 rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-900">“{order.deliveryInstruction}”</p>}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <a href={`tel:${order.customerPhone}`} className="flex h-10 items-center justify-center gap-2 rounded-lg border text-[13.5px] font-semibold hover:bg-slate-50">
                    <Phone className="h-4 w-4" /> Call
                  </a>
                  <a
                    href={`https://wa.me/${waDigits(order.customerPhone)}?text=${encodeURIComponent(`Assalam o Alaikum ${order.customerName}, regarding your order ${ref} (${rs(order.total)}) from Property Dealer.`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-10 items-center justify-center gap-2 rounded-lg bg-[#25D366] text-[13.5px] font-semibold text-white"
                  >
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </a>
                </div>
              </section>

              {/* Items */}
              <section>
                <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-slate-400">Items</h3>
                <ul className="divide-y rounded-xl border">
                  {order.items.map((i, idx) => (
                    <li key={idx} className="flex items-center gap-3 p-2.5">
                      <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-50">
                        {i.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={imageSrc(i.image)} alt="" className="h-full w-full object-contain" />
                        ) : (
                          <span className="text-[11px] font-bold text-slate-400">{i.brand.slice(0, 2).toUpperCase()}</span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium text-slate-900">{i.title || i.brand}</span>
                        <span className="text-[12px] text-slate-500">{i.quantity} × {rs(i.price)}{i.unit ? ` · ${i.unit}` : i.weightKg ? ` · ${i.weightKg} kg` : ""}{i.city ? ` · ${i.city}` : ""}</span>
                      </span>
                      <span className="text-[13.5px] font-semibold">{rs(i.price * i.quantity)}</span>
                      {i.href && (
                        <Link href={i.href} target="_blank" className="text-slate-400 hover:text-primary" aria-label="Open product"><ExternalLink className="h-4 w-4" /></Link>
                      )}
                    </li>
                  ))}
                </ul>
                <dl className="mt-2 space-y-1 text-[13.5px]">
                  <div className="flex justify-between text-slate-600"><dt>Subtotal</dt><dd>{rs(order.subTotal)}</dd></div>
                  <div className="flex justify-between text-slate-600"><dt>Delivery</dt><dd>{rs(order.deliveryCharges)}</dd></div>
                  <div className="flex justify-between text-[15px] font-bold"><dt>Total</dt><dd>{rs(order.total)}</dd></div>
                </dl>
              </section>

              {/* Status */}
              <section>
                <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-slate-400">Move order to</h3>
                {order.nextStatuses && order.nextStatuses.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {order.nextStatuses.map((s) => (
                      <Button
                        key={s}
                        size="sm"
                        variant={s === "CANCELLED" ? "outline" : "default"}
                        className={cn(s === "CANCELLED" && "text-red-600 hover:text-red-700")}
                        disabled={!!busy}
                        onClick={() => void update({ status: s }, s)}
                      >
                        {busy === s && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                        {ORDER_STATUS_LABEL[s]}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <p className="text-[13px] text-slate-500">This order is closed.</p>
                )}
              </section>

              {/* Payment */}
              <section>
                <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-slate-400">
                  Payment · {order.paymentMethod === "cod" ? "Cash on delivery" : "Bank transfer"}
                </h3>
                <div className="flex gap-2">
                  {(["unpaid", "paid", "refunded"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      disabled={!!busy}
                      onClick={() => p !== order.paymentStatus && void update({ paymentStatus: p }, p)}
                      className={cn(
                        "rounded-lg px-3 py-1.5 text-[13px] font-medium capitalize ring-1",
                        (order.paymentStatus ?? "unpaid") === p ? "bg-slate-900 text-white ring-slate-900" : "text-slate-600 ring-slate-200 hover:bg-slate-50",
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </section>

              {/* Note */}
              <section>
                <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-slate-400">Internal note</h3>
                <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Only the office sees this — rider, rate agreed on the call…" />
                <Button size="sm" variant="outline" className="mt-2" disabled={!!busy || note === (order.adminNote ?? "")} onClick={() => void update({ adminNote: note }, "note")}>
                  {busy === "note" && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />} Save note
                </Button>
              </section>

              {/* History */}
              {!!order.statusHistory?.length && (
                <section>
                  <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-slate-400">History</h3>
                  <ol className="space-y-2 border-l-2 border-slate-200 pl-4">
                    {order.statusHistory.map((h, idx) => (
                      <li key={idx} className="text-[13px]">
                        <span className="font-medium text-slate-900">{ORDER_STATUS_LABEL[h.status] ?? h.status}</span>
                        <span className="text-slate-500"> · {when(h.at)}{h.by === "customer" ? " · by customer" : ""}</span>
                        {h.note && <p className="text-slate-500">{h.note}</p>}
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              <Button variant="ghost" size="sm" onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" /> Print
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

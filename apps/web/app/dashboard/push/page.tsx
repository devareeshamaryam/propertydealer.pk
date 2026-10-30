"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Bell, Copy, Loader2, MousePointerClick, Pencil, Plus, RefreshCcw, Save, Square, Trash2, TrendingUp, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { DataCard, DataCardTitle, FilterChips, PageHeader, StatCard, apiErrorMessage } from "@/components/dashboard";
import api from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";

/**
 * Dashboard → Push notifications (admins).
 *
 *   Overview     devices, growth, where and on what, sent / shown / tapped
 *   Campaigns    the manual pushes — write one, schedule it, see how it did
 *   Automatic    every notification the site sends by itself: on/off,
 *                "straight away", and its words
 *   Subscribers  every device, with who it belongs to and what it browses
 *   Settings     the "allow notifications" card, quiet hours, limits
 */

type Tab = "overview" | "campaigns" | "automatic" | "subscribers" | "settings";
const TABS: { value: Tab; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "campaigns", label: "Campaigns" },
  { value: "automatic", label: "Automatic" },
  { value: "subscribers", label: "Subscribers" },
  { value: "settings", label: "Settings" },
];

const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 1000) / 10}%` : "—");
const dt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("en-PK", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—");

function PushAdminPage() {
  const { user } = useAuth();
  const params = useSearchParams();
  const router = useRouter();
  const tab = (TABS.find((t) => t.value === params.get("tab"))?.value ?? "overview") as Tab;
  const setTab = (t: Tab) => router.replace(`/dashboard/push?tab=${t}`);

  if (user && user.role !== "ADMIN") return <p className="p-6 text-sm text-muted-foreground">Only admins can manage push notifications.</p>;

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-5">
      <PageHeader
        title="Push notifications"
        description="The site's own browser notifications — to agents, buyers and visitors, on phones and computers, even when the site is closed."
        actions={
          <Button asChild>
            <Link href="/dashboard/push/compose">
              <Plus className="mr-2 h-4 w-4" />
              New campaign
            </Link>
          </Button>
        }
      />
      <FilterChips<Tab> aria-label="Section" value={tab} onChange={setTab} options={TABS} />
      {tab === "overview" && <Overview />}
      {tab === "campaigns" && <Campaigns />}
      {tab === "automatic" && <SettingsEditor part="automatic" />}
      {tab === "subscribers" && <Subscribers />}
      {tab === "settings" && <SettingsEditor part="settings" />}
    </div>
  );
}

/* ── Overview ── */

function Bars({ title, rows }: { title: string; rows: { label: string; n: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <DataCard>
      <DataCardTitle>{title}</DataCardTitle>
      {rows.length === 0 ? (
        <p className="mt-3 text-[13px] text-slate-500">Nothing yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((r) => (
            <li key={r.label} className="text-[13px]">
              <div className="flex justify-between text-slate-700">
                <span className="truncate capitalize">{r.label}</span>
                <span className="tabular-nums text-slate-500">{r.n.toLocaleString()}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-primary" style={{ width: `${(r.n / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </DataCard>
  );
}

function Overview() {
  const [d, setD] = useState<any>(null);
  const [days, setDays] = useState(30);
  useEffect(() => {
    setD(null);
    api
      .get("/push/admin/overview", { params: { days } })
      .then((r) => setD(r.data))
      .catch((e) => toast.error(apiErrorMessage(e, "Could not load the overview")));
  }, [days]);

  const totals = useMemo(() => {
    const sum = (k: string) => (d?.daily ?? []).reduce((a: number, r: any) => a + (r[k] || 0), 0);
    return { sent: sum("sent"), delivered: sum("delivered"), clicked: sum("clicked") };
  }, [d]);

  if (!d) return <Skeleton className="h-96 w-full rounded-2xl" />;
  const maxDay = Math.max(1, ...d.daily.map((r: any) => r.sent));
  return (
    <div className="space-y-5">
      {!d.ready && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[14px] text-amber-900">Push keys are not ready yet — they are made on the server's first start. Restart the API if this stays.</p>}
      <div className="flex justify-end">
        <FilterChips<string> aria-label="Period" value={String(days)} onChange={(v) => setDays(Number(v))} options={[{ value: "7", label: "7 days" }, { value: "30", label: "30 days" }, { value: "90", label: "90 days" }]} />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Bell} label="Devices subscribed" value={d.totals.total.toLocaleString()} hint={`${d.totals.signedIn} signed in · ${d.totals.guests} guests`} />
        <StatCard icon={Users} label="Agents" value={d.totals.agents.toLocaleString()} hint={`${d.totals.paid} on a paid plan`} />
        <StatCard icon={TrendingUp} tone="success" label={`New in ${d.totals.days} days`} value={`+${d.totals.newN}`} hint={`${d.totals.lost} turned off or expired`} />
        <StatCard icon={MousePointerClick} tone="info" label="Tapped" value={pct(totals.clicked, totals.delivered)} hint={`${totals.sent.toLocaleString()} sent · ${totals.delivered.toLocaleString()} shown`} />
      </div>

      <DataCard>
        <DataCardTitle hint="Sent per day">Activity</DataCardTitle>
        {d.daily.length === 0 ? (
          <p className="mt-3 text-[13px] text-slate-500">Nothing sent in this period yet.</p>
        ) : (
          <div className="mt-4 flex h-40 items-end gap-1">
            {d.daily.map((r: any) => (
              <div key={r._id} className="group relative flex-1" title={`${r._id}: ${r.sent} sent, ${r.delivered} shown, ${r.clicked} tapped, +${r.subscribed} devices`}>
                <div className="rounded-t bg-primary/25" style={{ height: `${(r.sent / maxDay) * 140}px` }}>
                  <div className="rounded-t bg-primary" style={{ height: `${r.sent ? (r.clicked / r.sent) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </DataCard>

      <DataCard>
        <DataCardTitle hint={`Last ${d.totals.days} days`}>By notification</DataCardTitle>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-[13.5px]">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-2 pr-3 font-medium">Notification</th>
                <th className="py-2 pr-3 text-right font-medium">Sent</th>
                <th className="py-2 pr-3 text-right font-medium">Shown</th>
                <th className="py-2 pr-3 text-right font-medium">Tapped</th>
                <th className="py-2 text-right font-medium">Tap rate</th>
              </tr>
            </thead>
            <tbody>
              {d.byType.map((t: any) => (
                <tr key={t._id} className="border-t">
                  <td className="py-2 pr-3 text-slate-800">{t.label}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{t.sent}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{t.delivered}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{t.clicked}</td>
                  <td className="py-2 text-right tabular-nums">{pct(t.clicked, t.delivered)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataCard>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        <Bars title="Cities" rows={d.byCity} />
        <Bars title="Areas they browse" rows={d.topAreas} />
        <Bars title="Browsers" rows={d.byBrowser} />
        <Bars title="Devices" rows={[...d.byDevice, ...d.byOs]} />
      </div>
    </div>
  );
}

/* ── Campaigns ── */

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  scheduled: "bg-sky-100 text-sky-800",
  sending: "bg-amber-100 text-amber-800",
  sent: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-slate-200 text-slate-600",
  failed: "bg-red-100 text-red-700",
};

function Campaigns() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [busy, setBusy] = useState("");
  const load = useCallback(() => {
    api
      .get("/push/admin/campaigns")
      .then((r) => setRows(r.data.rows))
      .catch((e) => toast.error(apiErrorMessage(e, "Could not load campaigns")));
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 8000); // live progress while one is sending
    return () => clearInterval(t);
  }, [load]);

  const act = async (id: string, what: "cancel" | "duplicate" | "delete") => {
    if (what === "delete" && !window.confirm("Delete this campaign?")) return;
    setBusy(id + what);
    try {
      if (what === "delete") await api.delete(`/push/admin/campaigns/${id}`);
      else await api.post(`/push/admin/campaigns/${id}/${what}`);
      toast.success(what === "cancel" ? "Stopped" : what === "duplicate" ? "Copied as a draft" : "Deleted");
      load();
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not do that"));
    } finally {
      setBusy("");
    }
  };

  if (!rows) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (!rows.length)
    return (
      <DataCard>
        <div className="py-12 text-center">
          <Bell className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground">No campaigns yet.</p>
          <Button asChild className="mt-4">
            <Link href="/dashboard/push/compose">Write the first one</Link>
          </Button>
        </div>
      </DataCard>
    );
  return (
    <DataCard>
      <div className="flex items-center justify-between">
        <DataCardTitle hint="Newest first">Campaigns</DataCardTitle>
        <Button variant="ghost" size="sm" onClick={load}>
          <RefreshCcw className="h-4 w-4" />
        </Button>
      </div>
      <ul className="mt-3 divide-y rounded-xl border">
        {rows.map((c) => {
          const s = c.stats || {};
          const progress = s.targeted ? Math.min(100, Math.round(((s.sent + s.failed + s.removed) / s.targeted) * 100)) : 0;
          return (
            <li key={c._id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{c.name || c.title}</span>
                    <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-semibold capitalize", STATUS_STYLE[c.status])}>{c.status}</span>
                  </div>
                  <p className="mt-0.5 truncate text-[13px] text-slate-500">
                    {c.title} — {c.body}
                  </p>
                  <p className="mt-1 text-[12.5px] text-slate-500">
                    {c.status === "scheduled" ? `Goes out ${dt(c.sendAt)}` : c.finishedAt ? `Sent ${dt(c.finishedAt)}` : `Created ${dt(c.createdAt)}`} · to {c.audience?.who || "all"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {["draft", "scheduled", "failed", "cancelled"].includes(c.status) && (
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/dashboard/push/compose?id=${c._id}`}>
                        <Pencil className="mr-1.5 h-3.5 w-3.5" />
                        Edit
                      </Link>
                    </Button>
                  )}
                  {["scheduled", "sending"].includes(c.status) && (
                    <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void act(c._id, "cancel")}>
                      <Square className="mr-1.5 h-3.5 w-3.5" />
                      Stop
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => void act(c._id, "duplicate")} aria-label="Duplicate">
                    <Copy className="h-4 w-4" />
                  </Button>
                  {c.status !== "sending" && (
                    <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => void act(c._id, "delete")} aria-label="Delete">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              {(c.status === "sending" || c.status === "sent") && (
                <div className="mt-3">
                  {c.status === "sending" && (
                    <div className="mb-2 h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-amber-500 transition-all" style={{ width: `${progress}%` }} />
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2 text-center text-[12.5px] sm:grid-cols-6">
                    {[
                      ["Audience", s.targeted],
                      ["Sent", s.sent],
                      ["Shown", s.delivered],
                      ["Tapped", s.clicked],
                      ["Tap rate", pct(s.clicked || 0, s.delivered || 0)],
                      ["Dropped", (s.removed || 0) + (s.failed || 0)],
                    ].map(([k, v]) => (
                      <div key={String(k)} className="rounded-lg bg-slate-50 py-1.5">
                        <div className="font-semibold tabular-nums text-slate-900">{typeof v === "number" ? v.toLocaleString() : v ?? 0}</div>
                        <div className="text-slate-500">{k}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {c.error && <p className="mt-2 text-[12.5px] text-red-700">{c.error}</p>}
            </li>
          );
        })}
      </ul>
    </DataCard>
  );
}

/* ── Subscribers ── */

function Subscribers() {
  const [status, setStatus] = useState("active");
  const [who, setWho] = useState("all");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [d, setD] = useState<any>(null);
  useEffect(() => {
    setD(null);
    api
      .get("/push/admin/subscribers", { params: { status, who, q: query, page } })
      .then((r) => setD(r.data))
      .catch((e) => toast.error(apiErrorMessage(e, "Could not load subscribers")));
  }, [status, who, query, page]);

  return (
    <DataCard>
      <div className="flex flex-wrap items-center gap-3">
        <FilterChips<string> aria-label="Status" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[{ value: "active", label: "Active" }, { value: "unsubscribed", label: "Turned off" }, { value: "expired", label: "Expired" }, { value: "all", label: "All" }]} />
        <FilterChips<string> aria-label="Who" value={who} onChange={(v) => { setWho(v); setPage(1); }} options={[{ value: "all", label: "Everyone" }, { value: "users", label: "Signed in" }, { value: "agents", label: "Agents" }, { value: "paid", label: "Paid plan" }, { value: "guests", label: "Guests" }]} />
        <form
          className="ml-auto flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(q);
            setPage(1);
          }}
        >
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email, phone, city, area" className="h-9 w-64" />
          <Button size="sm" type="submit" variant="outline">
            Search
          </Button>
        </form>
      </div>
      {!d ? (
        <Skeleton className="mt-4 h-64 w-full rounded-xl" />
      ) : (
        <>
          <p className="mt-3 text-[13px] text-slate-500">{d.total.toLocaleString()} devices</p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-2 pr-3 font-medium">Who</th>
                  <th className="py-2 pr-3 font-medium">Device</th>
                  <th className="py-2 pr-3 font-medium">City · browses</th>
                  <th className="py-2 pr-3 text-right font-medium">Sent</th>
                  <th className="py-2 pr-3 text-right font-medium">Tapped</th>
                  <th className="py-2 pr-3 font-medium">Since</th>
                  <th className="py-2 font-medium">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {d.rows.map((r: any) => (
                  <tr key={r._id} className="border-t align-top">
                    <td className="py-2 pr-3">
                      {r.user ? (
                        <>
                          <div className="font-medium text-slate-900">{r.user.name || r.user.email}</div>
                          <div className="text-slate-500">
                            {r.role === "AGENT" ? (r.paid ? "Agent · paid" : "Agent · free") : r.role === "ADMIN" ? "Admin" : "User"}
                          </div>
                        </>
                      ) : (
                        <span className="text-slate-500">Guest</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-slate-700">
                      {r.browser} · {r.os}
                      <div className="capitalize text-slate-500">{r.device} · via {r.source}</div>
                    </td>
                    <td className="py-2 pr-3 text-slate-700">
                      {r.city || "—"}
                      {r.areas?.length > 0 && <div className="text-slate-500">{r.areas.join(", ")}</div>}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{r.sentCount}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{r.clickCount}</td>
                    <td className="py-2 pr-3 text-slate-500">{dt(r.createdAt)}</td>
                    <td className="py-2 text-slate-500">{dt(r.lastSeenAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {d.pages > 1 && (
            <div className="mt-3 flex justify-end gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <span className="self-center text-[13px] text-slate-500">
                {page} / {d.pages}
              </span>
              <Button size="sm" variant="outline" disabled={page >= d.pages} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </DataCard>
  );
}

/* ── Automatic + Settings (one settings document) ── */

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[13.5px] font-medium text-slate-800">{label}</span>
      {hint && <span className="block text-[12px] text-slate-500">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function SettingsEditor({ part }: { part: "automatic" | "settings" }) {
  const [meta, setMeta] = useState<any>(null);
  const [cfg, setCfg] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  // Fresh previews of the icons made from the favicon (not the browser's cached copy).
  const [iconStamp] = useState(() => Date.now());

  useEffect(() => {
    api
      .get("/push/admin/settings")
      .then((r) => {
        setMeta(r.data);
        setCfg(r.data.config);
      })
      .catch((e) => toast.error(apiErrorMessage(e, "Could not load the settings")));
  }, []);

  const set = (path: string, value: unknown) => {
    setCfg((c: any) => {
      const next = structuredClone(c);
      const keys = path.split(".");
      let o = next;
      for (const k of keys.slice(0, -1)) o = o[k] ??= {};
      o[keys[keys.length - 1]!] = value;
      return next;
    });
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const r = await api.put("/push/admin/settings", { config: cfg });
      setCfg(r.data.config);
      setDirty(false);
      toast.success("Saved");
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not save"));
    } finally {
      setSaving(false);
    }
  };

  if (!cfg || !meta) return <Skeleton className="h-96 w-full rounded-2xl" />;

  const saveBar = (
    <div className="sticky bottom-3 z-10 flex justify-end">
      <Button onClick={() => void save()} disabled={!dirty || saving} className="shadow-lg">
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        {dirty ? "Save changes" : "Saved"}
      </Button>
    </div>
  );

  if (part === "automatic") {
    const groups = Object.entries(meta.categories as Record<string, { label: string }>);
    return (
      <div className="space-y-5">
        <p className="text-[13.5px] text-slate-600">
          The site sends these by itself. <b>Straight away</b> skips quiet hours and the daily limit — for things people are waiting on. Words can use the {"{placeholders}"} listed under each; {"{site}"} is always the site name.
        </p>
        {groups.map(([gid, g]) => {
          const types = meta.types.filter((t: any) => t.category === gid);
          if (!types.length) return null;
          return (
            <DataCard key={gid}>
              <DataCardTitle>{g.label}</DataCardTitle>
              <ul className="mt-3 space-y-3">
                {types.map((t: any) => {
                  const a = cfg.auto[t.id];
                  return (
                    <li key={t.id} className={cn("rounded-xl border p-4", !a.enabled && "opacity-60")}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{t.label}</p>
                          <p className="text-[12.5px] text-slate-500">To: {t.to}</p>
                        </div>
                        <div className="flex items-center gap-5 text-[13px] text-slate-700">
                          <label className="flex items-center gap-2">
                            Straight away <Switch checked={a.immediate} onCheckedChange={(v) => set(`auto.${t.id}.immediate`, v)} />
                          </label>
                          <label className="flex items-center gap-2">
                            On <Switch checked={a.enabled} onCheckedChange={(v) => set(`auto.${t.id}.enabled`, v)} />
                          </label>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 md:grid-cols-[1fr_2fr]">
                        <Input value={a.title} onChange={(e) => set(`auto.${t.id}.title`, e.target.value)} placeholder="Title" maxLength={120} />
                        <Input value={a.body} onChange={(e) => set(`auto.${t.id}.body`, e.target.value)} placeholder="Message" maxLength={300} />
                      </div>
                      {t.vars.length > 0 && <p className="mt-1.5 text-[12px] text-slate-500">Placeholders: {t.vars.map((v: string) => `{${v}}`).join(" ")}</p>}
                    </li>
                  );
                })}
              </ul>
            </DataCard>
          );
        })}
        {saveBar}
      </div>
    );
  }

  const p = cfg.prompt;
  return (
    <div className="space-y-5">
      <DataCard>
        <div className="flex items-center justify-between gap-3">
          <div>
            <DataCardTitle>Push notifications</DataCardTitle>
            <p className="text-[13px] text-slate-500">Off: nothing is sent and nobody is asked.</p>
          </div>
          <Switch checked={cfg.enabled} onCheckedChange={(v) => set("enabled", v)} />
        </div>
      </DataCard>

      <DataCard>
        <div className="flex items-center justify-between gap-3">
          <DataCardTitle hint="Our own card first; the browser's question only after Allow">The "allow notifications" card</DataCardTitle>
          <Switch checked={p.enabled} onCheckedChange={(v) => set("prompt.enabled", v)} />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Title">
            <Input value={p.title} onChange={(e) => set("prompt.title", e.target.value)} maxLength={120} />
          </Field>
          <Field label="Message">
            <Textarea value={p.body} onChange={(e) => set("prompt.body", e.target.value)} rows={2} maxLength={300} />
          </Field>
          <Field label="Allow button">
            <Input value={p.allow} onChange={(e) => set("prompt.allow", e.target.value)} maxLength={30} />
          </Field>
          <Field label="Later button">
            <Input value={p.later} onChange={(e) => set("prompt.later", e.target.value)} maxLength={30} />
          </Field>
          <Field label="Ask after this many pages" hint="Never on the very first page">
            <Input type="number" min={1} max={20} value={p.minPageViews} onChange={(e) => set("prompt.minPageViews", Number(e.target.value))} />
          </Field>
          <Field label="…and after this many seconds on the page">
            <Input type="number" min={0} max={120} value={p.delaySec} onChange={(e) => set("prompt.delaySec", Number(e.target.value))} />
          </Field>
          <Field label='"Not now" waits this many days'>
            <Input type="number" min={1} max={90} value={p.snoozeDays} onChange={(e) => set("prompt.snoozeDays", Number(e.target.value))} />
          </Field>
          <Field label="Never ask on" hint="Comma-separated page addresses">
            <Input value={p.excludePaths} onChange={(e) => set("prompt.excludePaths", e.target.value)} />
          </Field>
        </div>
        <p className="mt-5 text-[13.5px] font-medium text-slate-800">Right after an action</p>
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          {(
            [
              ["post", "After posting a listing"],
              ["contact", "After calling / WhatsApp-ing an agent"],
              ["review", "After writing a review"],
              ["browse", "After opening several listings"],
            ] as const
          ).map(([k, label]) => (
            <div key={k} className="rounded-xl border p-3">
              <p className="text-[12.5px] font-medium text-slate-500">{label}</p>
              <Input className="mt-1.5" value={p.contexts[k].title} onChange={(e) => set(`prompt.contexts.${k}.title`, e.target.value)} maxLength={120} />
              <Textarea className="mt-1.5" value={p.contexts[k].body} onChange={(e) => set(`prompt.contexts.${k}.body`, e.target.value)} rows={2} maxLength={300} />
            </div>
          ))}
        </div>
      </DataCard>

      <DataCard>
        <DataCardTitle hint="So notifications stay welcome">Timing and limits</DataCardTitle>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Field label="Quiet hours" hint="Reminders and alerts wait until they end">
            <div className="flex items-center gap-2">
              <Switch checked={cfg.quiet.enabled} onCheckedChange={(v) => set("quiet.enabled", v)} />
              <Input type="time" value={cfg.quiet.start} onChange={(e) => set("quiet.start", e.target.value)} className="w-28" />
              <span className="text-slate-500">to</span>
              <Input type="time" value={cfg.quiet.end} onChange={(e) => set("quiet.end", e.target.value)} className="w-28" />
            </div>
          </Field>
          <Field label="Per person per day, at most" hint="Not counting the straight-away ones">
            <Input type="number" min={1} max={50} value={cfg.dailyCap} onChange={(e) => set("dailyCap", Number(e.target.value))} />
          </Field>
          <Field label='"New in your area" goes out at' hint="Hour of the day, 0–23 (Pakistan time)">
            <Input type="number" min={0} max={23} value={cfg.alertHour} onChange={(e) => set("alertHour", Number(e.target.value))} />
          </Field>
          <Field label="Remind before a listing or plan ends" hint="Days">
            <Input type="number" min={1} max={14} value={cfg.remindDays} onChange={(e) => set("remindDays", Number(e.target.value))} />
          </Field>
          <Field label="Views milestones" hint="Comma-separated">
            <Input value={cfg.milestones} onChange={(e) => set("milestones", e.target.value)} />
          </Field>
          <Field label="Price drop alert from" hint="Percent cheaper">
            <Input type="number" min={1} max={90} value={cfg.priceDropMinPct} onChange={(e) => set("priceDropMinPct", Number(e.target.value))} />
          </Field>
        </div>
      </DataCard>

      <DataCard>
        <DataCardTitle hint="Made from the site's favicon (Settings → Appearance), or its logo. Fill in only to use a different picture.">Icons</DataCardTitle>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Notification icon (square PNG, 192 px)">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cfg.icon || `/api/push/icon.png?t=${iconStamp}`} alt="" className="h-12 w-12 rounded-lg border object-contain" />
              <Input value={cfg.icon} onChange={(e) => set("icon", e.target.value)} placeholder="Empty = made from the site's favicon" />
            </div>
          </Field>
          <Field label="Status-bar badge (white on transparent, Android)">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cfg.badge || `/api/push/badge.png?t=${iconStamp}`} alt="" className="h-12 w-12 rounded-lg border bg-slate-800 object-contain p-1" />
              <Input value={cfg.badge} onChange={(e) => set("badge", e.target.value)} placeholder="Empty = made from the site's favicon" />
            </div>
          </Field>
        </div>
      </DataCard>
      {saveBar}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PushAdminPage />
    </Suspense>
  );
}

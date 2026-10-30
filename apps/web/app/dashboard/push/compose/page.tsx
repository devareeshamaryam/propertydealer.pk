"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CalendarClock, FlaskConical, Loader2, Save, Send, Users, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { DataCard, DataCardTitle, PageHeader, apiErrorMessage } from "@/components/dashboard";
import api from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Write a campaign: start from a template or from scratch, see what it looks
 * like on a phone, choose who gets it (and see how many devices that is),
 * then test it on your own devices, save it, schedule it or send it now.
 */

const WHO: { value: string; label: string; hint: string }[] = [
  { value: "all", label: "Everyone", hint: "Every device that allowed notifications" },
  { value: "users", label: "Signed in", hint: "People with an account" },
  { value: "guests", label: "Guests", hint: "Devices without an account" },
  { value: "agents", label: "All agents", hint: "Agent accounts" },
  { value: "free", label: "Agents on Free", hint: "Agents without a paid plan" },
  { value: "paid", label: "Agents on a paid plan", hint: "Starter, Dealer, Agency…" },
  { value: "buyers", label: "Buyers", hint: "Accounts that are not agents" },
  { value: "admins", label: "Admins", hint: "Team only" },
  { value: "specific", label: "Picked people", hint: "Choose accounts by name" },
];

interface Form {
  name: string;
  title: string;
  body: string;
  url: string;
  icon: string;
  image: string;
  actions: { title: string; url: string }[];
  requireInteraction: boolean;
  ttlHours: number;
  urgency: string;
  audience: { who: string; cityIds: string[]; areaIds: string[]; purpose: string; devices: string[]; userIds: string[]; activeWithinDays: number };
}

const EMPTY: Form = {
  name: "",
  title: "",
  body: "",
  url: "/",
  icon: "",
  image: "",
  actions: [],
  requireInteraction: false,
  ttlHours: 24,
  urgency: "normal",
  audience: { who: "all", cityIds: [], areaIds: [], purpose: "", devices: [], userIds: [], activeWithinDays: 0 },
};

type Opt = { _id: string; name: string; n?: number; email?: string };

function Chips({ items, selected, onToggle }: { items: Opt[]; selected: string[]; onToggle: (id: string) => void }) {
  if (!items.length) return <p className="text-[12.5px] text-slate-500">No devices with this yet.</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((o) => (
        <button
          key={o._id}
          type="button"
          onClick={() => onToggle(o._id)}
          className={cn("rounded-full border px-3 py-1 text-[12.5px]", selected.includes(o._id) ? "border-primary bg-primary/10 font-semibold text-primary" : "hover:bg-slate-50")}
        >
          {o.name}
          {o.n !== undefined && <span className="ml-1 text-slate-400">{o.n}</span>}
        </button>
      ))}
    </div>
  );
}

function ComposePage() {
  const router = useRouter();
  const id = useSearchParams().get("id");
  const [f, setF] = useState<Form>(EMPTY);
  const [templates, setTemplates] = useState<any[]>([]);
  const [siteName, setSiteName] = useState("Property Dealer");
  const [cities, setCities] = useState<Opt[]>([]);
  const [areas, setAreas] = useState<Opt[]>([]);
  const [people, setPeople] = useState<Opt[]>([]);
  const [picked, setPicked] = useState<Opt[]>([]);
  const [userQ, setUserQ] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [sendAt, setSendAt] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    api.get("/push/admin/settings").then((r) => setTemplates(r.data.templates || [])).catch(() => {});
    api.get("/push/config").then((r) => setSiteName(r.data.siteName || "Property Dealer")).catch(() => {});
    api.get("/push/admin/options").then((r) => setCities(r.data.cities || [])).catch(() => {});
    api.get("/push/admin/options", { params: { kind: "areas" } }).then((r) => setAreas(r.data.areas || [])).catch(() => {});
    if (id) {
      api
        .get(`/push/admin/campaigns/${id}`)
        .then((r) => {
          const c = r.data;
          setF({ ...EMPTY, ...c, icon: c.icon || "", image: c.image || "", audience: { ...EMPTY.audience, ...(c.audience || {}) } });
          if (c.sendAt && c.status === "scheduled") setSendAt(new Date(c.sendAt).toISOString().slice(0, 16));
        })
        .catch((e) => toast.error(apiErrorMessage(e, "Could not open the campaign")));
    }
  }, [id]);

  // How many devices the audience reaches, as it changes.
  useEffect(() => {
    const t = setTimeout(() => {
      api
        .post("/push/admin/estimate", { audience: f.audience })
        .then((r) => setCount(r.data.count))
        .catch(() => setCount(null));
    }, 350);
    return () => clearTimeout(t);
  }, [f.audience]);

  useEffect(() => {
    if (userQ.trim().length < 2) return setPeople([]);
    const t = setTimeout(() => {
      api.get("/push/admin/options", { params: { kind: "users", q: userQ } }).then((r) => setPeople(r.data.users || [])).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [userQ]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const aud = (patch: Partial<Form["audience"]>) => setF((x) => ({ ...x, audience: { ...x.audience, ...patch } }));
  const toggleIn = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const fill = (s: string) => s.replace(/\{site\}/g, siteName);

  const applyTemplate = (t: any) => {
    setF((x) => ({ ...x, name: t.name, title: t.title, body: t.body, url: t.url, audience: { ...x.audience, who: t.who } }));
    toast.success(`"${t.name}" filled in — change anything you like`);
  };

  const submit = async (action: "draft" | "send" | "schedule" | "test") => {
    if (!f.title.trim()) return toast.error("Add a title");
    if (action === "send" && !window.confirm(`Send to ${count ?? "all matching"} devices now?`)) return;
    if (action === "schedule" && !sendAt) return toast.error("Pick when it should go out");
    setBusy(action);
    try {
      const body = { ...f, action, sendAt: action === "schedule" ? new Date(sendAt).toISOString() : undefined };
      const r = id ? await api.put(`/push/admin/campaigns/${id}`, body) : await api.post("/push/admin/campaigns", body);
      if (action === "test") {
        toast.success(`Test sent to ${r.data.tested.sent} of your ${r.data.tested.devices} ${r.data.tested.devices === 1 ? "device" : "devices"}`);
        return;
      }
      toast.success(action === "send" ? "Sending now" : action === "schedule" ? "Scheduled" : "Saved as a draft");
      router.push("/dashboard/push?tab=campaigns");
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not save the campaign"));
    } finally {
      setBusy("");
    }
  };

  const who = useMemo(() => WHO.find((w) => w.value === f.audience.who), [f.audience.who]);

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-5">
      <PageHeader
        title={id ? "Edit campaign" : "New campaign"}
        description="A notification you write and send yourself — to everyone, or just the people it is for."
        actions={
          <Button variant="outline" asChild>
            <Link href="/dashboard/push?tab=campaigns">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Campaigns
            </Link>
          </Button>
        }
      />

      {!id && templates.length > 0 && (
        <DataCard>
          <DataCardTitle hint="Tap one to start from it">Ready-made</DataCardTitle>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {templates.map((t) => (
              <button key={t.id} type="button" onClick={() => applyTemplate(t)} className="rounded-xl border p-3 text-left hover:border-primary hover:bg-primary/5">
                <p className="text-[13.5px] font-semibold text-slate-900">{t.name}</p>
                <p className="mt-0.5 text-[12px] text-slate-500">{t.hint}</p>
              </button>
            ))}
          </div>
        </DataCard>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <DataCard>
            <DataCardTitle>Message</DataCardTitle>
            <div className="mt-4 space-y-3">
              <label className="block text-[13.5px] font-medium text-slate-800">
                Title <span className="font-normal text-slate-400">({f.title.length}/120)</span>
                <Input className="mt-1.5" value={f.title} onChange={(e) => set("title", e.target.value)} maxLength={120} placeholder="New houses in Bahria Town this week" />
              </label>
              <label className="block text-[13.5px] font-medium text-slate-800">
                Message <span className="font-normal text-slate-400">({f.body.length}/400)</span>
                <Textarea className="mt-1.5" value={f.body} onChange={(e) => set("body", e.target.value)} maxLength={400} rows={3} placeholder="Short and useful — what is in it for them?" />
              </label>
              <label className="block text-[13.5px] font-medium text-slate-800">
                Opens
                <Input className="mt-1.5" value={f.url} onChange={(e) => set("url", e.target.value)} placeholder="/properties/sale/lahore/bahria-town" />
                <span className="text-[12px] font-normal text-slate-500">A page of the site (/…) or an https:// address</span>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-[13.5px] font-medium text-slate-800">
                  Big picture <span className="font-normal text-slate-400">(optional, wide)</span>
                  <Input className="mt-1.5" value={f.image} onChange={(e) => set("image", e.target.value)} placeholder="https://… or /uploads/…" />
                </label>
                <label className="block text-[13.5px] font-medium text-slate-800">
                  Icon <span className="font-normal text-slate-400">(optional — default: the site's)</span>
                  <Input className="mt-1.5" value={f.icon} onChange={(e) => set("icon", e.target.value)} placeholder="Empty = the site's favicon" />
                </label>
              </div>
              <div>
                <p className="text-[13.5px] font-medium text-slate-800">Buttons <span className="font-normal text-slate-400">(up to 2)</span></p>
                {f.actions.map((a, i) => (
                  <div key={i} className="mt-1.5 flex gap-2">
                    <Input value={a.title} maxLength={24} placeholder="View plans" onChange={(e) => set("actions", f.actions.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                    <Input value={a.url} placeholder="/packages" onChange={(e) => set("actions", f.actions.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
                    <Button type="button" variant="ghost" size="sm" onClick={() => set("actions", f.actions.filter((_, j) => j !== i))} aria-label="Remove button">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {f.actions.length < 2 && (
                  <Button type="button" variant="outline" size="sm" className="mt-1.5" onClick={() => set("actions", [...f.actions, { title: "", url: "/" }])}>
                    Add a button
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-6 pt-1 text-[13.5px] text-slate-700">
                <label className="flex items-center gap-2">
                  <Switch checked={f.requireInteraction} onCheckedChange={(v) => set("requireInteraction", v)} /> Stay on screen until tapped (computers)
                </label>
                <label className="flex items-center gap-2">
                  Deliver within
                  <select value={f.ttlHours} onChange={(e) => set("ttlHours", Number(e.target.value))} className="rounded-lg border px-2 py-1">
                    {[1, 6, 12, 24, 72, 168].map((h) => (
                      <option key={h} value={h}>
                        {h < 24 ? `${h} hours` : `${h / 24} ${h === 24 ? "day" : "days"}`}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  Priority
                  <select value={f.urgency} onChange={(e) => set("urgency", e.target.value)} className="rounded-lg border px-2 py-1">
                    <option value="normal">Normal</option>
                    <option value="high">High (wakes the phone)</option>
                    <option value="low">Low (saves battery)</option>
                  </select>
                </label>
              </div>
              <label className="block text-[13.5px] font-medium text-slate-800">
                Name in the list <span className="font-normal text-slate-400">(only you see it)</span>
                <Input className="mt-1.5" value={f.name} onChange={(e) => set("name", e.target.value)} maxLength={80} placeholder={f.title || "Campaign name"} />
              </label>
            </div>
          </DataCard>

          <DataCard>
            <DataCardTitle hint={who?.hint}>Who gets it</DataCardTitle>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {WHO.map((w) => (
                <button
                  key={w.value}
                  type="button"
                  onClick={() => aud({ who: w.value })}
                  className={cn("rounded-full border px-3 py-1.5 text-[13px]", f.audience.who === w.value ? "border-primary bg-primary text-white" : "hover:bg-slate-50")}
                >
                  {w.label}
                </button>
              ))}
            </div>

            {f.audience.who === "specific" && (
              <div className="mt-4">
                <Input value={userQ} onChange={(e) => setUserQ(e.target.value)} placeholder="Search by name, email or phone" />
                {people.length > 0 && (
                  <ul className="mt-1 max-h-48 overflow-y-auto rounded-xl border">
                    {people.map((p) => (
                      <li key={p._id}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-[13.5px] hover:bg-slate-50"
                          onClick={() => {
                            if (!f.audience.userIds.includes(p._id)) {
                              aud({ userIds: [...f.audience.userIds, p._id] });
                              setPicked((x) => [...x, p]);
                            }
                            setUserQ("");
                          }}
                        >
                          {p.name} <span className="text-slate-400">{p.email}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {f.audience.userIds.map((uid) => (
                    <span key={uid} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[12.5px] text-primary">
                      {picked.find((p) => p._id === uid)?.name || uid.slice(-6)}
                      <button type="button" onClick={() => aud({ userIds: f.audience.userIds.filter((x) => x !== uid) })} aria-label="Remove">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5 space-y-4">
              <div>
                <p className="mb-1.5 text-[13px] font-medium text-slate-700">City (optional)</p>
                <Chips items={cities} selected={f.audience.cityIds} onToggle={(v) => aud({ cityIds: toggleIn(f.audience.cityIds, v) })} />
              </div>
              <div>
                <p className="mb-1.5 text-[13px] font-medium text-slate-700">People who have been looking at… (optional)</p>
                <Chips items={areas} selected={f.audience.areaIds} onToggle={(v) => aud({ areaIds: toggleIn(f.audience.areaIds, v) })} />
                <div className="mt-2 flex gap-1.5">
                  {[
                    ["", "Rent or sale"],
                    ["sale", "Buying"],
                    ["rent", "Renting"],
                  ].map(([v, l]) => (
                    <button key={v} type="button" onClick={() => aud({ purpose: v })} className={cn("rounded-full border px-3 py-1 text-[12.5px]", f.audience.purpose === v ? "border-primary bg-primary/10 font-semibold text-primary" : "hover:bg-slate-50")}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <p className="mb-1.5 text-[13px] font-medium text-slate-700">Device</p>
                  <div className="flex gap-1.5">
                    {["mobile", "desktop", "tablet"].map((d) => (
                      <button key={d} type="button" onClick={() => aud({ devices: toggleIn(f.audience.devices, d) })} className={cn("rounded-full border px-3 py-1 text-[12.5px] capitalize", f.audience.devices.includes(d) ? "border-primary bg-primary/10 font-semibold text-primary" : "hover:bg-slate-50")}>
                        {d === "mobile" ? "Phones" : d === "desktop" ? "Computers" : "Tablets"}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="text-[13px] font-medium text-slate-700">
                  Seen on the site within
                  <select value={f.audience.activeWithinDays} onChange={(e) => aud({ activeWithinDays: Number(e.target.value) })} className="ml-2 rounded-lg border px-2 py-1 font-normal">
                    <option value={0}>any time</option>
                    <option value={7}>7 days</option>
                    <option value={30}>30 days</option>
                    <option value={90}>90 days</option>
                  </select>
                </label>
              </div>
            </div>
          </DataCard>
        </div>

        <div className="space-y-5">
          <div className="lg:sticky lg:top-20 space-y-5">
            <DataCard>
              <DataCardTitle hint="Roughly — every phone draws it a little differently">Preview</DataCardTitle>
              <div className="mt-3 rounded-2xl bg-slate-800 p-3">
                <div className="rounded-xl bg-white p-3 shadow">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/api/push/badge.png" alt="" className="h-3.5 w-3.5 rounded-sm bg-primary p-0.5" />
                    {siteName} · now
                  </div>
                  <div className="mt-1.5 flex gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-[13.5px] font-semibold text-slate-900">{fill(f.title) || "Your title"}</p>
                      <p className="line-clamp-3 text-[12.5px] text-slate-600">{fill(f.body) || "Your message"}</p>
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.icon || "/api/push/icon.png"} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                  </div>
                  {f.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.image} alt="" className="mt-2 max-h-36 w-full rounded-lg object-cover" />
                  )}
                  {f.actions.length > 0 && (
                    <div className="mt-2 flex gap-4 border-t pt-2 text-[12.5px] font-semibold text-primary">
                      {f.actions.map((a, i) => (
                        <span key={i}>{a.title || "Button"}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </DataCard>

            <DataCard>
              <div className="flex items-center gap-2 text-slate-900">
                <Users className="h-5 w-5 text-primary" />
                <span className="text-[22px] font-bold tabular-nums">{count === null ? "…" : count.toLocaleString()}</span>
                <span className="text-[13px] text-slate-500">devices will get it</span>
              </div>
              <p className="mt-1 text-[12px] text-slate-500">People who switched off "News &amp; offers" are left out.</p>
              <div className="mt-4 grid gap-2">
                <Button onClick={() => void submit("send")} disabled={!!busy || count === 0}>
                  {busy === "send" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Send now
                </Button>
                <div className="flex gap-2">
                  <Input type="datetime-local" value={sendAt} onChange={(e) => setSendAt(e.target.value)} className="flex-1" />
                  <Button variant="outline" onClick={() => void submit("schedule")} disabled={!!busy}>
                    {busy === "schedule" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
                    <span className="ml-1.5">Schedule</span>
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => void submit("test")} disabled={!!busy}>
                    {busy === "test" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FlaskConical className="mr-2 h-4 w-4" />}
                    Test on me
                  </Button>
                  <Button variant="outline" onClick={() => void submit("draft")} disabled={!!busy}>
                    {busy === "draft" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save draft
                  </Button>
                </div>
              </div>
            </DataCard>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ComposePage />
    </Suspense>
  );
}

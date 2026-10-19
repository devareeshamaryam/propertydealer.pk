"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowRightLeft,
  Building2,
  Eye,
  KeyRound,
  Loader2,
  Lock,
  MessageCircle,
  Pause,
  Pencil,
  Phone,
  Play,
  Plus,
  Star,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { packageApi, subscriptionApi, teamApi, type MyPlan, type TeamMember, type TeamOverview } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataCard, PageHeader, StatCard, apiErrorMessage } from "@/components/dashboard";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";
import type { Plan } from "@/lib/plans";

/**
 * My Team — an agency owner's agent accounts (the agency plans).
 *
 * The owner creates each agent with an email and a password and gives them
 * those; the agent signs in like anyone else and posts, edits and marks sold
 * only their own listings, under the agency's plan. Featuring, deleting,
 * buying plans and the team itself stay with the owner, who can here: edit an
 * agent, cap how many live listings they may have, reset their password,
 * pause them (signed out, cannot sign in; listings stay up), move their
 * listings to someone else, and remove them (listings move first).
 */

const newPassword = () => {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint32Array(10);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
};

const n = (v: number) => v.toLocaleString("en-PK");
const ME = "__me__";

type EditForm = { name: string; email: string; phone: string; listingLimit: string };

export default function TeamPage() {
  const { user } = useAuth();
  const [plan, setPlan] = useState<MyPlan | null>(null);
  const [data, setData] = useState<TeamOverview | null>(null);
  const [teamPlans, setTeamPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: newPassword(), listingLimit: "" });
  const [editing, setEditing] = useState<{ member: TeamMember; form: EditForm } | null>(null);
  const [reset, setReset] = useState<{ member: TeamMember; password: string } | null>(null);
  const [moving, setMoving] = useState<{ member: TeamMember; to: string; remove: boolean } | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, t, plans] = await Promise.all([
        subscriptionApi.getMyPlan(),
        teamApi.list().catch(() => null),
        packageApi.getAll().catch(() => []),
      ]);
      setPlan(p);
      setData(t);
      setTeamPlans((Array.isArray(plans) ? (plans as Plan[]) : []).filter((x) => (x.teamMembers ?? 0) > 0).sort((a, b) => a.price - b.price));
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not load your team"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-60" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (user?.role === "ADMIN") {
    return <p className="p-6 text-sm text-muted-foreground">Agencies manage their own teams. See every account under Subscriptions.</p>;
  }

  if (plan?.team.role === "agent") {
    return (
      <div className="space-y-5">
        <PageHeader title="My Team" />
        <DataCard className="p-6 text-sm text-muted-foreground">
          You are an agent of an agency. You post and edit your own listings under its {plan.name} plan; your agency owner manages the
          team, featured listings and the plan.
        </DataCard>
      </div>
    );
  }

  const limit = data?.limit ?? plan?.perks.teamMembers ?? 0;
  const members = data?.members ?? [];
  const pool = data?.pool;

  if (limit <= 0 && members.length === 0) {
    return (
      <div className="space-y-5">
        <PageHeader title="My Team" description="Agent accounts for your agency." />
        <DataCard className="p-6 text-center sm:p-8">
          <Lock className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 font-semibold">Agent accounts come with the agency plans</p>
          {teamPlans.length > 0 && (
            <p className="mt-1 text-sm font-medium text-slate-700">
              {teamPlans.map((p) => `${p.name}: ${p.teamMembers} agents`).join(" · ")}
            </p>
          )}
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Each agent signs in with their own email and posts their own listings under your plan, with your agency&apos;s name and
            Verified badge. You see every listing, decide what is featured, and can pause or remove an agent at any time.
          </p>
          <Button asChild className="mt-4">
            <Link href="/dashboard/purchase-package">See the agency plans</Link>
          </Button>
        </DataCard>
      </div>
    );
  }

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(ok);
      await load();
      return true;
    } catch (e) {
      toast.error(apiErrorMessage(e, "Something went wrong"));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const capOf = (v: string): number | null => {
    const t = v.trim();
    if (!t || t === "0") return 0;
    const x = Math.floor(Number(t));
    return Number.isFinite(x) && x >= 0 ? x : null;
  };

  const create = async () => {
    const cap = capOf(form.listingLimit);
    if (cap === null) return toast.error("The listing limit must be a whole number");
    const done = await run(
      "add",
      () => teamApi.create({ name: form.name, email: form.email, password: form.password, phone: form.phone || undefined, listingLimit: cap || undefined }),
      `${form.name} added — they sign in with ${form.email} and the password you set`,
    );
    if (done) {
      setAdding(false);
      setForm({ name: "", email: "", phone: "", password: newPassword(), listingLimit: "" });
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    const cap = capOf(editing.form.listingLimit);
    if (cap === null) return toast.error("The listing limit must be a whole number");
    const done = await run(
      `edit-${editing.member._id}`,
      () => teamApi.update(editing.member._id, { name: editing.form.name, email: editing.form.email, phone: editing.form.phone, listingLimit: cap || null }),
      `${editing.form.name} updated`,
    );
    if (done) setEditing(null);
  };

  const savePassword = async () => {
    if (!reset) return;
    const done = await run(`pw-${reset.member._id}`, () => teamApi.update(reset.member._id, { password: reset.password }), `New password set for ${reset.member.name} — they are signed out everywhere`);
    if (done) setReset(null);
  };

  const doMove = async () => {
    if (!moving) return;
    const to = moving.to === ME ? undefined : moving.to;
    const m = moving.member;
    const done = moving.remove
      ? await run(`rm-${m._id}`, () => teamApi.remove(m._id, to), `${m.name} removed — their listings moved`)
      : await run(`mv-${m._id}`, () => teamApi.transfer(m._id, to), `${m.name}'s listings moved`);
    if (done) setMoving(null);
  };

  const totals = members.reduce(
    (t, m) => ({ views: t.views + m.stats.views, leads: t.leads + m.stats.calls + m.stats.whatsapp }),
    { views: data?.owner.stats.views ?? 0, leads: (data?.owner.stats.calls ?? 0) + (data?.owner.stats.whatsapp ?? 0) },
  );
  const featuredUsed = members.reduce((t, m) => t + m.listings.featured, data?.owner.listings.featured ?? 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="My Team"
        description={`Agent accounts of your agency on ${data?.planName ?? plan?.name ?? "your plan"}.`}
        actions={
          <Button onClick={() => setAdding(true)} disabled={members.length >= limit}>
            <UserPlus className="mr-1.5 h-4 w-4" /> Add agent
          </Button>
        }
      />

      {members.length > limit && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Your plan includes {limit} agent account{limit === 1 ? "" : "s"} and you have {members.length}. The extra agents keep
          working for now — remove or pause some, or move up a plan.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Agents" value={`${members.length} / ${limit}`} icon={Users} tone="info" hint={`${members.filter((m) => !m.isActive).length} paused`} />
        <StatCard
          label="Team listings"
          value={pool ? `${n(pool.used)} / ${n(pool.limit)}` : "—"}
          icon={Building2}
          tone={pool && pool.limit && pool.used / pool.limit >= 0.9 ? "warning" : "neutral"}
          hint="Live and pending, everyone together"
        />
        <StatCard label="Featured" value={pool ? `${featuredUsed} / ${pool.featuredLimit}` : "—"} icon={Star} tone="neutral" hint="Only you can feature" />
        <StatCard label="Leads" value={n(totals.leads)} icon={Phone} tone="neutral" hint={`${n(totals.views)} views in all`} />
      </div>

      <DataCard className="text-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="font-semibold text-slate-900">Your agents can</p>
            <ul className="mt-1.5 space-y-1 text-muted-foreground">
              <li>• Post listings under your plan, with your agency&apos;s name</li>
              <li>• Edit their own listings and mark them sold or rented</li>
              <li>• See their own views and enquiries</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-slate-900">Only you can</p>
            <ul className="mt-1.5 space-y-1 text-muted-foreground">
              <li>• Feature and delete listings — any listing of the team</li>
              <li>• Add, pause, edit and remove agents, and cap their listings</li>
              <li>• Buy or change the plan</li>
            </ul>
          </div>
        </div>
      </DataCard>

      {members.length === 0 ? (
        <DataCard className="flex flex-col items-center gap-2 p-10 text-center">
          <Users className="h-8 w-8 text-slate-300" />
          <p className="font-medium">No agents yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">Add your agents — they list under your plan and show as agents of your agency.</p>
          <Button className="mt-2" onClick={() => setAdding(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Add your first agent
          </Button>
        </DataCard>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {members.map((m) => {
            const capUsed = m.listings.live + m.listings.pending;
            return (
              <DataCard key={m._id} className={cn("space-y-3", !m.isActive && "bg-slate-50")}>
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "grid h-11 w-11 shrink-0 place-items-center rounded-full text-[15px] font-semibold",
                      m.isActive ? "bg-primary/10 text-primary" : "bg-slate-200 text-slate-500",
                    )}
                  >
                    {m.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      <span className="truncate">{m.name}</span>
                      {m.isActive ? (
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Paused</Badge>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {m.email}
                      {m.phone ? ` · ${m.phone}` : ""}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-1.5 text-center">
                  {[
                    ["Live", m.listings.live],
                    ["Pending", m.listings.pending],
                    ["Expired", m.listings.expired],
                    ["Featured", m.listings.featured],
                  ].map(([label, v]) => (
                    <div key={label as string} className="rounded-lg bg-slate-50 px-1 py-2">
                      <p className="text-[15px] font-bold tabular-nums">{n(v as number)}</p>
                      <p className="text-[11px] text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" /> {n(m.stats.views)} views
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" /> {n(m.stats.calls)} calls
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="h-3.5 w-3.5" /> {n(m.stats.whatsapp)} WhatsApp
                  </span>
                  <span className="ml-auto font-medium text-slate-700">
                    {m.listingLimit > 0 ? `Limit ${capUsed} / ${m.listingLimit}` : "No own limit"}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 border-t pt-3">
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/dashboard/property?ownerId=${m._id}&owner=${encodeURIComponent(m.name)}`}>
                      <Building2 className="mr-1.5 h-3.5 w-3.5" /> Listings
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setEditing({ member: m, form: { name: m.name, email: m.email, phone: m.phone, listingLimit: m.listingLimit ? String(m.listingLimit) : "" } })
                    }
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setReset({ member: m, password: newPassword() })}>
                    <KeyRound className="mr-1.5 h-3.5 w-3.5" /> Password
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy === `pause-${m._id}`}
                    onClick={() =>
                      void run(
                        `pause-${m._id}`,
                        () => teamApi.update(m._id, { isActive: !m.isActive }),
                        m.isActive ? `${m.name} paused — signed out, cannot sign in` : `${m.name} can sign in again`,
                      )
                    }
                  >
                    {m.isActive ? <Pause className="mr-1.5 h-3.5 w-3.5" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}
                    {m.isActive ? "Pause" : "Resume"}
                  </Button>
                  <Button size="sm" variant="outline" disabled={m.listings.total === 0} onClick={() => setMoving({ member: m, to: ME, remove: false })}>
                    <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" /> Move listings
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto text-destructive hover:text-destructive"
                    onClick={() => setMoving({ member: m, to: ME, remove: true })}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove
                  </Button>
                </div>
              </DataCard>
            );
          })}
        </div>
      )}

      {/* Add */}
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add an agent</DialogTitle>
            <DialogDescription>
              {members.length} of {limit} agent accounts in use.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field id="t-name" label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Field id="t-email" label="Email (they sign in with it)" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
            <Field id="t-phone" label="Phone / WhatsApp" value={form.phone} placeholder="0300 1234567" onChange={(v) => setForm({ ...form, phone: v })} />
            <Field
              id="t-cap"
              label="Listing limit (optional)"
              value={form.listingLimit}
              placeholder="Empty: no limit of their own"
              inputMode="numeric"
              hint={pool ? `How many live listings this agent may have, out of the team's ${n(pool.limit)}.` : undefined}
              onChange={(v) => setForm({ ...form, listingLimit: v.replace(/\D/g, "") })}
            />
            <div className="space-y-1.5">
              <Label htmlFor="t-pass">Password</Label>
              <div className="flex gap-2">
                <Input id="t-pass" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                <Button type="button" variant="outline" onClick={() => setForm({ ...form, password: newPassword() })}>
                  New
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Give this to the agent; you can set a new one any time.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button onClick={() => void create()} disabled={busy === "add" || !form.name.trim() || !form.email.trim() || form.password.length < 6}>
              {busy === "add" && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Add agent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editing?.member.name}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <Field id="e-name" label="Name" value={editing.form.name} onChange={(v) => setEditing({ ...editing, form: { ...editing.form, name: v } })} />
              <Field
                id="e-email"
                label="Email (they sign in with it)"
                type="email"
                value={editing.form.email}
                onChange={(v) => setEditing({ ...editing, form: { ...editing.form, email: v } })}
              />
              <Field id="e-phone" label="Phone / WhatsApp" value={editing.form.phone} onChange={(v) => setEditing({ ...editing, form: { ...editing.form, phone: v } })} />
              <Field
                id="e-cap"
                label="Listing limit"
                value={editing.form.listingLimit}
                placeholder="Empty: no limit of their own"
                inputMode="numeric"
                hint="Listings already up stay up; a lower limit only stops new ones."
                onChange={(v) => setEditing({ ...editing, form: { ...editing.form, listingLimit: v.replace(/\D/g, "") } })}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={() => void saveEdit()} disabled={!editing || busy === `edit-${editing.member._id}` || !editing.form.name.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password */}
      <Dialog open={!!reset} onOpenChange={(o) => !o && setReset(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New password for {reset?.member.name}</DialogTitle>
            <DialogDescription>They are signed out everywhere and sign in again with this password.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input value={reset?.password ?? ""} onChange={(e) => reset && setReset({ ...reset, password: e.target.value })} />
            <Button type="button" variant="outline" onClick={() => reset && setReset({ ...reset, password: newPassword() })}>
              New
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReset(null)}>
              Cancel
            </Button>
            <Button onClick={() => void savePassword()} disabled={(reset?.password.length ?? 0) < 6}>
              Set password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move listings / remove */}
      <Dialog open={!!moving} onOpenChange={(o) => !o && setMoving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{moving?.remove ? `Remove ${moving?.member.name}?` : `Move ${moving?.member.name}'s listings`}</DialogTitle>
            <DialogDescription>
              {moving?.remove
                ? `Their account is closed. Their ${moving?.member.listings.total ?? 0} listings move to the person you choose, so nothing published disappears.`
                : `All ${moving?.member.listings.total ?? 0} of their listings move to the person you choose.`}
            </DialogDescription>
          </DialogHeader>
          {moving && (
            <div className="space-y-1.5">
              <Label>Give the listings to</Label>
              <Select value={moving.to} onValueChange={(to) => setMoving({ ...moving, to })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ME}>Me (agency owner)</SelectItem>
                  {members
                    .filter((x) => x._id !== moving.member._id)
                    .map((x) => (
                      <SelectItem key={x._id} value={x._id}>
                        {x.name}
                        {x.isActive ? "" : " (paused)"}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMoving(null)}>
              Cancel
            </Button>
            <Button variant={moving?.remove ? "destructive" : "default"} onClick={() => void doMove()} disabled={!!busy}>
              {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {moving?.remove ? "Remove agent" : "Move listings"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  hint,
  inputMode,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  hint?: string;
  inputMode?: "numeric" | "text";
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} placeholder={placeholder} inputMode={inputMode} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

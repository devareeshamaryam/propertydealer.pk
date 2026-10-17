"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { KeyRound, Loader2, Lock, Plus, Trash2, UserPlus, Users } from "lucide-react";
import { subscriptionApi, teamApi, type MyPlan, type TeamMember } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog, DataCard, PageHeader, apiErrorMessage, useConfirm } from "@/components/dashboard";
import { useAuth } from "@/context/auth-context";

/**
 * My Team — an agency owner's agent accounts (Agency Plus).
 *
 * The owner creates each agent with an email and a password and gives them
 * those; the agent signs in like anyone else and manages only their own
 * listings, under the agency's plan. Switching an agent off stops them signing
 * in; removing one moves their listings to the owner.
 */

const newPassword = () => {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint32Array(10);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
};

export default function TeamPage() {
  const { user } = useAuth();
  const [plan, setPlan] = useState<MyPlan | null>(null);
  const [data, setData] = useState<{ limit: number; planName: string; members: TeamMember[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: newPassword() });
  const [saving, setSaving] = useState(false);
  const [reset, setReset] = useState<{ member: TeamMember; password: string } | null>(null);
  const { confirm, dialogProps } = useConfirm();

  const load = useCallback(async () => {
    try {
      const [p, t] = await Promise.all([subscriptionApi.getMyPlan(), teamApi.list().catch(() => null)]);
      setPlan(p);
      setData(t);
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
          You are an agent of an agency. Your agency owner manages the team and the plan ({plan.name}).
        </DataCard>
      </div>
    );
  }

  const limit = data?.limit ?? plan?.perks.teamMembers ?? 0;
  const members = data?.members ?? [];

  if (limit <= 0 && members.length === 0) {
    return (
      <div className="space-y-5">
        <PageHeader title="My Team" description="Agent accounts for your agency." />
        <DataCard className="p-8 text-center">
          <Lock className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 font-semibold">Team accounts come with Agency Plus</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Create accounts for up to 10 agents. Each agent posts and manages their own listings under your plan, shows as an agent of your
            agency with the Verified badge, and you see every listing of the team.
          </p>
          <Button asChild className="mt-4">
            <Link href="/dashboard/purchase-package">See Agency Plus</Link>
          </Button>
        </DataCard>
      </div>
    );
  }

  const create = async () => {
    setSaving(true);
    try {
      const m = await teamApi.create({ name: form.name, email: form.email, password: form.password, phone: form.phone || undefined });
      toast.success(`${m.name} added`, { description: `They sign in with ${m.email} and the password you set.` });
      setAdding(false);
      setForm({ name: "", email: "", phone: "", password: newPassword() });
      void load();
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not add the agent"));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (m: TeamMember, isActive: boolean) => {
    try {
      await teamApi.update(m._id, { isActive });
      toast.success(isActive ? `${m.name} can sign in again` : `${m.name} can no longer sign in`);
      void load();
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not change the agent"));
    }
  };

  const savePassword = async () => {
    if (!reset) return;
    try {
      await teamApi.update(reset.member._id, { password: reset.password });
      toast.success(`New password set for ${reset.member.name}`, { description: "They are signed out everywhere and use the new one." });
      setReset(null);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not set the password"));
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="My Team"
        description={`Agent accounts of your agency — ${members.length} of ${limit} in use on ${data?.planName ?? plan?.name ?? "your plan"}.`}
        actions={
          <Button onClick={() => setAdding(true)} disabled={members.length >= limit}>
            <UserPlus className="mr-1.5 h-4 w-4" /> Add agent
          </Button>
        }
      />

      <DataCard flush>
        {members.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <Users className="h-8 w-8 text-slate-300" />
            <p className="font-medium">No agents yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">Add your agents — they will list under your plan and show as agents of your agency.</p>
            <Button className="mt-2" onClick={() => setAdding(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Add your first agent
            </Button>
          </div>
        ) : (
          <ul className="divide-y">
            {members.map((m) => (
              <li key={m._id} className="flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 font-semibold text-primary">
                  {m.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {m.name} {!m.isActive && <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">Switched off</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {m.email}
                    {m.phone ? ` · ${m.phone}` : ""}
                  </p>
                </div>
                <Link
                  href={`/dashboard/property?ownerId=${m._id}&owner=${encodeURIComponent(m.name)}`}
                  className="shrink-0 text-sm font-medium text-primary hover:underline"
                >
                  {m.listings.live} live · {m.listings.total} listings
                </Link>
                <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  <Switch checked={m.isActive} onCheckedChange={(v) => void toggle(m, v)} />
                  Can sign in
                </label>
                <Button variant="ghost" size="icon" aria-label="Set a new password" onClick={() => setReset({ member: m, password: newPassword() })}>
                  <KeyRound className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove agent"
                  onClick={() =>
                    confirm({
                      title: `Remove ${m.name}?`,
                      description: `Their account is closed and their ${m.listings.total} listings move to you, so nothing published disappears.`,
                      confirmLabel: "Remove agent",
                      destructive: true,
                      onConfirm: async () => {
                        try {
                          const r = await teamApi.remove(m._id);
                          toast.success(`${m.name} removed`, { description: `${r.listingsMoved} listings moved to you.` });
                          void load();
                        } catch (e) {
                          toast.error(apiErrorMessage(e, "Could not remove the agent"));
                        }
                      },
                    })
                  }
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DataCard>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add an agent</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="t-name">Name</Label>
              <Input id="t-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-email">Email (they sign in with it)</Label>
              <Input id="t-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-phone">Phone / WhatsApp</Label>
              <Input id="t-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0300 1234567" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-pass">Password</Label>
              <div className="flex gap-2">
                <Input id="t-pass" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                <Button type="button" variant="outline" onClick={() => setForm({ ...form, password: newPassword() })}>
                  New
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Give this to the agent; they can change it later.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            <Button onClick={() => void create()} disabled={saving || !form.name.trim() || !form.email.trim() || form.password.length < 6}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Add agent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reset} onOpenChange={(o) => !o && setReset(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New password for {reset?.member.name}</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2">
            <Input value={reset?.password ?? ""} onChange={(e) => reset && setReset({ ...reset, password: e.target.value })} />
            <Button type="button" variant="outline" onClick={() => reset && setReset({ ...reset, password: newPassword() })}>
              New
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">They are signed out everywhere and sign in again with this password.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReset(null)}>Cancel</Button>
            <Button onClick={() => void savePassword()} disabled={(reset?.password.length ?? 0) < 6}>Set password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}

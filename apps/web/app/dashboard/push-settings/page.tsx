"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Laptop, Loader2, Send, Smartphone, Tablet, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { DataCard, DataCardTitle, PageHeader, apiErrorMessage } from "@/components/dashboard";
import api from "@/lib/api";
import { currentPushEndpoint, disablePush, enablePush, pushPermission, pushSupport } from "@/lib/push-client";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";

/**
 * Dashboard → Push notifications: turn them on for this browser, choose which
 * groups to get, and see (or stop) the other devices that get them.
 */

interface Prefs {
  categories: { id: string; label: string; hint: string }[];
  off: string[];
  devices: { id: string; browser: string; os: string; device: string; place: string; since: string; lastSeen: string; tail: string }[];
}

const DeviceIcon = ({ kind }: { kind: string }) => (kind === "mobile" ? <Smartphone className="h-5 w-5" /> : kind === "tablet" ? <Tablet className="h-5 w-5" /> : <Laptop className="h-5 w-5" />);
const when = (iso: string) => new Date(iso).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });

export default function PushSettingsPage() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [here, setHere] = useState<{ on: boolean; tail: string; support: string; perm: string }>({ on: false, tail: "", support: "ok", perm: "default" });
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try {
      const [p, endpoint] = await Promise.all([api.get("/push/prefs"), currentPushEndpoint()]);
      setPrefs(p.data);
      setHere({ on: !!endpoint && pushPermission() === "granted", tail: endpoint ? endpoint.slice(-24) : "", support: pushSupport(), perm: String(pushPermission()) });
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not load your notification settings"));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const turnOn = async () => {
    setBusy("on");
    const r = await enablePush("settings", user?._id || "");
    setBusy("");
    if (r.ok) toast.success("Notifications are on for this browser");
    else if (r.reason === "denied") toast.error("Notifications are blocked", { description: "Allow them from the lock icon next to the address bar, then try again." });
    else if (r.reason === "ios-install") toast.info("On iPhone, add the site to your Home Screen first (Share → Add to Home Screen).");
    else toast.error("This browser can't receive notifications");
    void load();
  };

  const turnOff = async () => {
    setBusy("off");
    await disablePush();
    setBusy("");
    toast.success("Notifications are off for this browser");
    void load();
  };

  const toggle = async (id: string, on: boolean) => {
    if (!prefs) return;
    const off = on ? prefs.off.filter((x) => x !== id) : [...prefs.off, id];
    setPrefs({ ...prefs, off });
    try {
      await api.put("/push/prefs", { off });
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not save"));
      void load();
    }
  };

  const removeDevice = async (id: string) => {
    setBusy(id);
    try {
      await api.delete(`/push/prefs/devices/${id}`);
      toast.success("That device won't get notifications any more");
      void load();
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not remove the device"));
    } finally {
      setBusy("");
    }
  };

  const test = async () => {
    setBusy("test");
    try {
      const r = (await api.post("/push/test")).data;
      if (r.success) toast.success(`Test sent to ${r.sent} ${r.sent === 1 ? "device" : "devices"}`);
      else toast.info(r.message || "Turn notifications on first");
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not send a test"));
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="mx-auto w-full max-w-[860px] space-y-5">
      <PageHeader title="Push notifications" description="Get told on your phone or computer — even when the site is closed — about your listings, reviews, your plan and new properties in the areas you look at." />

      <DataCard>
        <DataCardTitle hint="This browser">On this device</DataCardTitle>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <span className={cn("grid h-10 w-10 place-items-center rounded-full", here.on ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>
              {here.on ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
            </span>
            <div>
              <p className="font-semibold text-slate-900">{here.on ? "Notifications are on" : "Notifications are off"}</p>
              <p className="text-[13px] text-slate-500">
                {here.support === "unsupported"
                  ? "This browser can't receive notifications."
                  : here.support === "ios-install"
                    ? "On iPhone: Share → Add to Home Screen, then open the site from there."
                    : here.perm === "denied"
                      ? "Blocked in this browser — allow them from the lock icon next to the address bar."
                      : here.on
                        ? "This browser gets your notifications."
                        : "Turn them on to hear about your listings and new properties."}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {here.on ? (
              <>
                <Button variant="outline" onClick={() => void test()} disabled={busy === "test"}>
                  {busy === "test" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Send a test
                </Button>
                <Button variant="outline" onClick={() => void turnOff()} disabled={busy === "off"}>
                  Turn off
                </Button>
              </>
            ) : (
              here.support === "ok" && (
                <Button onClick={() => void turnOn()} disabled={busy === "on" || here.perm === "denied"}>
                  {busy === "on" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bell className="mr-2 h-4 w-4" />}Turn on
                </Button>
              )
            )}
          </div>
        </div>
      </DataCard>

      <DataCard>
        <DataCardTitle hint="For all your devices">What to get</DataCardTitle>
        {!prefs ? (
          <Skeleton className="mt-3 h-48 w-full rounded-xl" />
        ) : (
          <ul className="mt-3 divide-y rounded-xl border">
            {prefs.categories.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="font-medium text-slate-900">{c.label}</p>
                  <p className="text-[13px] text-slate-500">{c.hint}</p>
                </div>
                <Switch checked={!prefs.off.includes(c.id)} onCheckedChange={(v) => void toggle(c.id, v)} aria-label={c.label} />
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[12.5px] text-slate-500">Reminders and alerts wait until morning if they come up at night, and you get only a few a day. Things you are waiting for — an approval, a payment — arrive straight away.</p>
      </DataCard>

      <DataCard>
        <DataCardTitle hint="Signed in with this account">Your devices</DataCardTitle>
        {!prefs ? (
          <Skeleton className="mt-3 h-24 w-full rounded-xl" />
        ) : prefs.devices.length === 0 ? (
          <p className="mt-3 text-[14px] text-slate-500">No device gets your notifications yet.</p>
        ) : (
          <ul className="mt-3 divide-y rounded-xl border">
            {prefs.devices.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3 text-slate-600">
                  <DeviceIcon kind={d.device} />
                  <div>
                    <p className="font-medium text-slate-900">
                      {d.browser} on {d.os}
                      {here.tail && d.tail === here.tail && <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">This device</span>}
                    </p>
                    <p className="text-[12.5px] text-slate-500">
                      {d.place ? `${d.place} · ` : ""}since {when(d.since)} · last seen {when(d.lastSeen)}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => void removeDevice(d.id)} disabled={busy === d.id} aria-label="Stop notifications on this device">
                  {busy === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DataCard>
    </div>
  );
}

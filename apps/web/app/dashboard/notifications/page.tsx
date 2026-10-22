"use client";

import { useState } from "react";
import { toast } from "sonner";
import { BarChart3, Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/dashboard";
import { apiErrorMessage } from "@/components/dashboard/api-error";
import { SaveButton, SettingsCard, useSettingsForm } from "@/components/dashboard/settings-form";
import { useAuth } from "@/context/auth-context";
import api from "@/lib/api";
import { NOTIFY_KINDS } from "@/lib/notify";
import type { SiteSettings } from "@/lib/site-settings";
import { cn } from "@/lib/utils";

/**
 * Settings → Notifications: which alerts reach the admin's Discord channel.
 *
 * Each alert says who it is about — name, phone, WhatsApp, email, city and
 * plan — and links straight to the thing (review, edit, open, their
 * listings). The channel itself is the server's DISCORD_WEBHOOK_URL.
 */

const KEYS = NOTIFY_KINDS.map((k) => `notify${k.key}`) as (keyof SiteSettings)[];

export default function NotificationSettingsPage() {
  const { user } = useAuth();
  const { settings, set, loading, saving, dirty, save } = useSettingsForm();
  const [busy, setBusy] = useState<"" | "test" | "digest">("");

  if (user && user.role !== "ADMIN") {
    return <p className="p-6 text-sm text-muted-foreground">Only admins can change notifications.</p>;
  }

  const run = async (kind: "test" | "digest") => {
    setBusy(kind);
    try {
      const { data } = await api.post(`/notify/${kind}`);
      if (data?.ok) toast.success(kind === "test" ? "Sent — check your Discord channel" : "Today's report sent to Discord");
      else toast.error("Not sent", { description: data?.reason || "Check DISCORD_WEBHOOK_URL on the server." });
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not send"));
    } finally {
      setBusy("");
    }
  };

  const on = NOTIFY_KINDS.filter((k) => settings[`notify${k.key}` as keyof SiteSettings]).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Alerts in your Discord channel — each with who it is about and a link straight to it."
        actions={<SaveButton saving={saving} disabled={loading || !dirty} onClick={() => void save(KEYS)} />}
      />

      {loading ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <SettingsCard title="What to tell you about" description={`${on} of ${NOTIFY_KINDS.length} on.`}>
            <div className="divide-y rounded-lg border">
              {NOTIFY_KINDS.map((k) => {
                const key = `notify${k.key}` as keyof SiteSettings;
                const isOn = Boolean(settings[key]);
                return (
                  <label key={k.key} className={cn("flex cursor-pointer items-start gap-3 p-3", !isOn && "bg-slate-50/70")}>
                    <span className="text-lg leading-none">{k.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{k.label}</span>
                      <span className="block text-xs text-muted-foreground">{k.hint}</span>
                    </span>
                    <Switch checked={isOn} onCheckedChange={(v) => set(key, v as never)} />
                  </label>
                );
              })}
            </div>
          </SettingsCard>

          <div className="space-y-6">
            <SettingsCard title="Check it works">
              <p className="text-sm text-muted-foreground">Sends a message to the channel now, whatever the switches say.</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void run("test")} disabled={!!busy}>
                  {busy === "test" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />} Send a test message
                </Button>
                <Button variant="outline" onClick={() => void run("digest")} disabled={!!busy}>
                  {busy === "digest" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <BarChart3 className="mr-1.5 h-4 w-4" />} Send today&apos;s report now
                </Button>
              </div>
            </SettingsCard>

            <SettingsCard title="What every alert carries">
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                <li>The person: name, agency, phone, a WhatsApp link, email, city and plan — not just an id.</li>
                <li>Links: Review, Edit, Open on the site, their profile, all their listings, their account.</li>
                <li>The listing&apos;s photo, price, place, size and photos count; why it was held.</li>
                <li>Server errors once per 30 minutes per error, and a locked account once per lock — no floods.</li>
              </ul>
            </SettingsCard>
          </div>
        </div>
      )}
    </div>
  );
}

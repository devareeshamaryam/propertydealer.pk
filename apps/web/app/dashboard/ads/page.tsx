"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ClipboardPaste, ExternalLink, Gauge, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/dashboard";
import { SaveButton, SettingsCard, useSettingsForm } from "@/components/dashboard/settings-form";
import { useAuth } from "@/context/auth-context";
import { adLayout, adsTxtLine, type AdItem } from "@/lib/ads";
import { AdLayoutEditor } from "@/components/dashboard/ad-layout-editor";
import type { SiteSettings } from "@/lib/site-settings";

/**
 * Settings → Ads: Google AdSense.
 *
 * The publisher id and the ad unit are entered here (or pasted as AdSense's
 * own ad code), and every placement — homepage, results pages, listing
 * pages, society guides, blog posts — is switched on or off here, each
 * optionally with an ad unit of its own. Nothing about ads is in the code.
 */

const KEYS = ["adsEnabled", "adsClient", "adsSlot", "adsArchiveEvery", "adsLayout"] as (keyof SiteSettings)[];

/** The publisher id and ad unit from AdSense's ad code (or from bare text). */
function parseAdCode(code: string): { client?: string; slot?: string } {
  const client = /ca-pub-\d{10,20}/.exec(code)?.[0];
  const slot = /data-ad-slot\s*=\s*["']?(\d{5,20})/.exec(code)?.[1];
  return { client, slot };
}

export default function AdsSettingsPage() {
  const { user } = useAuth();
  const { settings, set, loading, saving, dirty, save } = useSettingsForm();
  const [code, setCode] = useState("");

  // The saved layout — or, until one is saved, the older on/off placements.
  const items = useMemo(() => adLayout(settings), [settings]);
  const setItems = (next: AdItem[]) => set("adsLayout", JSON.stringify(next));

  if (user && user.role !== "ADMIN") {
    return <p className="p-6 text-sm text-muted-foreground">Only admins can change ads.</p>;
  }

  const ready = !!settings.adsClient && !!settings.adsSlot;

  const fillFromCode = () => {
    const { client, slot } = parseAdCode(code);
    if (!client && !slot) {
      toast.error("No publisher id or ad slot found in that code");
      return;
    }
    if (client) set("adsClient", client);
    if (slot) set("adsSlot", slot);
    setCode("");
    toast.success(`Filled in ${[client && "the publisher id", slot && "the ad slot"].filter(Boolean).join(" and ")}`, { description: "Save to put it live." });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ads"
        description="Google AdSense — your ad unit, and where ads show on each page."
        actions={<SaveButton saving={saving} disabled={loading || !dirty} onClick={() => void save(KEYS)} />}
      />

      {loading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-2">
            <SettingsCard title="Google AdSense" description="Paste the ad code from AdSense, or type the two numbers in.">
              <label className="flex items-center justify-between gap-4 rounded-lg border p-3">
                <span>
                  <span className="block text-sm font-semibold">Show ads on the site</span>
                  <span className="block text-xs text-muted-foreground">Off: no ads anywhere and AdSense&apos;s script is never loaded.</span>
                </span>
                <Switch checked={settings.adsEnabled} onCheckedChange={(v) => set("adsEnabled", v)} />
              </label>

              <div className="space-y-1.5">
                <Label htmlFor="ad-code">Paste the ad code (optional)</Label>
                <Textarea
                  id="ad-code"
                  rows={4}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={'<script async src="https://pagead2.googlesyndication.com/…?client=ca-pub-…"></script>\n<ins class="adsbygoogle" … data-ad-slot="…"></ins>'}
                  className="font-mono text-xs"
                />
                <Button type="button" variant="outline" size="sm" onClick={fillFromCode} disabled={!code.trim()}>
                  <ClipboardPaste className="mr-1.5 h-4 w-4" /> Fill in from the code
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="ad-client">Publisher id</Label>
                  <Input id="ad-client" value={settings.adsClient} placeholder="ca-pub-0000000000000000" onChange={(e) => set("adsClient", e.target.value.trim())} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ad-slot">Ad slot (ad unit)</Label>
                  <Input id="ad-slot" inputMode="numeric" value={settings.adsSlot} placeholder="1234567890" onChange={(e) => set("adsSlot", e.target.value.replace(/\D/g, ""))} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Every placement uses this responsive ad unit unless you give it one of its own below.</p>

              {settings.adsClient && (
                <div className="rounded-lg bg-slate-50 p-3 text-xs">
                  <p className="flex items-center gap-1.5 font-semibold text-slate-700">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> ads.txt is written for you
                  </p>
                  <p className="mt-1 font-mono text-slate-600">{adsTxtLine(settings.adsClient)}</p>
                  <a href="/ads.txt" target="_blank" rel="noopener" className="mt-1 inline-flex items-center gap-1 font-semibold text-primary">
                    Open /ads.txt <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </SettingsCard>

            <SettingsCard title="Speed" description="How ads are kept from slowing the site.">
              <ul className="space-y-2 text-sm text-slate-600">
                {[
                  "AdSense's script loads only after the page has finished loading — never before your content.",
                  "Each ad loads when the visitor scrolls near it, not all at once.",
                  "Its space is kept ready, so the page does not jump when the ad appears.",
                  "If Google has no ad to show, the space folds away.",
                  "No ads in the dashboard.",
                ].map((t) => (
                  <li key={t} className="flex gap-2">
                    <Gauge className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {t}
                  </li>
                ))}
              </ul>
            </SettingsCard>
          </div>

          <SettingsCard
            title="Where ads show"
            description={`${items.length} ads placed. Each page is drawn with its real sections — drag an ad into any gap, move it, or click it to change its shape and ad unit.`}
          >
            {!ready && (
              <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
                <Info className="mt-0.5 h-4 w-4 shrink-0" /> Add the publisher id and ad slot first — until then no ad shows.
              </p>
            )}
            <AdLayoutEditor
              items={items}
              onChange={setItems}
              show={settings as unknown as Record<string, boolean>}
              defaultSlot={settings.adsSlot}
              every={settings.adsArchiveEvery}
              onEvery={(n) => set("adsArchiveEvery", n)}
            />
          </SettingsCard>
        </div>
      )}
    </div>
  );
}

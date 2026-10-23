"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { toast } from "sonner";
import { Building2, ExternalLink, Globe, Loader2, MapPin, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, apiErrorMessage } from "@/components/dashboard";
import { SaveButton, SettingsCard } from "@/components/dashboard/settings-form";
import api from "@/lib/api";
import { DEALERS_HUB, dealersCityPath, hasDealers, type DealerCity, type DealerPageText, type DealerSettings } from "@/lib/dealers";
import { cn } from "@/lib/utils";

const RichEditor = dynamic(() => import("@/components/RichEditor"), {
  ssr: false,
  loading: () => <div className="h-[220px] w-full animate-pulse rounded-lg bg-slate-100" />,
});

/*
 * Property dealers pages: /property-dealers and /property-dealers-in-<city>.
 * Each city's SEO title, description, heading, intro, text and questions;
 * the text every city uses until it has its own; and the all-cities page.
 * Agents and agencies place themselves by choosing their city on sign-up.
 */

type Target = { kind: "city"; city: DealerCity } | { kind: "hub" } | { kind: "defaults" };

export default function PropertyDealersAdminPage() {
  const [cities, setCities] = useState<DealerCity[] | null>(null);
  const [settings, setSettings] = useState<DealerSettings | null>(null);
  const [q, setQ] = useState("");
  const [target, setTarget] = useState<Target | null>(null);
  const [form, setForm] = useState<DealerPageText>({});
  const [loadingPage, setLoadingPage] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void Promise.all([api.get<DealerCity[]>("/dealers/cities"), api.get<DealerSettings>("/dealers/settings")])
      .then(([c, s]) => {
        setCities(c.data ?? []);
        setSettings({ hub: s.data?.hub ?? {}, cityDefaults: s.data?.cityDefaults ?? {} });
      })
      .catch((err) => {
        setCities([]);
        toast.error("Could not load the dealers pages", { description: apiErrorMessage(err, "Please try again.") });
      });
  }, []);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (cities ?? [])
      .filter((c) => !term || c.name.toLowerCase().includes(term))
      .sort((a, b) => b.agencies + b.agents - (a.agencies + a.agents) || a.name.localeCompare(b.name));
  }, [cities, q]);

  const open = async (t: Target) => {
    setTarget(t);
    if (t.kind === "hub") return setForm(settings?.hub ?? {});
    if (t.kind === "defaults") return setForm(settings?.cityDefaults ?? {});
    setLoadingPage(true);
    setForm({});
    try {
      const res = await api.get<{ page: DealerPageText }>(`/dealers/admin/city/${t.city._id}`);
      setForm(res.data?.page ?? {});
    } catch (err) {
      toast.error("Could not load this city's page", { description: apiErrorMessage(err, "Please try again.") });
    } finally {
      setLoadingPage(false);
    }
  };

  // Bring the editor into view once it is on screen.
  useEffect(() => {
    if (!target || loadingPage) return;
    const id = setTimeout(() => document.getElementById("dealer-page-editor")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    return () => clearTimeout(id);
  }, [target, loadingPage]);

  const save = async () => {
    if (!target) return;
    setSaving(true);
    try {
      if (target.kind === "city") {
        const res = await api.put<DealerPageText>(`/dealers/admin/city/${target.city._id}`, form);
        setForm(res.data ?? {});
      } else {
        const body = target.kind === "hub" ? { hub: form } : { cityDefaults: form };
        const res = await api.put<DealerSettings>("/dealers/settings", body);
        setSettings(res.data);
      }
      toast.success("Saved", { description: "The page shows it within a few minutes." });
    } catch (err) {
      toast.error("Could not save", { description: apiErrorMessage(err, "Please try again.") });
    } finally {
      setSaving(false);
    }
  };

  const set = <K extends keyof DealerPageText>(k: K, v: DealerPageText[K]) => setForm((f) => ({ ...f, [k]: v }));
  const faqs = form.faqs ?? [];
  const viewHref = target?.kind === "city" ? dealersCityPath(target.city.slug) : DEALERS_HUB;
  const isDefaults = target?.kind === "defaults";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <PageHeader
        title="Property Dealers Pages"
        description="A city gets its page (/property-dealers-in-lahore) as soon as its first agent or agency joins — you can write its text before that. Agents choose their city when they sign up; their plan decides their place."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/dashboard/city/add-city">
                <Plus className="mr-1.5 h-4 w-4" /> Add a city
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={DEALERS_HUB} target="_blank">
                <ExternalLink className="mr-1.5 h-4 w-4" /> View
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => void open({ kind: "hub" })}
          className={cn("rounded-xl border bg-white p-4 text-left transition-colors hover:border-primary", target?.kind === "hub" && "border-primary ring-1 ring-primary")}
        >
          <span className="flex items-center gap-2 font-semibold"><Globe className="h-4 w-4 text-primary" /> All-cities page</span>
          <span className="mt-1 block text-sm text-muted-foreground">SEO and text of /property-dealers.</span>
        </button>
        <button
          type="button"
          onClick={() => void open({ kind: "defaults" })}
          className={cn("rounded-xl border bg-white p-4 text-left transition-colors hover:border-primary", target?.kind === "defaults" && "border-primary ring-1 ring-primary")}
        >
          <span className="flex items-center gap-2 font-semibold"><Pencil className="h-4 w-4 text-primary" /> Default text for every city</span>
          <span className="mt-1 block text-sm text-muted-foreground">Used by any city without its own — {"{city}"} and {"{count}"} are filled in.</span>
        </button>
      </div>

      <SettingsCard title="Cities" description="Choose a city to write its own SEO title, description, heading, text and questions.">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search cities" className="pl-9" />
        </div>
        {cities === null ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No cities. Add one first.</p>
        ) : (
          <ul className="max-h-[420px] divide-y overflow-y-auto rounded-lg border">
            {shown.map((c) => {
              const on = target?.kind === "city" && target.city._id === c._id;
              return (
                <li key={c._id} className={cn("flex items-center gap-3 px-3 py-2.5", on && "bg-primary/5")}>
                  <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{c.name}</span>
                    <span className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" /> {c.agencies} agencies</span>
                      <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {c.agents} agents</span>
                      {!hasDealers(c) && <span className="text-amber-700">No page yet — it goes live when the first dealer joins</span>}
                    </span>
                  </span>
                  <Button size="sm" variant={on ? "default" : "outline"} onClick={() => void open({ kind: "city", city: c })}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit page
                  </Button>
                  {hasDealers(c) ? (
                    <Button size="sm" variant="ghost" asChild>
                      <Link href={dealersCityPath(c.slug)} target="_blank" aria-label={`View ${c.name}`}>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  ) : (
                    <span className="w-9 text-center text-[11px] leading-tight text-muted-foreground" title="The page appears when the first agent or agency joins this city">No page</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </SettingsCard>

      {target && (
        <div id="dealer-page-editor" className="scroll-mt-20">
          <SettingsCard
            title={target.kind === "city" ? `Property dealers in ${target.city.name}` : target.kind === "hub" ? "All-cities page" : "Default text for every city"}
            description={
              isDefaults
                ? "Write {city} for the city's name and {count} for its number of dealers. Empty fields use the site's built-in text."
                : "Leave a field empty to use the default text."
            }
          >
            {loadingPage ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : (
              <div className="space-y-5">
                <Field label="SEO title" count={form.metaTitle?.length ?? 0} max={70}>
                  <Input value={form.metaTitle ?? ""} onChange={(e) => set("metaTitle", e.target.value)} maxLength={90} placeholder={isDefaults ? "{count} Property Dealers in {city} — Real Estate Agents" : ""} />
                </Field>
                <Field label="Meta description" count={form.metaDescription?.length ?? 0} max={160}>
                  <Textarea value={form.metaDescription ?? ""} onChange={(e) => set("metaDescription", e.target.value)} maxLength={250} rows={2} />
                </Field>
                <Field label="Heading (H1)">
                  <Input value={form.heading ?? ""} onChange={(e) => set("heading", e.target.value)} maxLength={120} placeholder={isDefaults ? "Property Dealers in {city}" : ""} />
                </Field>
                <Field label="Intro — under the heading">
                  <Textarea value={form.intro ?? ""} onChange={(e) => set("intro", e.target.value)} maxLength={700} rows={3} />
                </Field>
                <Field label="Text — below the list">
                  <RichEditor value={form.content ?? ""} onChange={(html: string) => set("content", html)} minHeight="min-h-[220px]" />
                </Field>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Questions &amp; answers</Label>
                    <Button type="button" size="sm" variant="outline" onClick={() => set("faqs", [...faqs, { q: "", a: "" }])} disabled={faqs.length >= 15}>
                      <Plus className="mr-1.5 h-3.5 w-3.5" /> Add question
                    </Button>
                  </div>
                  {faqs.length === 0 && <p className="text-sm text-muted-foreground">None yet. Questions are shown at the bottom and in Google results (FAQ).</p>}
                  {faqs.map((f, i) => (
                    <div key={i} className="space-y-2 rounded-lg border p-3">
                      <div className="flex gap-2">
                        <Input
                          value={f.q}
                          placeholder="Question"
                          onChange={(e) => set("faqs", faqs.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))}
                        />
                        <Button type="button" size="icon" variant="ghost" aria-label="Remove question" onClick={() => set("faqs", faqs.filter((_, j) => j !== i))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <Textarea
                        value={f.a}
                        placeholder="Answer"
                        rows={2}
                        onChange={(e) => set("faqs", faqs.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))}
                      />
                    </div>
                  ))}
                </div>

                {!isDefaults && (
                  <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <span>
                      <span className="block text-sm font-medium">Hide from Google (noindex)</span>
                      <span className="block text-xs text-muted-foreground">A city with no dealers has no page at all — it appears when the first one joins.</span>
                    </span>
                    <Switch checked={!!form.noindex} onCheckedChange={(v) => set("noindex", v)} />
                  </label>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <SaveButton onClick={() => void save()} saving={saving} />
                  {!isDefaults && (target?.kind !== "city" || hasDealers(target.city)) && (
                    <Button variant="outline" asChild>
                      <Link href={viewHref} target="_blank">
                        <ExternalLink className="mr-1.5 h-4 w-4" /> View page
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            )}
          </SettingsCard>
        </div>
      )}
    </div>
  );
}

function Field({ label, count, max, children }: { label: string; count?: number; max?: number; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {max !== undefined && <span className={cn("text-xs tabular-nums", (count ?? 0) > max ? "text-amber-700" : "text-muted-foreground")}>{count}/{max}</span>}
      </div>
      {children}
    </div>
  );
}

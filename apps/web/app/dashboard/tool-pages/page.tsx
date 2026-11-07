"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { toast } from "sonner";
import { CheckCircle2, ExternalLink, FileText, Loader2, Pencil, Plus, RotateCcw, SlidersHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ImageField } from "@/components/media";
import { PageHeader, apiErrorMessage } from "@/components/dashboard";
import { SaveButton, SettingsCard } from "@/components/dashboard/settings-form";
import ToolSettings, { TOOLS_WITH_SETTINGS, type SettingsTool } from "@/components/dashboard/tool-settings";
import ToolArt from "@/components/tools/ToolArt";
import { useAuth } from "@/context/auth-context";
import api from "@/lib/api";
import { fillYear, TOOL_PAGE_DEFAULTS, type ToolPageText } from "@/lib/tool-pages";
import { TOOLS, toolBySlug } from "@/lib/tools";
import { cn } from "@/lib/utils";

const RichEditor = dynamic(() => import("@/components/RichEditor"), {
  ssr: false,
  loading: () => <div className="h-[320px] w-full animate-pulse rounded-lg bg-slate-100" />,
});

/*
 * Tools & calculators: everything about one tool in one place.
 *  - Calculator settings (construction, bricks, cement): rates, cities and the
 *    standards behind the figures — components/dashboard/tool-settings.tsx.
 *  - Page & SEO: title, description, keywords, sharing picture, noindex, the
 *    heading and intro, rich text under the tool and extra questions. Empty
 *    fields keep the page's built-in text.
 * Open a tool directly with ?page=<slug>&tab=settings|page.
 */

type Tab = "settings" | "page";
const hasSettings = (slug: string | null): slug is SettingsTool => !!slug && (TOOLS_WITH_SETTINGS as string[]).includes(slug);

const SITE = (process.env.NEXT_PUBLIC_BASE_URL || "https://propertydealer.pk").replace(/\/$/, "");
/** The tools page first, then every tool in the site's order. */
const SLUGS = ["index", ...TOOLS.map((t) => t.slug).filter((s) => TOOL_PAGE_DEFAULTS[s])];

const isCustom = (p?: ToolPageText) => !!p && Object.keys(p).some((k) => k !== "updatedAt");

export default function ToolPagesAdmin() {
  const { user } = useAuth();
  const [pages, setPages] = useState<Record<string, ToolPageText> | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("page");
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [form, setForm] = useState<ToolPageText>({});
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    api
      .get<Record<string, ToolPageText>>("/tools/pages")
      .then((r) => setPages(r.data && typeof r.data === "object" ? r.data : {}))
      .catch((err) => {
        setPages({});
        toast.error("Could not load the tool pages", { description: apiErrorMessage(err, "Please try again.") });
      });
  }, []);

  // A link straight to a tool: ?page=bricks-calculator&tab=settings
  useEffect(() => {
    if (pages === null || slug) return;
    const q = new URLSearchParams(window.location.search);
    const s = q.get("page");
    if (s && TOOL_PAGE_DEFAULTS[s]) open(s, q.get("tab") === "page" ? "page" : q.get("tab") === "settings" ? "settings" : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages]);

  const unsaved = dirty || settingsDirty;

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  /** Open a tool — on its settings when it has them, else its page. */
  const open = (s: string, want?: Tab) => {
    if (s !== slug && unsaved && !window.confirm("You have unsaved changes. Leave them?")) return;
    const t: Tab = want ?? (hasSettings(s) ? "settings" : "page");
    if (s !== slug) {
      setSlug(s);
      setForm(pages?.[s] ?? {});
      setDirty(false);
      setSettingsDirty(false);
    }
    showTab(s, t);
    setTimeout(() => document.getElementById("tool-page-editor")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const showTab = (s: string, t: Tab) => {
    const next = t === "settings" && !hasSettings(s) ? "page" : t;
    setTab(next);
    try {
      window.history.replaceState(null, "", `${window.location.pathname}?page=${s}&tab=${next}`);
    } catch {
      /* ignore */
    }
  };

  const set = <K extends keyof ToolPageText>(k: K, v: ToolPageText[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  };

  const save = async () => {
    if (!slug) return;
    setSaving(true);
    try {
      const res = await api.put<ToolPageText>(`/tools/pages/${slug}`, form);
      setPages((p) => ({ ...(p ?? {}), [slug]: res.data ?? {} }));
      setForm(res.data ?? {});
      setDirty(false);
      toast.success("Saved", { description: "The page shows it within a minute." });
    } catch (err) {
      toast.error("Could not save", { description: apiErrorMessage(err, "Please try again.") });
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!slug || !window.confirm("Remove everything written for this page and go back to its built-in text?")) return;
    setResetting(true);
    try {
      await api.delete(`/tools/pages/${slug}`);
      setPages((p) => {
        const next = { ...(p ?? {}) };
        delete next[slug];
        return next;
      });
      setForm({});
      setDirty(false);
      toast.success("Back to the built-in text");
    } catch (err) {
      toast.error("Could not reset", { description: apiErrorMessage(err, "Please try again.") });
    } finally {
      setResetting(false);
    }
  };

  const d = slug ? TOOL_PAGE_DEFAULTS[slug] : undefined;
  const faqs = form.faqs ?? [];
  // What Google shows: the admin's text, else the built-in.
  const preview = useMemo(
    () =>
      d && {
        title: fillYear(form.metaTitle || d.title),
        description: fillYear(form.metaDescription || d.description),
        url: `${SITE.replace(/^https?:\/\//, "")}${d.path}`,
      },
    [d, form.metaTitle, form.metaDescription],
  );

  if (user && user.role !== "ADMIN") {
    return <p className="p-6 text-sm text-muted-foreground">Only admins can manage the tools.</p>;
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <PageHeader
        title="Tools & Calculators"
        description="Everything about each tool in one place: its calculator settings (rates, cities, standards) and its page — SEO title and description, heading, content under the tool and questions."
      />

      <SettingsCard title="Tools" description="Choose a tool to manage.">
        {pages === null ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <ul className="divide-y rounded-lg border">
            {SLUGS.map((s) => {
              const def = TOOL_PAGE_DEFAULTS[s]!;
              const p = pages[s];
              const on = slug === s;
              return (
                <li key={s} className={cn("flex items-center gap-3 px-3 py-2.5", on && "bg-primary/5")}>
                  {s === "index" ? (
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border bg-white">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </span>
                  ) : (
                    <span className="shrink-0">
                      <ToolArt tool={toolBySlug(s)} size="sm" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{def.name}</span>
                    <span className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                      <span>{def.path}</span>
                      {isCustom(p) ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" /> Edited
                          {p?.updatedAt ? ` · ${new Date(p.updatedAt).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                        </span>
                      ) : (
                        <span>Built-in text</span>
                      )}
                      {p?.content && <span>Has content</span>}
                      {hasSettings(s) && (
                        <span className="inline-flex items-center gap-1 text-sky-700">
                          <SlidersHorizontal className="h-3 w-3" /> Calculator settings
                        </span>
                      )}
                      {p?.noindex && <span className="text-amber-700">Hidden from Google</span>}
                    </span>
                  </span>
                  <Button size="sm" variant={on ? "default" : "outline"} onClick={() => open(s)}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> Manage
                  </Button>
                  <Button size="sm" variant="ghost" asChild>
                    <Link href={def.path} target="_blank" aria-label={`View ${def.name}`}>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </SettingsCard>

      {slug && d && (
        <div id="tool-page-editor" className="scroll-mt-20 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-3">
            <div className="flex min-w-0 items-center gap-3">
              {slug !== "index" && <ToolArt tool={toolBySlug(slug)} size="sm" />}
              <div className="min-w-0">
                <p className="truncate font-semibold">{d.name}</p>
                <p className="truncate text-xs text-muted-foreground">{d.path}</p>
              </div>
            </div>
            {hasSettings(slug) && (
              <div role="tablist" className="inline-flex rounded-lg border bg-slate-50 p-1">
                {(
                  [
                    ["settings", "Calculator settings", SlidersHorizontal, settingsDirty],
                    ["page", "Page & SEO", FileText, dirty],
                  ] as const
                ).map(([t, label, Icon, changed]) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={tab === t}
                    onClick={() => showTab(slug, t)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                      tab === t ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" /> {label}
                    {changed && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-label="Unsaved changes" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {hasSettings(slug) && (
            <div className={cn(tab !== "settings" && "hidden")}>
              <ToolSettings key={slug} tool={slug} onDirty={setSettingsDirty} />
            </div>
          )}

          <div className={cn("space-y-5", tab !== "page" && "hidden")}>
          <SettingsCard title={`SEO — ${d.name}`} description="What Google and social media show. Leave empty to keep the built-in text (shown faintly). Write {year} for the current year.">
            <div className="space-y-5">
              {preview && (
                <div className="rounded-lg border bg-white p-4">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Google preview</p>
                  <p className="truncate text-[13px] text-[#202124]">{preview.url}</p>
                  <p className="line-clamp-1 text-[19px] leading-snug text-[#1a0dab]">{preview.title}</p>
                  <p className="line-clamp-2 text-[14px] leading-snug text-[#4d5156]">{preview.description}</p>
                </div>
              )}
              <Field label="SEO title" count={(form.metaTitle || "").length} max={60}>
                <Input value={form.metaTitle ?? ""} onChange={(e) => set("metaTitle", e.target.value)} maxLength={90} placeholder={d.title} />
              </Field>
              <Field label="Meta description" count={(form.metaDescription || "").length} max={160}>
                <Textarea value={form.metaDescription ?? ""} onChange={(e) => set("metaDescription", e.target.value)} maxLength={250} rows={3} placeholder={d.description} />
              </Field>
              <Field label="Keywords" hint="Separate with commas.">
                <Textarea value={form.keywords ?? ""} onChange={(e) => set("keywords", e.target.value)} maxLength={600} rows={2} placeholder={d.keywords.join(", ") || "e.g. home loan calculator pakistan, monthly instalment"} />
              </Field>
              <ImageField
                label="Sharing picture (Facebook, WhatsApp, X)"
                value={form.ogImage ?? ""}
                onChange={(url: string) => set("ogImage", url)}
                folder="tools"
                context={d.name}
                aspect="wide"
                hint="Optional. 1200 × 630 works best."
              />
              <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <span>
                  <span className="block text-sm font-medium">Hide from Google (noindex)</span>
                  <span className="block text-xs text-muted-foreground">The page still works for visitors; search engines are asked not to list it.</span>
                </span>
                <Switch checked={!!form.noindex} onCheckedChange={(v) => set("noindex", v)} />
              </label>
            </div>
          </SettingsCard>

          <SettingsCard title="On the page" description="The heading and the line under it, at the top of the page.">
            <div className="space-y-5">
              <Field label="Heading (H1)">
                <Input value={form.heading ?? ""} onChange={(e) => set("heading", e.target.value)} maxLength={140} placeholder={d.heading} />
              </Field>
              <Field label="Intro — under the heading" count={(form.intro || "").length} max={300}>
                <Textarea value={form.intro ?? ""} onChange={(e) => set("intro", e.target.value)} maxLength={700} rows={3} placeholder={d.intro} />
              </Field>
            </div>
          </SettingsCard>

          <SettingsCard
            title="Content under the tool"
            description="Shown in a box right below the calculator — a guide, tips, tables, pictures and links. Good, original text here helps the page rank."
          >
            <div className="space-y-5">
              <Field label="Content title (optional)">
                <Input value={form.contentTitle ?? ""} onChange={(e) => set("contentTitle", e.target.value)} maxLength={140} placeholder={`e.g. How to use the ${d.name.toLowerCase()}`} />
              </Field>
              <Field label="Content">
                <RichEditor value={form.content ?? ""} onChange={(html: string) => set("content", html)} minHeight="min-h-[320px]" placeholder="Write the content shown under the tool…" />
              </Field>
            </div>
          </SettingsCard>

          <SettingsCard title="Questions & answers" description="Added to the page's own questions, and shown in Google results (FAQ).">
            <div className="space-y-3">
              {faqs.length === 0 && <p className="text-sm text-muted-foreground">None added yet.</p>}
              {faqs.map((f, i) => (
                <div key={i} className="space-y-2 rounded-lg border p-3">
                  <div className="flex gap-2">
                    <Input value={f.q} placeholder="Question" maxLength={200} onChange={(e) => set("faqs", faqs.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} />
                    <Button type="button" size="icon" variant="ghost" aria-label="Remove question" onClick={() => set("faqs", faqs.filter((_, j) => j !== i))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Textarea value={f.a} placeholder="Answer" rows={3} maxLength={1500} onChange={(e) => set("faqs", faqs.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} />
                </div>
              ))}
              <Button type="button" size="sm" variant="outline" onClick={() => set("faqs", [...faqs, { q: "", a: "" }])} disabled={faqs.length >= 20}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add question
              </Button>
            </div>
          </SettingsCard>

          <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center gap-3 rounded-xl border bg-white/95 p-3 shadow-sm backdrop-blur">
            <SaveButton onClick={() => void save()} saving={saving} />
            <Button variant="outline" asChild>
              <Link href={d.path} target="_blank">
                <ExternalLink className="mr-1.5 h-4 w-4" /> View page
              </Link>
            </Button>
            {isCustom(pages?.[slug]) && (
              <Button variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => void reset()} disabled={resetting}>
                {resetting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-1.5 h-4 w-4" />} Reset to built-in
              </Button>
            )}
            {dirty && <span className="text-sm text-amber-700">Unsaved changes</span>}
          </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, count, max, hint, children }: { label: string; count?: number; max?: number; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <Label>{label}</Label>
        {max !== undefined && <span className={cn("text-xs tabular-nums", (count ?? 0) > max ? "text-amber-700" : "text-muted-foreground")}>{count}/{max}</span>}
      </div>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

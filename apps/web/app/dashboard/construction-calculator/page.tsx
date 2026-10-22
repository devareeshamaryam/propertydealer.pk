"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CheckCircle2, ExternalLink, Plus, RotateCcw, Search, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { PageHeader, apiErrorMessage } from "@/components/dashboard";
import { SaveButton, SettingsCard } from "@/components/dashboard/settings-form";
import { useAuth } from "@/context/auth-context";
import api from "@/lib/api";
import { GREY_WORK_LABEL, MATERIAL_LABEL, QUALITY, rupees, type GreyWork, type Material, type Quality } from "@/lib/tools";

/**
 * Dashboard → Construction calculator.
 *
 * Everything runs on its own: material prices from the shop's live products,
 * every city's factor from its own prices / typical levels / province, and
 * finishing that follows material prices. A box left empty stays automatic;
 * type a number only to fix it.
 */

const MATERIALS: Material[] = ["cement", "steel", "bricks", "sand", "crush"];
const GREY: GreyWork[] = ["excavation", "shuttering", "waterproofing", "plumbing", "electrical"];
const UNIT: Record<Material, string> = { cement: "bag", steel: "kg", bricks: "brick", sand: "cft", crush: "cft" };
const CITY_SOURCE: Record<string, string> = {
  office: "Set by you",
  market: "From its own material prices",
  typical: "Typical for this city",
  province: "From its province",
  default: "Country average",
};

interface Config {
  qty: Record<Material, number>;
  rates: Record<Material, number>;
  fallback: Record<Material, number>;
  greyWorks: Record<GreyWork, number>;
  labour: { grey: number; finishing: number };
  finishing: Record<Quality, number>;
  finishSplit: { key: string; label: string; pct: number; shop?: string }[];
  bathroom: Record<Quality, number>;
  kitchen: Record<Quality, number>;
  contractorPct: number;
  basementFactor: number;
  cities: { name: string; factor: number }[];
  autoIndex: boolean;
  updatedAt?: string;
}
interface ShopRate {
  low: number;
  mid: number;
  high: number;
  count: number;
}
interface AutoCity {
  name: string;
  factor: number;
  source: string;
  ownRates: number;
}
interface AdminData {
  config: Config;
  defaults: Config;
  shop: Record<Material, ShopRate | null>;
  auto: { index: number; basket: number; baseBasket: number; cities: AutoCity[] };
}

/** A number box; empty means "automatic" when `auto` is given. */
function Num({
  value,
  onChange,
  auto,
  step = "any",
  className = "h-10 tabular-nums",
}: {
  value: number;
  onChange: (n: number) => void;
  auto?: string;
  step?: string;
  className?: string;
}) {
  return (
    <Input
      type="number"
      inputMode="decimal"
      min={0}
      step={step}
      value={auto !== undefined && !value ? "" : Number.isFinite(value) ? value : 0}
      placeholder={auto}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      className={className}
    />
  );
}

export default function ConstructionCalculatorSettings() {
  const { user } = useAuth();
  const [data, setData] = useState<AdminData | null>(null);
  const [form, setForm] = useState<Config | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [cityQuery, setCityQuery] = useState("");

  const load = (d: AdminData) => {
    setData(d);
    setForm(d.config);
    setDirty(false);
  };

  useEffect(() => {
    api
      .get<AdminData>("/tools/construction/admin")
      .then(({ data }) => load(data))
      .catch((e) => toast.error(apiErrorMessage(e, "Could not load the calculator settings")));
  }, []);

  const cities = useMemo(() => {
    const q = cityQuery.trim().toLowerCase();
    return (data?.auto.cities ?? []).filter((c) => !q || c.name.toLowerCase().includes(q));
  }, [data, cityQuery]);

  if (user && user.role !== "ADMIN") {
    return <p className="p-6 text-sm text-muted-foreground">Only admins can change the calculator.</p>;
  }

  const patch = (fn: (c: Config) => void) => {
    setForm((c) => {
      if (!c) return c;
      const next = structuredClone(c);
      fn(next);
      return next;
    });
    setDirty(true);
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const { data: next } = await api.put<AdminData>("/tools/construction/admin", form);
      load(next);
      toast.success("Saved — the calculator uses it within 5 minutes");
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not save"));
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!confirm("Put every number back to automatic / default?")) return;
    setSaving(true);
    try {
      const { data: next } = await api.delete<AdminData>("/tools/construction/admin");
      load(next);
      toast.success("Back to automatic");
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not reset"));
    } finally {
      setSaving(false);
    }
  };

  const cityOverride = (name: string) => form?.cities.find((c) => c.name.toLowerCase() === name.toLowerCase())?.factor ?? 0;
  const setCityOverride = (name: string, factor: number) =>
    patch((c) => {
      c.cities = c.cities.filter((x) => x.name.toLowerCase() !== name.toLowerCase());
      if (factor > 0) c.cities.push({ name, factor });
    });

  const splitTotal = form?.finishSplit.reduce((s, x) => s + (Number(x.pct) || 0), 0) ?? 0;
  const pctMove = data ? Math.round((data.auto.index - 1) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Construction calculator"
        description="Runs on its own from your shop's live rates. Change a number only when you want to fix it."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/tools/construction-cost-calculator" target="_blank">
                <ExternalLink className="mr-2 h-4 w-4" /> Open calculator
              </Link>
            </Button>
            <SaveButton saving={saving} disabled={!form || !dirty} onClick={() => void save()} />
          </div>
        }
      />

      {!form || !data ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          {/* What runs on its own */}
          <div className="grid gap-3 md:grid-cols-3">
            {[
              {
                title: "Material prices",
                text: `${MATERIALS.filter((m) => !form.rates[m] && data.shop[m]).length} of 5 from the shop's live rates`,
              },
              {
                title: `${data.auto.cities.length} cities`,
                text: "Each city's cost level worked out on its own",
              },
              {
                title: form.autoIndex ? `Market index ${data.auto.index.toFixed(2)}` : "Market index off",
                text: form.autoIndex
                  ? pctMove === 0
                    ? "Finishing and other works are at today's prices"
                    : `Material prices ${pctMove > 0 ? "up" : "down"} ${Math.abs(pctMove)}% — finishing and other works follow`
                  : "Finishing and other works stay as typed",
              },
            ].map((x) => (
              <div key={x.title} className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <div>
                  <p className="text-sm font-semibold">{x.title}</p>
                  <p className="text-xs text-muted-foreground">{x.text}</p>
                </div>
              </div>
            ))}
          </div>

          <SettingsCard title="Material rates" description="Empty = today's live shop rate. Type a rate only to fix it.">
            <div className="-mx-1 overflow-x-auto px-1">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3 font-semibold">Material</th>
                    <th className="py-2 pr-3 font-semibold">Live today</th>
                    <th className="py-2 font-semibold">Fix the rate (Rs)</th>
                  </tr>
                </thead>
                <tbody>
                  {MATERIALS.map((m) => {
                    const s = data.shop[m];
                    return (
                      <tr key={m} className="border-b last:border-0">
                        <td className="py-2.5 pr-3 font-medium">
                          {MATERIAL_LABEL[m]}
                          <span className="block text-xs text-muted-foreground">per {UNIT[m]}</span>
                        </td>
                        <td className="py-2.5 pr-3 tabular-nums">
                          {s ? (
                            <>
                              {rupees(s.mid)}
                              <span className="block text-xs text-muted-foreground">
                                {rupees(s.low)} – {rupees(s.high)} · {s.count} products
                              </span>
                            </>
                          ) : (
                            <span className="text-xs text-amber-700">No products yet — using {rupees(form.fallback[m])}</span>
                          )}
                        </td>
                        <td className="py-2.5">
                          <Num value={form.rates[m]} auto="Automatic" onChange={(n) => patch((c) => void (c.rates[m] = n))} className="h-10 w-36 tabular-nums" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SettingsCard>

          <SettingsCard title="Cities" description="Labour, other works and finishing are multiplied by the city's factor (1 = Lahore). Empty = automatic.">
            <div className="relative max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={cityQuery} onChange={(e) => setCityQuery(e.target.value)} placeholder="Find a city" className="h-10 pl-9" />
            </div>
            <div className="max-h-[420px] overflow-y-auto rounded-lg border">
              <table className="w-full text-sm">
                <tbody>
                  {cities.map((c) => (
                    <tr key={c.name} className="border-b last:border-0">
                      <td className="px-3 py-2 font-medium">
                        {c.name}
                        <span className="block text-xs font-normal text-muted-foreground">
                          {CITY_SOURCE[c.source] ?? c.source}
                          {c.ownRates > 0 && ` · ${c.ownRates} own material prices`}
                        </span>
                      </td>
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">× {c.factor}</td>
                      <td className="w-32 px-3 py-2">
                        <Num value={cityOverride(c.name)} auto="Auto" step="0.01" onChange={(n) => setCityOverride(c.name, n)} className="h-9 w-28 tabular-nums" />
                      </td>
                    </tr>
                  ))}
                  {cities.length === 0 && (
                    <tr>
                      <td className="px-3 py-6 text-center text-muted-foreground">No city matches.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </SettingsCard>

          <SettingsCard title="Follow the market" description="When material prices rise or fall, finishing, other works, bathrooms and kitchens move with them. Typing new figures below starts it again from today.">
            <label className="flex items-center gap-3 text-sm font-medium">
              <Switch checked={form.autoIndex} onCheckedChange={(v) => patch((c) => void (c.autoIndex = v))} />
              Keep figures in step with material prices
            </label>
          </SettingsCard>

          <details className="group rounded-xl border bg-card">
            <summary className="cursor-pointer list-none p-5 text-sm font-semibold">
              Advanced — quantities and per-square-foot figures
              <span className="block text-xs font-normal text-muted-foreground">Set from market research; change only if your contractors quote differently.</span>
            </summary>
            <div className="space-y-6 border-t p-5">
              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Material per sq ft of covered area</h3>
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {MATERIALS.map((m) => (
                    <label key={m} className="space-y-1.5 text-xs font-medium text-muted-foreground">
                      {MATERIAL_LABEL[m]} ({UNIT[m]})
                      <Num value={form.qty[m]} step="0.01" onChange={(n) => patch((c) => void (c.qty[m] = n))} />
                    </label>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Other grey works and labour (Rs per sq ft)</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {GREY.map((w) => (
                    <label key={w} className="space-y-1.5 text-xs font-medium text-muted-foreground">
                      {GREY_WORK_LABEL[w]}
                      <Num value={form.greyWorks[w]} onChange={(n) => patch((c) => void (c.greyWorks[w] = n))} />
                    </label>
                  ))}
                  <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
                    Grey structure labour
                    <Num value={form.labour.grey} onChange={(n) => patch((c) => void (c.labour.grey = n))} />
                  </label>
                  <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
                    Finishing labour
                    <Num value={form.labour.finishing} onChange={(n) => patch((c) => void (c.labour.finishing = n))} />
                  </label>
                  <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
                    Contractor margin (%)
                    <Num value={form.contractorPct} onChange={(n) => patch((c) => void (c.contractorPct = n))} />
                  </label>
                  <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
                    Basement multiplier
                    <Num value={form.basementFactor} step="0.05" onChange={(n) => patch((c) => void (c.basementFactor = n))} />
                  </label>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold">By quality</h3>
                <div className="-mx-1 overflow-x-auto px-1">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="py-1.5 pr-3 font-medium" />
                        {QUALITY.map((q) => (
                          <th key={q.key} className="py-1.5 pr-3 font-semibold">
                            {q.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        [
                          ["finishing", "Finishing per sq ft"],
                          ["bathroom", "One bathroom"],
                          ["kitchen", "One kitchen"],
                        ] as const
                      ).map(([k, label]) => (
                        <tr key={k}>
                          <td className="py-1.5 pr-3 text-xs font-medium">{label}</td>
                          {QUALITY.map((q) => (
                            <td key={q.key} className="py-1.5 pr-3">
                              <Num value={form[k][q.key]} onChange={(n) => patch((c) => void (c[k][q.key] = n))} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold">How finishing money is spent</h3>
                {form.finishSplit.map((x, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input value={x.label} onChange={(e) => patch((c) => void (c.finishSplit[i]!.label = e.target.value))} className="h-10" aria-label="Item" />
                    <div className="relative w-24 shrink-0">
                      <Num value={x.pct} onChange={(n) => patch((c) => void (c.finishSplit[i]!.pct = n))} className="h-10 pr-7 tabular-nums" />
                      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => patch((c) => void c.finishSplit.splice(i, 1))} aria-label="Remove">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex items-center justify-between">
                  <Button variant="outline" size="sm" onClick={() => patch((c) => void c.finishSplit.push({ key: `item${c.finishSplit.length + 1}`, label: "", pct: 0 }))}>
                    <Plus className="mr-1 h-4 w-4" /> Add item
                  </Button>
                  <span className={splitTotal === 100 ? "text-xs text-muted-foreground" : "text-xs font-semibold text-amber-700"}>
                    Total {splitTotal}%{splitTotal !== 100 && " — scaled to 100% when used"}
                  </span>
                </div>
              </section>
            </div>
          </details>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="outline" onClick={() => void reset()} disabled={saving}>
              <RotateCcw className="mr-2 h-4 w-4" /> Back to automatic
            </Button>
            <div className="flex items-center gap-3">
              {form.updatedAt && <span className="text-xs text-muted-foreground">Last saved {new Date(form.updatedAt).toLocaleString()}</span>}
              <SaveButton saving={saving} disabled={!dirty} onClick={() => void save()} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

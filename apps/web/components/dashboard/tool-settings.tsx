"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Plus, RotateCcw, Search, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { apiErrorMessage } from "@/components/dashboard";
import { SaveButton, SettingsCard } from "@/components/dashboard/settings-form";
import api from "@/lib/api";
import { GREY_WORK_LABEL, MATERIAL_LABEL, QUALITY, rupees, type GreyWork, type Material, type Quality } from "@/lib/tools";

/*
 * A calculator's own settings, shown in Dashboard → Tool Pages under the tool.
 *
 * The construction, bricks and cement calculators share one set of settings
 * (GET/PUT /tools/construction/admin — saved whole): material rates, cities,
 * per-sq-ft figures and the masonry standards. Each tool shows only its part;
 * a figure two tools use is marked "shared". Everything runs on its own — a
 * box left empty stays automatic; type a number only to fix it.
 */

export type SettingsTool = "construction-cost-calculator" | "bricks-calculator" | "cement-bags-calculator";
export const TOOLS_WITH_SETTINGS: SettingsTool[] = ["construction-cost-calculator", "bricks-calculator", "cement-bags-calculator"];

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

interface Masonry {
  bricksPer100Cft: number;
  dryMortarPer100Cft: number;
  cementBagCft: number;
  cementBagKg: number;
  concreteDryFactor: number;
  plasterDryFactor: number;
  brickWastagePct: number;
  cementWastagePct: number;
  waterCementRatio: number;
}

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
  contingencyPct: number;
  basementFactor: number;
  cities: { name: string; factor: number }[];
  masonry: Masonry;
  autoIndex: boolean;
  updatedAt?: string;
}
interface ShopRate {
  low: number;
  mid: number;
  high: number;
  count: number;
}
interface AdminData {
  config: Config;
  defaults: Config;
  shop: Record<Material, ShopRate | null>;
  auto: { index: number; basket: number; baseBasket: number; cities: { name: string; factor: number; source: string; ownRates: number }[] };
}

/** The masonry standards (PWD analysis-of-rates basis), and which calculator uses each. */
const MASONRY_FIELDS: { k: keyof Masonry; label: string; hint: string; step?: string; used: ("bricks" | "cement")[] }[] = [
  { k: "bricksPer100Cft", label: "Bricks in 100 cft of brickwork", hint: "PWD: 1,350 (9\" × 4.5\" × 3\" brick with joints)", used: ["bricks"] },
  { k: "brickWastagePct", label: "Brick wastage (%)", hint: "5 — breakage and cutting", step: "0.5", used: ["bricks"] },
  { k: "dryMortarPer100Cft", label: "Dry mortar in 100 cft of brickwork (cft)", hint: "PWD: 30", used: ["bricks", "cement"] },
  { k: "cementBagCft", label: "One cement bag (cft)", hint: "50 kg = 1.25 cft", step: "0.01", used: ["bricks", "cement"] },
  { k: "cementWastagePct", label: "Cement wastage (%)", hint: "2", step: "0.5", used: ["bricks", "cement"] },
  { k: "cementBagKg", label: "One cement bag (kg)", hint: "50", used: ["cement"] },
  { k: "concreteDryFactor", label: "Concrete dry volume factor", hint: "1.54 × the finished volume", step: "0.01", used: ["cement"] },
  { k: "plasterDryFactor", label: "Plaster dry volume factor", hint: "1.30 × (joints, uneven walls, spill)", step: "0.01", used: ["cement"] },
  { k: "waterCementRatio", label: "Water–cement ratio", hint: "0.5 (litres of water per kg of cement)", step: "0.05", used: ["cement"] },
];

/** The rates each calculator prices with. */
const RATES_FOR: Record<SettingsTool, Material[]> = {
  "construction-cost-calculator": MATERIALS,
  "bricks-calculator": ["bricks", "cement", "sand"],
  "cement-bags-calculator": ["cement", "sand", "crush"],
};

/** A number box; empty means "automatic" when `auto` is given. */
function Num({ value, onChange, auto, step = "any", className = "h-10 tabular-nums" }: { value: number; onChange: (n: number) => void; auto?: string; step?: string; className?: string }) {
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

const Shared = ({ title }: { title: string }) => (
  <span title={title} className="ml-1.5 rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700">
    Shared
  </span>
);

export default function ToolSettings({ tool, onDirty }: { tool: SettingsTool; onDirty?: (dirty: boolean) => void }) {
  const [data, setData] = useState<AdminData | null>(null);
  const [form, setForm] = useState<Config | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirtyState] = useState(false);
  const [cityQuery, setCityQuery] = useState("");

  const setDirty = (v: boolean) => {
    setDirtyState(v);
    onDirty?.(v);
  };
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);

  const cities = useMemo(() => {
    const q = cityQuery.trim().toLowerCase();
    return (data?.auto.cities ?? []).filter((c) => !q || c.name.toLowerCase().includes(q));
  }, [data, cityQuery]);

  if (!form || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
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

  // Always the whole set: the API saves every calculator's settings together.
  const save = async () => {
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

  const resetAll = async () => {
    if (!confirm("Put every construction, bricks and cement setting back to automatic / default?")) return;
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

  const kind = tool === "bricks-calculator" ? "bricks" : tool === "cement-bags-calculator" ? "cement" : null;
  const masonryFields = kind ? MASONRY_FIELDS.filter((f) => f.used.includes(kind)) : [];
  // Only this calculator's standards back to the PWD figures — saved with Save.
  const standardFigures = () =>
    patch((c) => {
      for (const f of masonryFields) c.masonry[f.k] = data.defaults.masonry[f.k];
    });

  const rates = RATES_FOR[tool];
  const cityOverride = (name: string) => form.cities.find((c) => c.name.toLowerCase() === name.toLowerCase())?.factor ?? 0;
  const setCityOverride = (name: string, factor: number) =>
    patch((c) => {
      c.cities = c.cities.filter((x) => x.name.toLowerCase() !== name.toLowerCase());
      if (factor > 0) c.cities.push({ name, factor });
    });
  const splitTotal = form.finishSplit.reduce((s, x) => s + (Number(x.pct) || 0), 0);
  const pctMove = Math.round((data.auto.index - 1) * 100);

  const ratesCard = (
    <SettingsCard
      title={kind ? "Rates it prices with" : "Material rates"}
      description={
        kind
          ? "Empty = today's live shop rate. These rates are shared by the construction, bricks and cement calculators — fixing one here fixes it in all three."
          : "Empty = today's live shop rate. Type a rate only to fix it. The bricks and cement calculators use the same rates."
      }
    >
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
            {rates.map((m) => {
              const s = data.shop[m];
              return (
                <tr key={m} className="border-b last:border-0">
                  <td className="py-2.5 pr-3 font-medium">
                    {MATERIAL_LABEL[m]}
                    {kind && <Shared title="Also used by the other calculators" />}
                    <span className="block text-xs text-muted-foreground">
                      per {UNIT[m]}
                      {tool === "bricks-calculator" && m === "bricks" && " · first class = top of range, second class = bottom"}
                    </span>
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
  );

  return (
    <div className="space-y-5">
      {kind ? (
        <>
          <SettingsCard
            title={kind === "bricks" ? "Bricks calculator standards" : "Cement calculator standards"}
            description="Pakistani engineering standards (PWD analysis of rates) behind every figure the calculator shows. Change only if your engineers work to different figures."
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {masonryFields.map((f) => (
                <label key={f.k} className="space-y-1.5 text-xs font-medium text-muted-foreground">
                  <span>
                    {f.label}
                    {f.used.length > 1 && <Shared title="Used by both the bricks and the cement calculator" />}
                  </span>
                  <Num value={form.masonry?.[f.k] ?? 0} step={f.step ?? "1"} onChange={(n) => patch((c) => void (c.masonry = { ...(c.masonry ?? ({} as Masonry)), [f.k]: n }))} />
                  <span className="block text-[11px] font-normal">Standard: {f.hint}</span>
                </label>
              ))}
            </div>
            <div>
              <Button variant="outline" size="sm" onClick={standardFigures}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Use the standard figures
              </Button>
            </div>
          </SettingsCard>

          {ratesCard}

          <SettingsCard title="Whole house option" description="The calculator's “Whole house” choice uses the construction calculator's figures per sq ft of covered area.">
            <div className="grid gap-3 sm:grid-cols-3">
              {(kind === "bricks" ? (["bricks"] as Material[]) : (["cement", "sand", "crush"] as Material[])).map((m) => (
                <label key={m} className="space-y-1.5 text-xs font-medium text-muted-foreground">
                  <span>
                    {MATERIAL_LABEL[m]} per sq ft ({UNIT[m]})
                    <Shared title="Also used by the construction cost calculator" />
                  </span>
                  <Num value={form.qty[m]} step="0.01" onChange={(n) => patch((c) => void (c.qty[m] = n))} />
                </label>
              ))}
            </div>
          </SettingsCard>
        </>
      ) : (
        <>
          {/* What runs on its own */}
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { title: "Material prices", text: `${MATERIALS.filter((m) => !form.rates[m] && data.shop[m]).length} of 5 from the shop's live rates` },
              { title: `${data.auto.cities.length} cities`, text: "Each city's cost level worked out on its own" },
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

          {ratesCard}

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
                <div>
                  <h3 className="text-sm font-semibold">Material per sq ft of covered area</h3>
                  <p className="text-xs text-muted-foreground">Also used by the bricks and cement calculators&apos; “Whole house” option.</p>
                </div>
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
                    Kept aside — contingency (%)
                    <Num value={form.contingencyPct} onChange={(n) => patch((c) => void (c.contingencyPct = n))} />
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
        </>
      )}

      <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white/95 p-3 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <SaveButton saving={saving} disabled={!dirty} onClick={() => void save()} />
          {dirty ? (
            <span className="text-sm text-amber-700">Unsaved changes</span>
          ) : (
            form.updatedAt && <span className="text-xs text-muted-foreground">Last saved {new Date(form.updatedAt).toLocaleString()}</span>
          )}
        </div>
        {!kind && (
          <Button variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => void resetAll()} disabled={saving}>
            <RotateCcw className="mr-1.5 h-4 w-4" /> Back to automatic
          </Button>
        )}
      </div>
    </div>
  );
}

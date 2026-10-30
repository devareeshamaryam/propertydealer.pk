"use client";

/**
 * The visual parts of the site assistant: property results, today's rates,
 * construction cost, area prices, and the one-step search forms. Every number
 * comes from the live site; these only draw it.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Building2, ChevronRight, FileText, Loader2, Map as MapIcon, MapPin, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConstructionPrefill, SearchPrefill, Visual } from "@/lib/assistant/types";

/** Used only until the live list arrives (or if it can't be loaded). */
export const CITIES = ["Lahore", "Karachi", "Islamabad", "Rawalpindi", "Faisalabad", "Multan", "Peshawar", "Gujranwala", "Sialkot", "Bahawalpur", "Hyderabad", "Quetta"];

/* The site's own city lists, loaded once per visit and shared by every picker. */
let siteCities: Promise<string[]> | null = null;
let buildCities: Promise<string[]> | null = null;
function loadList(url: string, pick: (j: any) => string[]): Promise<string[]> {
  return fetch(url)
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      const list = j ? pick(j).filter(Boolean) : [];
      return list.length ? [...new Set(list)] : CITIES;
    })
    .catch(() => CITIES);
}
function useList(get: () => Promise<string[]>): string[] {
  const [list, setList] = useState<string[]>(CITIES);
  useEffect(() => {
    let on = true;
    void get().then((l) => on && setList(l));
    return () => {
      on = false;
    };
  }, [get]);
  return list;
}
const getSiteCities = () => (siteCities ??= loadList("/api/assistant/cities", (j) => (j.cities || []).map((c: any) => String(c.name))));
const getBuildCities = () => (buildCities ??= loadList("/api/tools/construction", (j) => (j.config?.cities || []).map((c: any) => String(c.name))));
/** Every city on the site, busiest first. */
export const useCities = () => useList(getSiteCities);
/** Cities the construction calculator has rates for. */
const useBuildCities = () => useList(getBuildCities);

/** A city dropdown; the chosen city stays in the list even if it isn't in it. */
function CityDropdown({ value, list, onChange, disabled, className }: { value: string; list: string[]; onChange: (c: string) => void; disabled?: boolean; className?: string }) {
  const all = value && !list.some((c) => c.toLowerCase() === value.toLowerCase()) ? [value, ...list] : list;
  return (
    <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} aria-label="City" className={className}>
      {all.map((c) => (
        <option key={c}>{c}</option>
      ))}
    </select>
  );
}

type V<K extends Visual["kind"]> = Extract<Visual, { kind: K }>;

/* ── small pieces ───────────────────────────────────────────────────────── */

function Shell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("relative overflow-hidden rounded-xl border border-slate-200 bg-white", className)}>{children}</div>;
}

function CardHead({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-3.5 py-2.5">
      <div className="min-w-0">
        <p className="text-[16px] font-semibold leading-tight text-slate-900">{title}</p>
        {sub && <p className="mt-0.5 text-[13.5px] text-slate-500">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

function FootLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex items-center justify-between gap-2 border-t border-slate-100 px-3.5 py-2.5 text-[14.5px] font-semibold text-primary transition-colors hover:bg-slate-50">
      <span>{children}</span>
      <ArrowRight className="h-4 w-4 shrink-0" />
    </Link>
  );
}

function Pills<T extends string | number>({ value, options, onChange, disabled }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.v)}
          aria-pressed={value === o.v}
          className={cn(
            "h-9 rounded-full border px-3.5 text-[14.5px] font-medium transition-colors disabled:opacity-60",
            value === o.v ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[13px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      {children}
    </div>
  );
}

const Busy = () => (
  <div className="absolute inset-0 z-10 grid place-items-center bg-white/60 backdrop-blur-[1px]">
    <Loader2 className="h-5 w-5 animate-spin text-primary" />
  </div>
);

/* ── money ──────────────────────────────────────────────────────────────── */

/** "2.5 crore", "80 lakh", "80L", "50k", "45000" → rupees. */
export function parseMoney(s: string): number | undefined {
  const t = String(s || "").toLowerCase().replace(/,/g, "").replace(/rs\.?|pkr/g, "").trim();
  const m = /^(\d+(?:\.\d+)?)\s*(crore|cr|c|lakh|lac|lacs|lakhs|l|thousand|hazar|k|arab)?$/.exec(t);
  if (!m) return undefined;
  const n = Number(m[1]);
  const u = m[2] || "";
  const mult = /^(crore|cr|c)$/.test(u) ? 1e7 : /^(lakh|lac|lacs|lakhs|l)$/.test(u) ? 1e5 : /^(thousand|hazar|k)$/.test(u) ? 1e3 : u === "arab" ? 1e9 : 1;
  const v = Math.round(n * mult);
  return v > 0 ? v : undefined;
}

export function moneyText(v?: number): string {
  if (!v) return "";
  const t = (x: number) => String(Number(x.toFixed(2)));
  if (v >= 1e7) return `${t(v / 1e7)} Crore`;
  if (v >= 1e5) return `${t(v / 1e5)} Lakh`;
  return v.toLocaleString("en-PK");
}

export const sizeLabel = (m?: number) => (!m ? "" : m >= 20 && m % 20 === 0 ? `${m / 20} Kanal` : `${m} Marla`);

/* ── property results ───────────────────────────────────────────────────── */

export function ListingsCard({ card }: { card: V<"listings"> }) {
  if (!card.items.length) return null;
  const shown = card.items.slice(0, 6);
  return (
    <Shell>
      <CardHead title="Best matches" sub={card.label} right={<span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[13px] font-semibold text-slate-600">{card.total.toLocaleString("en-PK")}</span>} />
      <div className="divide-y divide-slate-100">
        {shown.map((c) => (
          <Link key={c.id} href={c.url} className="group flex gap-3 px-3 py-3 transition-colors hover:bg-slate-50">
            <div className="relative h-[78px] w-[104px] shrink-0 overflow-hidden rounded-xl bg-slate-100">
              {c.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.photo} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
              ) : (
                <div className="grid h-full place-items-center text-slate-300">
                  <Building2 className="h-7 w-7" />
                </div>
              )}
              {c.featured && <span className="absolute left-1.5 top-1.5 rounded-md bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950">Featured</span>}
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 text-[16.5px] font-bold leading-tight text-slate-900">
                {c.priceText}
                {c.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-sky-500" aria-label="Verified agency" />}
              </p>
              <p className="mt-0.5 line-clamp-1 text-[15px] text-slate-700">{c.title}</p>
              <p className="mt-1 flex items-center gap-1 text-[13.5px] text-slate-500">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="line-clamp-1">{c.place}</span>
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {[c.size, c.beds ? `${c.beds} Beds` : "", c.baths ? `${c.baths} Baths` : ""].filter(Boolean).map((t) => (
                  <span key={t} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[12.5px] font-medium text-slate-600">{t}</span>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>
      {card.moreUrl && <FootLink href={card.moreUrl}>{card.moreExact === false ? "Browse more on the site" : card.total > shown.length ? `See all ${card.total.toLocaleString("en-PK")} properties` : "Open on the results page"}</FootLink>}
    </Shell>
  );
}

/* ── material rates ─────────────────────────────────────────────────────── */

const RATE_TABS = [
  { v: "", label: "All" },
  { v: "cement", label: "Cement" },
  { v: "steel", label: "Steel" },
  { v: "bricks", label: "Bricks" },
  { v: "sand", label: "Sand" },
  { v: "bajri", label: "Bajri" },
];

export function RatesCard({ card, busy, onChange }: { card: V<"rates">; busy?: boolean; onChange: (material: string) => void }) {
  const focus = RATE_TABS.find((t) => t.v && card.focus?.includes(t.v))?.v ?? (card.focus || "");
  const today = new Date().toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });
  return (
    <Shell>
      {busy && <Busy />}
      <CardHead title="Construction material rates" sub={`Today, ${today} · from suppliers on the site`} />
      <div className="border-b border-slate-100 px-3.5 py-2.5">
        <Pills value={focus} options={RATE_TABS} onChange={onChange} disabled={busy} />
      </div>
      {card.brands.length > 0 ? (
        <table className="w-full text-left text-[15px]">
          <thead>
            <tr className="bg-slate-50 text-[12.5px] font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-3.5 py-2">Brand</th>
              <th className="px-3.5 py-2 text-right">Price</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {card.brands.map((b, i) => (
              <tr key={i}>
                <td className="px-3.5 py-2.5">
                  <Link href={b.url} className="font-medium text-slate-900 hover:text-primary">{b.brand}</Link>
                  {b.product && b.product !== b.brand && !/—\s*(per unit|\d+\s*kg bag)$/i.test(b.product) && <p className="line-clamp-1 text-[13px] text-slate-500">{b.product}</p>}
                </td>
                <td className="whitespace-nowrap px-3.5 py-2.5 text-right">
                  <span className="font-semibold text-slate-900">{b.price}</span>
                  <p className="text-[12.5px] text-slate-500">{b.unit}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <table className="w-full text-left text-[15px]">
          <thead>
            <tr className="bg-slate-50 text-[12.5px] font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-3.5 py-2">Material</th>
              <th className="px-3.5 py-2 text-right">Today&apos;s rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {card.rows.map((r, i) => (
              <tr key={i}>
                <td className="px-3.5 py-2.5">
                  <Link href={r.url} className="font-medium text-slate-900 hover:text-primary">{r.material}</Link>
                </td>
                <td className="whitespace-nowrap px-3.5 py-2.5 text-right">
                  <span className="font-semibold text-slate-900">{r.rate}</span>
                  <p className="text-[12.5px] text-slate-500">{r.unit}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <FootLink href="/tools/construction-cost-calculator">Work out your building cost</FootLink>
    </Shell>
  );
}

/* ── construction cost ──────────────────────────────────────────────────── */

const PLOTS = [3, 5, 7, 10, 20, 40].map((m) => ({ v: m, label: sizeLabel(m) }));
const FLOORS = [
  { v: 1, label: "Single storey" },
  { v: 2, label: "Double storey" },
  { v: 3, label: "Triple storey" },
];

export function ConstructionCard({
  card,
  busy,
  onChange,
}: {
  card: V<"construction">;
  busy?: boolean;
  onChange: (args: { plot_marla: number; floors: number; city: string; kind: string; quality: string }) => void;
}) {
  const inp = card.input || { marla: 5, floors: 2, city: card.city };
  const buildList = useBuildCities();
  const run = (p: Partial<{ marla: number; floors: number; city: string; sel: string }>) => {
    const sel = p.sel ?? card.selected;
    onChange({
      plot_marla: p.marla ?? inp.marla,
      floors: p.floors ?? inp.floors,
      city: p.city ?? inp.city,
      kind: sel === "grey" ? "grey" : "complete",
      quality: sel === "grey" ? "standard" : sel,
    });
  };
  const max = Math.max(1, ...card.stages.map((s) => s.amount));
  const chosen = card.options.find((o) => o.key === card.selected) || card.options[0];
  return (
    <Shell>
      {busy && <Busy />}
      <CardHead title={`${card.plot} house · ${card.floors}`} sub={`${card.city} · ${card.covered} covered · about ${card.months} months`} />
      <div className="space-y-2.5 border-b border-slate-100 px-3.5 py-3">
        <Pills value={inp.marla} options={PLOTS} onChange={(m) => run({ marla: m })} disabled={busy} />
        <div className="flex flex-wrap items-center gap-2">
          <Pills value={inp.floors} options={FLOORS} onChange={(f) => run({ floors: f })} disabled={busy} />
          <CityDropdown
            value={inp.city}
            list={card.cities?.length ? card.cities : buildList}
            disabled={busy}
            onChange={(c) => run({ city: c })}
            className="h-9 rounded-full border border-slate-200 bg-white px-3 text-[14.5px] font-medium text-slate-700 outline-none focus:border-primary"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 p-2.5">
        {card.options.map((o) => (
          <button
            key={o.key}
            type="button"
            disabled={busy}
            onClick={() => o.key !== card.selected && run({ sel: o.key })}
            className={cn(
              "rounded-xl border px-3 py-2.5 text-left transition-colors",
              o.key === card.selected ? "border-primary bg-primary/[0.06] ring-1 ring-primary" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
            )}
          >
            <p className="text-[12.5px] font-medium text-slate-500">{o.label}</p>
            <p className="mt-0.5 text-[16.5px] font-bold text-slate-900">{o.total.replace(/^PKR /, "Rs ")}</p>
          </button>
        ))}
      </div>
      <div className="px-3.5 pb-3">
        <p className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-slate-500">
          {chosen?.label} — stage by stage <span className="font-normal normal-case text-slate-400">· {card.perSqft}</span>
        </p>
        <div className="space-y-2">
          {card.stages.map((s) => (
            <div key={s.stage}>
              <div className="flex items-baseline justify-between gap-3 text-[14px]">
                <span className="text-slate-700">{s.stage}</span>
                <span className="whitespace-nowrap font-semibold text-slate-900">{s.cost.replace(/^PKR /, "Rs ")}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.max(3, (s.amount / max) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <FootLink href={card.link}>Open the full calculator</FootLink>
    </Shell>
  );
}

/* ── area prices ────────────────────────────────────────────────────────── */

export function MarketCard({ card }: { card: V<"market"> }) {
  const withData = card.market.filter((m) => m.listings > 0);
  const [tab, setTab] = useState<"sale" | "rent">(withData[0]?.purpose || "sale");
  const m = withData.find((x) => x.purpose === tab) || withData[0];
  return (
    <Shell>
      <CardHead
        title={`Property prices · ${card.place}`}
        sub="From live listings right now"
        right={
          withData.length > 1 ? (
            <Pills
              value={tab}
              options={[
                { v: "sale" as const, label: "Buy" },
                { v: "rent" as const, label: "Rent" },
              ]}
              onChange={setTab}
            />
          ) : undefined
        }
      />
      {!m ? (
        <p className="px-3.5 py-4 text-[15px] text-slate-600">Not enough live listings here yet to show prices.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-px bg-slate-100">
            {[
              { k: "Typical price", v: m.median },
              { k: "Price per marla", v: m.perMarla || "—" },
              { k: "Most sell between", v: m.typicalRange, wide: true },
            ].map((s) => (
              <div key={s.k} className={cn("bg-white px-3.5 py-3", s.wide && "col-span-2")}>
                <p className="text-[12.5px] font-medium text-slate-500">{s.k}</p>
                <p className="mt-0.5 text-[16.5px] font-bold text-slate-900">{s.v}</p>
              </div>
            ))}
          </div>
          {!!m.bySize?.length && (
            <table className="w-full border-t border-slate-100 text-left text-[15px]">
              <thead>
                <tr className="bg-slate-50 text-[12.5px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-3.5 py-2">Size</th>
                  <th className="px-3.5 py-2 text-right">Typical price</th>
                  <th className="px-3.5 py-2 text-right">Listings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {m.bySize.map((r) => (
                  <tr key={r.size}>
                    <td className="px-3.5 py-2.5 font-medium text-slate-900">{r.size}</td>
                    <td className="whitespace-nowrap px-3.5 py-2.5 text-right font-semibold text-slate-900">{r.median}</td>
                    <td className="px-3.5 py-2.5 text-right text-slate-500">{r.listings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="border-t border-slate-100 px-3.5 py-2 text-[12.5px] text-slate-400">Based on {m.listings.toLocaleString("en-PK")} listings</p>
        </>
      )}
      {card.url && <FootLink href={card.url}>See listings here</FootLink>}
    </Shell>
  );
}

/* ── place picker (area / society with suggestions) ─────────────────────── */

type Place = { id: string; name: string; city: string; listings: number; kind: string };
/** Picked "All of …": searched by name, which covers every area so named. */
const GROUP = "group";

function PlaceInput({ city, value, onChange }: { city: string; value: { text: string; id?: string }; onChange: (v: { text: string; id?: string; city?: string }) => void }) {
  const [list, setList] = useState<Place[]>([]);
  const [group, setGroup] = useState<{ name: string; city: string; listings: number } | null>(null);
  const [openList, setOpenList] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (t.current) clearTimeout(t.current);
    const q = value.text.trim();
    if (value.id || q.length < 2) {
      setList([]);
      setGroup(null);
      return;
    }
    t.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/assistant/places?q=${encodeURIComponent(q)}${city ? `&city=${encodeURIComponent(city)}` : ""}`);
        const j = await r.json();
        setList(Array.isArray(j?.places) ? j.places.slice(0, 6) : []);
        setGroup(j?.group?.name ? j.group : null);
      } catch {
        setList([]);
        setGroup(null);
      }
    }, 220);
  }, [value.text, value.id, city]);

  return (
    <div className="relative">
      <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        value={value.text}
        onChange={(e) => onChange({ text: e.target.value })}
        onFocus={() => setOpenList(true)}
        onBlur={() => setTimeout(() => setOpenList(false), 150)}
        placeholder={city ? `Anywhere in ${city} — or type an area` : "Area or society"}
        className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-[16px] text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
      />
      {openList && list.length > 0 && (
        <div className="absolute right-0 top-full z-20 mt-1 max-h-72 w-[min(330px,calc(100vw-5.5rem))] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg sm:w-[300px]">
          {group && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange({ text: group.name, id: GROUP, city: group.city });
                setOpenList(false);
              }}
              className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 text-left hover:bg-slate-50"
            >
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-semibold text-slate-900">All of {group.name}</span>
                <span className="block text-[12.5px] text-slate-500">{group.city} · every phase and block</span>
              </span>
              {group.listings > 0 && <span className="shrink-0 text-[12.5px] text-slate-400">{group.listings} listings</span>}
            </button>
          )}
          {list.map((p) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange({ text: p.name, id: p.id, city: p.city });
                setOpenList(false);
              }}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-slate-50"
            >
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-medium text-slate-900">{p.name}</span>
                <span className="block text-[12.5px] text-slate-500">{p.city}</span>
              </span>
              {p.listings > 0 && <span className="shrink-0 text-[12.5px] text-slate-400">{p.listings} listings</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CitySelect({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const list = useCities();
  return (
    <CityDropdown
      value={value}
      list={list}
      onChange={onChange}
      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[16px] text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
    />
  );
}

const cap = (s: string) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());

/* ── one-step property search ───────────────────────────────────────────── */

export type SearchSubmit = { args: Record<string, unknown>; say: string; prefill: SearchPrefill };

const TYPES = [
  { v: "", label: "Any" },
  { v: "house", label: "House" },
  { v: "plot", label: "Plot" },
  { v: "flat", label: "Flat" },
  { v: "commercial", label: "Commercial" },
];
const SIZES = [0, 3, 5, 7, 10, 20, 40].map((m) => ({ v: m, label: m ? sizeLabel(m) : "Any" }));
const BEDS = [0, 2, 3, 4, 5].map((b) => ({ v: b, label: b ? (b === 5 ? "5+" : String(b)) : "Any" }));
const BUDGETS = {
  sale: [50e5, 1e7, 2e7, 3e7, 5e7, 1e8],
  rent: [25e3, 50e3, 1e5, 2e5, 5e5],
};

export function SearchForm({ prefill, onSubmit, disabled }: { prefill?: SearchPrefill; onSubmit: (s: SearchSubmit) => void; disabled?: boolean }) {
  const [purpose, setPurpose] = useState<"sale" | "rent">(prefill?.purpose === "rent" ? "rent" : "sale");
  const [city, setCity] = useState(prefill?.city ? cap(prefill.city) : "Lahore");
  const [place, setPlace] = useState<{ text: string; id?: string }>({ text: prefill?.location ? cap(prefill.location) : "", id: prefill?.placeId });
  const [type, setType] = useState(prefill?.type && TYPES.some((t) => t.v === prefill.type) ? prefill.type : "");
  const [marla, setMarla] = useState(prefill?.marla && SIZES.some((s) => s.v === prefill.marla) ? prefill.marla : 0);
  const [budget, setBudget] = useState(prefill?.maxPrice ? moneyText(prefill.maxPrice) : "");
  const [beds, setBeds] = useState(prefill?.beds ? Math.min(5, prefill.beds) : 0);
  const max = parseMoney(budget);
  const badBudget = !!budget.trim() && !max;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (badBudget) return;
    const loc = place.text.trim();
    const args: Record<string, unknown> = { purpose, city, sort: "best" };
    if (place.id && place.id !== GROUP) args.place_ids = [place.id];
    else if (loc) args.location = loc;
    if (type) args.types = [type];
    if (marla) {
      args.min_marla = marla;
      args.max_marla = marla;
    }
    if (max) args.max_price = max;
    if (beds && type !== "plot" && type !== "commercial") args.min_beds = beds;
    const what = `${type ? cap(type) : "Property"} for ${purpose === "rent" ? "rent" : "sale"}`;
    const say = [what, loc ? `${loc}, ${city}` : city, marla ? sizeLabel(marla) : "", max ? `up to PKR ${moneyText(max)}` : "", args.min_beds ? `${beds}+ beds` : ""].filter(Boolean).join(" · ");
    onSubmit({ args, say, prefill: { purpose, city, location: loc || undefined, placeId: place.id === GROUP ? undefined : place.id, type: type || undefined, marla: marla || undefined, maxPrice: max, beds: beds || undefined } });
  };

  return (
    <Shell>
      <form onSubmit={submit} className="space-y-3 p-3.5">
        <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1">
          {(["sale", "rent"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setPurpose(p);
                setBudget("");
              }}
              className={cn("h-9 rounded-lg text-[15.5px] font-semibold transition", purpose === p ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}
            >
              {p === "sale" ? "Buy" : "Rent"}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2">
          <Field label="City">
            <CitySelect
              value={city}
              onChange={(c) => {
                setCity(c);
                setPlace({ text: "" });
              }}
            />
          </Field>
          <Field label="Area / society">
            <PlaceInput
              city={city}
              value={place}
              onChange={(v) => {
                setPlace({ text: v.text, id: v.id });
                if (v.city && v.city !== city) setCity(v.city);
              }}
            />
          </Field>
        </div>
        <Field label="Type">
          <Pills value={type} options={TYPES} onChange={setType} />
        </Field>
        <Field label="Size">
          <Pills value={marla} options={SIZES} onChange={setMarla} />
        </Field>
        <Field label={purpose === "rent" ? "Monthly rent up to" : "Budget up to"}>
          <div className="space-y-2">
            <input
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              inputMode="text"
              placeholder={purpose === "rent" ? "e.g. 80,000 or 1.5 lakh" : "e.g. 2.5 crore or 90 lakh"}
              className={cn(
                "h-11 w-full rounded-xl border bg-white px-3 text-[16px] text-slate-900 outline-none transition focus:ring-2",
                badBudget ? "border-red-300 focus:ring-red-100" : "border-slate-200 focus:border-primary focus:ring-primary/15",
              )}
            />
            <div className="flex flex-wrap gap-1.5">
              {BUDGETS[purpose].map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBudget(moneyText(b))}
                  className={cn(
                    "h-8 rounded-full border px-3 text-[14px] font-medium transition-colors",
                    max === b ? "border-primary bg-primary/10 text-primary" : "border-slate-200 text-slate-600 hover:bg-slate-50",
                  )}
                >
                  {moneyText(b)}
                </button>
              ))}
            </div>
          </div>
        </Field>
        {type !== "plot" && type !== "commercial" && (
          <Field label="Bedrooms">
            <Pills value={beds} options={BEDS} onChange={setBeds} />
          </Field>
        )}
        <button
          type="submit"
          disabled={disabled || badBudget}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-[16px] font-semibold text-white transition hover:bg-primary/90 disabled:opacity-60"
        >
          <Search className="h-4 w-4" /> Show properties
        </button>
      </form>
    </Shell>
  );
}

/* ── area prices: pick a place ──────────────────────────────────────────── */

export function MarketForm({ prefill, onSubmit, disabled, button = "Check prices" }: { prefill?: { city?: string; location?: string }; onSubmit: (s: { args: Record<string, unknown>; say: string }) => void; disabled?: boolean; button?: string }) {
  const [city, setCity] = useState(prefill?.city ? cap(prefill.city) : "Lahore");
  const [place, setPlace] = useState<{ text: string; id?: string }>({ text: prefill?.location || "" });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const loc = place.text.trim();
    const args: Record<string, unknown> = { city, name: loc || undefined };
    if (place.id && place.id !== GROUP) args.place_ids = [place.id];
    else if (loc) args.location = loc;
    onSubmit({ args, say: `Property prices in ${loc ? `${loc}, ${city}` : city}` });
  };
  return (
    <Shell>
      <form onSubmit={submit} className="space-y-3 p-3.5">
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2">
          <Field label="City">
            <CitySelect value={city} onChange={(c) => (setCity(c), setPlace({ text: "" }))} />
          </Field>
          <Field label="Area / society">
            <PlaceInput
              city={city}
              value={place}
              onChange={(v) => {
                setPlace({ text: v.text, id: v.id });
                if (v.city && v.city !== city) setCity(v.city);
              }}
            />
          </Field>
        </div>
        <button
          type="submit"
          disabled={disabled}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-[16px] font-semibold text-white transition hover:bg-primary/90 disabled:opacity-60"
        >
          {button}
        </button>
      </form>
    </Shell>
  );
}

export function ConstructionForm({ prefill, onSubmit, disabled }: { prefill?: ConstructionPrefill; onSubmit: (s: { args: Record<string, unknown>; say: string }) => void; disabled?: boolean }) {
  const [marla, setMarla] = useState(prefill?.marla || 5);
  const [floors, setFloors] = useState(prefill?.floors || 2);
  const [city, setCity] = useState(prefill?.city || "Lahore");
  const buildList = useBuildCities();
  return (
    <Shell>
      <div className="space-y-3 p-3.5">
        <Field label="Plot size">
          <Pills value={marla} options={PLOTS} onChange={setMarla} />
        </Field>
        <Field label="Storeys">
          <Pills value={floors} options={FLOORS} onChange={setFloors} />
        </Field>
        <Field label="City">
          <CityDropdown
            value={city}
            list={buildList}
            onChange={setCity}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[16px] text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </Field>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSubmit({ args: { plot_marla: marla, floors, city }, say: `Construction cost · ${sizeLabel(marla)} · ${FLOORS.find((f) => f.v === floors)?.label} · ${city}` })}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-[16px] font-semibold text-white transition hover:bg-primary/90 disabled:opacity-60"
        >
          Calculate cost
        </button>
      </div>
    </Shell>
  );
}



/* ── dealers ────────────────────────────────────────────────────────────── */

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");

/** The dealer's photo, or their initials when there is none or it fails to load. */
function DealerPhoto({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <>{initials(name)}</>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="h-full w-full object-cover" />;
}

export function AgentsCard({ card, busy, onCity }: { card: V<"agents">; busy?: boolean; onCity: (city: string) => void }) {
  const cities = useCities();
  return (
    <Shell>
      {busy && <Busy />}
      <CardHead
        title={`Property dealers in ${card.city}`}
        sub={card.total ? `${card.total.toLocaleString("en-PK")} on the site · verified first` : undefined}
        right={
          <CityDropdown
            value={card.city}
            list={cities}
            disabled={busy}
            onChange={onCity}
            className="h-9 max-w-[130px] shrink-0 rounded-lg border border-slate-200 bg-white px-2 text-[14px] font-medium text-slate-700 outline-none focus:border-primary"
          />
        }
      />
      {!card.items.length ? (
        <p className="px-3.5 py-3 text-[15px] text-slate-600">No dealers listed in {card.city} yet.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {card.items.map((d) => (
            <div key={d.url} className="relative flex items-center gap-3 px-3.5 py-2.5 hover:bg-slate-50">
              <Link href={d.url} className="flex min-w-0 flex-1 items-center gap-3 after:absolute after:inset-0">
                <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-slate-100 text-[14px] font-semibold text-slate-500">
                  <DealerPhoto src={d.avatar} name={d.name} />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1 text-[15px] font-semibold leading-tight text-slate-900">
                    <span className="truncate">{d.name}</span>
                    {d.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-sky-500" aria-label="Verified" />}
                  </span>
                  <span className="mt-0.5 block truncate text-[13px] text-slate-500">
                    {[d.isAgency ? "Agency" : d.agency ? `Agent at ${d.agency}` : "Agent", d.listings ? `${d.listings} listing${d.listings === 1 ? "" : "s"}` : "", d.years ? `${d.years} yrs` : ""].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </Link>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
            </div>
          ))}
        </div>
      )}
      <FootLink href={card.moreUrl}>All dealers in {card.city}</FootLink>
    </Shell>
  );
}

/* ── one society ────────────────────────────────────────────────────────── */

export function SocietyCard({ card }: { card: V<"society"> }) {
  const [more, setMore] = useState(false);
  const facts = more ? card.facts : card.facts.slice(0, 5);
  return (
    <Shell>
      {card.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.image} alt="" loading="lazy" className="h-32 w-full object-cover" />
      )}
      <div className="px-3.5 pb-2 pt-3">
        <p className="text-[17px] font-semibold leading-tight text-slate-900">{card.name}</p>
        <p className="mt-0.5 text-[13.5px] text-slate-500">
          {card.city}
          {card.listings ? ` · ${card.listings} live listings` : ""}
        </p>
        {card.tagline && <p className="mt-2 text-[14.5px] leading-snug text-slate-700">{card.tagline}</p>}
        {!card.facts.length && !card.tagline && (
          <p className="mt-2 text-[14.5px] leading-snug text-slate-600">A full guide for this society isn&apos;t on the site yet. You can still see its live listings and prices.</p>
        )}
      </div>
      {facts.length > 0 && (
        <dl className="divide-y divide-slate-100 border-t border-slate-100">
          {facts.map((f) => (
            <div key={f.k} className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 px-3.5 py-2 text-[14.5px]">
              <dt className="text-slate-500">{f.k}</dt>
              <dd className="font-medium text-slate-900">{f.v}</dd>
            </div>
          ))}
          {card.facts.length > 5 && (
            <button type="button" onClick={() => setMore((m) => !m)} className="w-full px-3.5 py-2 text-left text-[14px] font-medium text-primary hover:bg-slate-50">
              {more ? "Show less" : `Show ${card.facts.length - 5} more`}
            </button>
          )}
        </dl>
      )}
      {card.amenities.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-slate-100 px-3.5 py-2.5">
          {card.amenities.slice(0, 8).map((a) => (
            <span key={a} className="rounded-md bg-slate-100 px-2 py-1 text-[13px] text-slate-700">{a}</span>
          ))}
        </div>
      )}
      <div className="grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100 text-[14px] font-semibold text-primary">
        {[
          { href: card.links.listings, label: "Listings", icon: Building2 },
          card.links.page ? { href: card.links.page, label: "Full guide", icon: FileText } : null,
          card.links.map ? { href: card.links.map, label: "Map", icon: MapIcon } : null,
        ]
          .filter((x): x is { href: string; label: string; icon: typeof Building2 } => !!x?.href)
          .map((l) => (
            <Link key={l.label} href={l.href} className="flex items-center justify-center gap-1.5 py-2.5 hover:bg-slate-50">
              <l.icon className="h-4 w-4" />
              {l.label}
            </Link>
          ))}
      </div>
    </Shell>
  );
}

/* ── articles ───────────────────────────────────────────────────────────── */

export function GuidesCard({ card }: { card: V<"guides"> }) {
  return (
    <Shell>
      <CardHead title="Helpful guides" />
      <div className="divide-y divide-slate-100">
        {card.items.map((g) => (
          <Link key={g.url} href={g.url} className="flex gap-3 px-3.5 py-2.5 hover:bg-slate-50">
            {g.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={g.image} alt="" loading="lazy" className="h-14 w-20 shrink-0 rounded-lg object-cover" />
            )}
            <span className="min-w-0">
              <span className="line-clamp-2 text-[15px] font-semibold leading-snug text-slate-900">{g.title}</span>
              {g.excerpt && <span className="mt-0.5 line-clamp-1 block text-[13px] text-slate-500">{g.excerpt}</span>}
            </span>
          </Link>
        ))}
      </div>
    </Shell>
  );
}

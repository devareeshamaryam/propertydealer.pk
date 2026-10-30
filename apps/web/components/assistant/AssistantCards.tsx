"use client";

/**
 * The visual parts of the site assistant: property results, today's rates,
 * construction cost, area prices, and the one-step search forms. Every number
 * comes from the live site; these only draw it.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Building2, Loader2, MapPin, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConstructionPrefill, SearchPrefill, Visual } from "@/lib/assistant/types";

export const CITIES = ["Lahore", "Karachi", "Islamabad", "Rawalpindi", "Faisalabad", "Multan", "Peshawar", "Gujranwala", "Sialkot", "Bahawalpur", "Hyderabad", "Quetta"];
const BUILD_CITIES = ["Lahore", "Karachi", "Islamabad", "Rawalpindi"];

type V<K extends Visual["kind"]> = Extract<Visual, { kind: K }>;

/* ── small pieces ───────────────────────────────────────────────────────── */

function Shell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]", className)}>{children}</div>;
}

function CardHead({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
      <div className="min-w-0">
        <p className="text-[14.5px] font-semibold leading-tight text-slate-900">{title}</p>
        {sub && <p className="mt-0.5 text-[12.5px] text-slate-500">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

function FootLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex items-center justify-center gap-1.5 border-t border-slate-100 px-4 py-3 text-[13.5px] font-semibold text-primary transition-colors hover:bg-slate-50">
      {children}
      <ArrowRight className="h-4 w-4" />
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
            "h-8 rounded-full border px-3 text-[13px] font-medium transition-colors disabled:opacity-60",
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
      <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
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
      <CardHead title="Best matches" sub={card.label} right={<span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[12px] font-semibold text-slate-600">{card.total.toLocaleString("en-PK")}</span>} />
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
              <p className="flex items-center gap-1 text-[15px] font-bold leading-tight text-slate-900">
                {c.priceText}
                {c.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-sky-500" aria-label="Verified agency" />}
              </p>
              <p className="mt-0.5 line-clamp-1 text-[13.5px] text-slate-700">{c.title}</p>
              <p className="mt-1 flex items-center gap-1 text-[12.5px] text-slate-500">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="line-clamp-1">{c.place}</span>
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {[c.size, c.beds ? `${c.beds} Beds` : "", c.baths ? `${c.baths} Baths` : ""].filter(Boolean).map((t) => (
                  <span key={t} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11.5px] font-medium text-slate-600">{t}</span>
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
      <div className="border-b border-slate-100 px-4 py-2.5">
        <Pills value={focus} options={RATE_TABS} onChange={onChange} disabled={busy} />
      </div>
      {card.brands.length > 0 ? (
        <table className="w-full text-left text-[13.5px]">
          <thead>
            <tr className="bg-slate-50 text-[11.5px] font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2">Brand</th>
              <th className="px-4 py-2 text-right">Price</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {card.brands.map((b, i) => (
              <tr key={i}>
                <td className="px-4 py-2.5">
                  <Link href={b.url} className="font-medium text-slate-900 hover:text-primary">{b.brand}</Link>
                  {b.product && b.product !== b.brand && !/—\s*(per unit|\d+\s*kg bag)$/i.test(b.product) && <p className="line-clamp-1 text-[12px] text-slate-500">{b.product}</p>}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right">
                  <span className="font-semibold text-slate-900">{b.price}</span>
                  <p className="text-[11.5px] text-slate-500">{b.unit}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <table className="w-full text-left text-[13.5px]">
          <thead>
            <tr className="bg-slate-50 text-[11.5px] font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2">Material</th>
              <th className="px-4 py-2 text-right">Today&apos;s rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {card.rows.map((r, i) => (
              <tr key={i}>
                <td className="px-4 py-2.5">
                  <Link href={r.url} className="font-medium text-slate-900 hover:text-primary">{r.material}</Link>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right">
                  <span className="font-semibold text-slate-900">{r.rate}</span>
                  <p className="text-[11.5px] text-slate-500">{r.unit}</p>
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
      <div className="space-y-2.5 border-b border-slate-100 px-4 py-3">
        <Pills value={inp.marla} options={PLOTS} onChange={(m) => run({ marla: m })} disabled={busy} />
        <div className="flex flex-wrap items-center gap-2">
          <Pills value={inp.floors} options={FLOORS} onChange={(f) => run({ floors: f })} disabled={busy} />
          <select
            value={inp.city}
            disabled={busy}
            onChange={(e) => run({ city: e.target.value })}
            aria-label="City"
            className="h-8 rounded-full border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 outline-none focus:border-primary"
          >
            {(BUILD_CITIES.includes(inp.city) ? BUILD_CITIES : [inp.city, ...BUILD_CITIES]).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 p-3">
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
            <p className="text-[11.5px] font-medium text-slate-500">{o.label}</p>
            <p className="mt-0.5 text-[15px] font-bold text-slate-900">{o.total.replace(/^PKR /, "Rs ")}</p>
          </button>
        ))}
      </div>
      <div className="px-4 pb-3">
        <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-slate-500">
          {chosen?.label} — stage by stage <span className="font-normal normal-case text-slate-400">· {card.perSqft}</span>
        </p>
        <div className="space-y-2">
          {card.stages.map((s) => (
            <div key={s.stage}>
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
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
        <p className="px-4 py-4 text-[13.5px] text-slate-600">Not enough live listings here yet to show prices.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-px bg-slate-100">
            {[
              { k: "Typical price", v: m.median },
              { k: "Price per marla", v: m.perMarla || "—" },
              { k: "Most sell between", v: m.typicalRange, wide: true },
            ].map((s) => (
              <div key={s.k} className={cn("bg-white px-4 py-3", s.wide && "col-span-2")}>
                <p className="text-[11.5px] font-medium text-slate-500">{s.k}</p>
                <p className="mt-0.5 text-[15px] font-bold text-slate-900">{s.v}</p>
              </div>
            ))}
          </div>
          {!!m.bySize?.length && (
            <table className="w-full border-t border-slate-100 text-left text-[13.5px]">
              <thead>
                <tr className="bg-slate-50 text-[11.5px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2">Size</th>
                  <th className="px-4 py-2 text-right">Typical price</th>
                  <th className="px-4 py-2 text-right">Listings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {m.bySize.map((r) => (
                  <tr key={r.size}>
                    <td className="px-4 py-2.5 font-medium text-slate-900">{r.size}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold text-slate-900">{r.median}</td>
                    <td className="px-4 py-2.5 text-right text-slate-500">{r.listings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="border-t border-slate-100 px-4 py-2 text-[11.5px] text-slate-400">Based on {m.listings.toLocaleString("en-PK")} listings</p>
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
        className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-[14px] text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
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
                <span className="block truncate text-[13.5px] font-semibold text-slate-900">All of {group.name}</span>
                <span className="block text-[11.5px] text-slate-500">{group.city} · every phase and block</span>
              </span>
              {group.listings > 0 && <span className="shrink-0 text-[11.5px] text-slate-400">{group.listings} listings</span>}
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
                <span className="block truncate text-[13.5px] font-medium text-slate-900">{p.name}</span>
                <span className="block text-[11.5px] text-slate-500">{p.city}</span>
              </span>
              {p.listings > 0 && <span className="shrink-0 text-[11.5px] text-slate-400">{p.listings} listings</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CitySelect({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const list = value && !CITIES.includes(value) ? [value, ...CITIES] : CITIES;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="City"
      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[14px] text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
    >
      {list.map((c) => (
        <option key={c}>{c}</option>
      ))}
    </select>
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
      <form onSubmit={submit} className="space-y-3.5 p-4">
        <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1">
          {(["sale", "rent"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setPurpose(p);
                setBudget("");
              }}
              className={cn("h-9 rounded-lg text-[14px] font-semibold transition", purpose === p ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}
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
                "h-10 w-full rounded-xl border bg-white px-3 text-[14px] text-slate-900 outline-none transition focus:ring-2",
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
                    "h-7 rounded-full border px-2.5 text-[12.5px] font-medium transition-colors",
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
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-[14.5px] font-semibold text-white transition hover:bg-primary/90 disabled:opacity-60"
        >
          <Search className="h-4 w-4" /> Show properties
        </button>
      </form>
    </Shell>
  );
}

/* ── area prices: pick a place ──────────────────────────────────────────── */

export function MarketForm({ prefill, onSubmit, disabled }: { prefill?: { city?: string; location?: string }; onSubmit: (s: { args: Record<string, unknown>; say: string }) => void; disabled?: boolean }) {
  const [city, setCity] = useState(prefill?.city ? cap(prefill.city) : "Lahore");
  const [place, setPlace] = useState<{ text: string; id?: string }>({ text: prefill?.location || "" });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const loc = place.text.trim();
    const args: Record<string, unknown> = { city };
    if (place.id && place.id !== GROUP) args.place_ids = [place.id];
    else if (loc) args.location = loc;
    onSubmit({ args, say: `Property prices in ${loc ? `${loc}, ${city}` : city}` });
  };
  return (
    <Shell>
      <form onSubmit={submit} className="space-y-3 p-4">
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
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-[14.5px] font-semibold text-white transition hover:bg-primary/90 disabled:opacity-60"
        >
          Check prices
        </button>
      </form>
    </Shell>
  );
}

export function ConstructionForm({ prefill, onSubmit, disabled }: { prefill?: ConstructionPrefill; onSubmit: (s: { args: Record<string, unknown>; say: string }) => void; disabled?: boolean }) {
  const [marla, setMarla] = useState(prefill?.marla || 5);
  const [floors, setFloors] = useState(prefill?.floors || 2);
  const [city, setCity] = useState(prefill?.city || "Lahore");
  return (
    <Shell>
      <div className="space-y-3 p-4">
        <Field label="Plot size">
          <Pills value={marla} options={PLOTS} onChange={setMarla} />
        </Field>
        <Field label="Storeys">
          <Pills value={floors} options={FLOORS} onChange={setFloors} />
        </Field>
        <Field label="City">
          <Pills value={city} options={BUILD_CITIES.map((c) => ({ v: c, label: c }))} onChange={setCity} />
        </Field>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSubmit({ args: { plot_marla: marla, floors, city }, say: `Construction cost · ${sizeLabel(marla)} · ${FLOORS.find((f) => f.v === floors)?.label} · ${city}` })}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-[14.5px] font-semibold text-white transition hover:bg-primary/90 disabled:opacity-60"
        >
          Calculate cost
        </button>
      </div>
    </Shell>
  );
}


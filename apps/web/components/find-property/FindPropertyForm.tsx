"use client";

/**
 * The "Find a property for me" form: what they want (purpose, type, city,
 * areas, budget, size, bedrooms, when) and how to reach them. Posts to
 * /api/property-requests; once sent, it shows the listings that already
 * match, so there's something to look at while the team searches.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, MapPin, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Visual } from "@/lib/assistant/types";
import { ListingsCard, moneyText, parseMoney, sizeLabel, useCities } from "@/components/assistant/AssistantCards";

const TYPES = [
  { v: "any", label: "Any" },
  { v: "house", label: "House" },
  { v: "plot", label: "Plot" },
  { v: "flat", label: "Flat" },
  { v: "upper-portion", label: "Upper portion" },
  { v: "lower-portion", label: "Lower portion" },
  { v: "commercial", label: "Commercial" },
  { v: "shop", label: "Shop" },
  { v: "office", label: "Office" },
  { v: "farmhouse", label: "Farmhouse" },
  { v: "room", label: "Room" },
];
const SIZES = [0, 3, 5, 7, 8, 10, 12, 20, 40];
const BUDGETS = { sale: [50e5, 1e7, 2e7, 3e7, 5e7, 1e8], rent: [30e3, 50e3, 1e5, 2e5, 5e5] };
const TIMELINES = [
  { v: "asap", label: "Right away" },
  { v: "1month", label: "Within a month" },
  { v: "3months", label: "1–3 months" },
  { v: "exploring", label: "Just exploring" },
];
/** The site search's types, for showing matches right away. */
const SEARCH_TYPE: Record<string, string[] | undefined> = {
  house: ["house"], plot: ["plot"], flat: ["flat"], "upper-portion": ["house"], "lower-portion": ["house"], commercial: ["commercial"], shop: ["shop"], office: ["office"], farmhouse: ["house"], room: ["house"],
};

const inputCls =
  "h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-[16px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/15";

function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <p className="mb-1.5 text-[14px] font-semibold text-slate-800">
      {children} {hint && <span className="font-normal text-slate-400">{hint}</span>}
    </p>
  );
}

function Chips<T extends string | number>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          aria-pressed={value === o.v}
          onClick={() => onChange(o.v)}
          className={cn(
            "h-9 rounded-full border px-3.5 text-[14px] font-medium transition-colors",
            value === o.v ? "border-primary bg-primary text-white" : "border-slate-300 bg-white text-slate-700 hover:border-slate-400",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Areas or societies: type, pick from suggestions, add several. */
function AreasInput({ city, value, onChange }: { city: string; value: string[]; onChange: (v: string[]) => void }) {
  const [q, setQ] = useState("");
  const [list, setList] = useState<{ id: string; name: string; city: string }[]>([]);
  const [open, setOpen] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (t.current) clearTimeout(t.current);
    if (q.trim().length < 2) return setList([]);
    t.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/assistant/places?q=${encodeURIComponent(q.trim())}${city ? `&city=${encodeURIComponent(city)}` : ""}`);
        const j = await r.json();
        setList((j?.places || []).slice(0, 6));
      } catch {
        setList([]);
      }
    }, 220);
  }, [q, city]);
  const add = (name: string) => {
    const n = name.trim();
    if (n && !value.some((v) => v.toLowerCase() === n.toLowerCase()) && value.length < 5) onChange([...value, n]);
    setQ("");
    setList([]);
  };
  return (
    <div>
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-1 pl-3 pr-1.5 text-[14px] font-medium text-primary">
              {v}
              <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(value.filter((x) => x !== v))} className="rounded-full p-0.5 hover:bg-primary/15">
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(q);
            }
          }}
          placeholder={value.length ? "Add another area (optional)" : "e.g. DHA Phase 6, Bahria Town, Johar Town"}
          className={cn(inputCls, "pl-9")}
        />
        {open && list.length > 0 && (
          <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
            {list.map((p) => (
              <button
                key={p.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add(p.name)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-[14.5px] hover:bg-slate-50"
              >
                <span className="font-medium text-slate-900">{p.name}</span>
                <span className="text-[12.5px] text-slate-500">{p.city}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function FindPropertyForm() {
  const cities = useCities();
  const [purpose, setPurpose] = useState<"sale" | "rent">("sale");
  const [type, setType] = useState("house");
  const [city, setCity] = useState("Lahore");
  const [areas, setAreas] = useState<string[]>([]);
  const [minBudget, setMinBudget] = useState("");
  const [maxBudget, setMaxBudget] = useState("");
  const [minSize, setMinSize] = useState(0);
  const [maxSize, setMaxSize] = useState(0);
  const [beds, setBeds] = useState(0);
  const [timeline, setTimeline] = useState("1month");
  const [notes, setNotes] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState(true);
  const [website, setWebsite] = useState(""); // hidden; bots fill it in
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [matches, setMatches] = useState<Visual | null>(null);
  const top = useRef<HTMLDivElement>(null);

  const min = parseMoney(minBudget);
  const max = parseMoney(maxBudget);
  const badMoney = (!!minBudget.trim() && !min) || (!!maxBudget.trim() && !max);
  const phoneOk = /^(?:\+?92|0)?3\d{9}$/.test(phone.replace(/[\s-]/g, ""));
  const showBeds = ["any", "house", "flat", "upper-portion", "lower-portion", "farmhouse"].includes(type);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (badMoney) return setError("Please write the budget like 2.5 crore, 80 lakh or 50,000.");
    if (name.trim().length < 2) return setError("Please enter your name.");
    if (!phoneOk) return setError("Please enter a valid mobile number, e.g. 0300 1234567.");
    setBusy(true);
    try {
      const res = await fetch("/api/property-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose, type, city, areas: areas.join(", "),
          minPrice: min, maxPrice: max,
          minMarla: minSize || undefined, maxMarla: maxSize || undefined,
          beds: showBeds && beds ? beds : undefined,
          timeline, notes, name, phone, whatsapp, website, source: "page",
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(res.status === 429 ? "Too many requests — please wait a minute and try again." : j?.message || "Couldn't send your request. Please try again.");
        return;
      }
      setSent(true);
      top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      // Something to look at while the team searches: what already matches.
      void fetch("/assistant/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: "search_listings",
          args: {
            purpose, city, location: areas[0] || city, types: SEARCH_TYPE[type],
            min_price: min, max_price: max, min_marla: minSize || undefined, max_marla: maxSize || minSize || undefined,
            min_beds: showBeds && beds ? beds : undefined,
          },
        }),
      })
        .then((r) => r.json())
        .then((j) => j?.card?.kind === "listings" && j.card.total > 0 && setMatches(j.card))
        .catch(() => {});
    } catch {
      setError("No connection. Please check your internet and try again.");
    } finally {
      setBusy(false);
    }
  };

  if (sent)
    return (
      <div ref={top} className="space-y-4">
        <div className="rounded-xl border border-emerald-200 bg-white p-6 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
          <h2 className="mt-3 text-[22px] font-bold text-slate-900">Request received, {name.trim().split(" ")[0]}!</h2>
          <p className="mx-auto mt-1.5 max-w-md text-[15px] text-slate-600">
            Our team is on it. We&apos;ll {whatsapp ? "WhatsApp or call" : "call"} you on <b className="text-slate-900">{phone}</b> with matching properties
            {timeline === "asap" ? " as soon as possible" : " soon"}.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link href={`/properties/${purpose}`} className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-[14.5px] font-semibold text-white hover:bg-primary/90">
              Browse properties
            </Link>
            <button
              type="button"
              onClick={() => {
                setSent(false);
                setMatches(null);
              }}
              className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-[14.5px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Send another request
            </button>
          </div>
        </div>
        {matches && matches.kind === "listings" && (
          <div>
            <h3 className="mb-2 text-[16px] font-bold text-slate-900">Already on the site, matching your request</h3>
            <ListingsCard card={matches} />
          </div>
        )}
      </div>
    );

  return (
    <form ref={top as any} onSubmit={submit} className="space-y-6 rounded-xl border border-slate-300 bg-white p-4 sm:p-6" noValidate>
      {/* 1. What */}
      <section className="space-y-4">
        <h2 className="text-[17px] font-bold text-slate-900">What are you looking for?</h2>
        <div className="grid max-w-sm grid-cols-2 rounded-lg bg-slate-100 p-1">
          {(["sale", "rent"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setPurpose(p);
                setMinBudget("");
                setMaxBudget("");
              }}
              className={cn("h-10 rounded-md text-[15px] font-semibold transition", purpose === p ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}
            >
              {p === "sale" ? "Buy" : "Rent"}
            </button>
          ))}
        </div>
        <div>
          <Label>Property type</Label>
          <Chips value={type} options={TYPES} onChange={setType} />
        </div>
      </section>

      {/* 2. Where */}
      <section className="grid gap-4 sm:grid-cols-[220px_minmax(0,1fr)]">
        <div>
          <Label>City</Label>
          <select value={city} onChange={(e) => (setCity(e.target.value), setAreas([]))} className={inputCls}>
            {(cities.includes(city) ? cities : [city, ...cities]).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <Label hint="(up to 5)">Preferred areas or societies</Label>
          <AreasInput city={city} value={areas} onChange={setAreas} />
        </div>
      </section>

      {/* 3. Budget and size */}
      <section className="space-y-4">
        <div>
          <Label hint={purpose === "rent" ? "(per month)" : ""}>Budget</Label>
          <div className="grid grid-cols-2 gap-2">
            <input value={minBudget} onChange={(e) => setMinBudget(e.target.value)} placeholder="Min, e.g. 1 crore" className={cn(inputCls, minBudget && !min && "border-red-300")} />
            <input value={maxBudget} onChange={(e) => setMaxBudget(e.target.value)} placeholder="Max, e.g. 2.5 crore" className={cn(inputCls, maxBudget && !max && "border-red-300")} />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {BUDGETS[purpose].map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setMaxBudget(moneyText(b))}
                className={cn("h-8 rounded-full border px-3 text-[13.5px] font-medium", max === b ? "border-primary bg-primary/10 text-primary" : "border-slate-300 text-slate-600 hover:bg-slate-50")}
              >
                up to {moneyText(b)}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Size from</Label>
            <select value={minSize} onChange={(e) => setMinSize(Number(e.target.value))} className={inputCls}>
              {SIZES.map((m) => (
                <option key={m} value={m}>{m ? sizeLabel(m) : "Any"}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Size up to</Label>
            <select value={maxSize} onChange={(e) => setMaxSize(Number(e.target.value))} className={inputCls}>
              {SIZES.map((m) => (
                <option key={m} value={m}>{m ? sizeLabel(m) : "Any"}</option>
              ))}
            </select>
          </div>
        </div>
        {showBeds && (
          <div>
            <Label>Bedrooms</Label>
            <Chips value={beds} options={[0, 1, 2, 3, 4, 5].map((b) => ({ v: b, label: b ? (b === 5 ? "5+" : String(b)) : "Any" }))} onChange={setBeds} />
          </div>
        )}
        <div>
          <Label>When do you need it?</Label>
          <Chips value={timeline} options={TIMELINES} onChange={setTimeline} />
        </div>
        <div>
          <Label hint="(optional)">Anything else?</Label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="e.g. corner plot, park facing, near a school, possession ready, family only…"
            className={cn(inputCls, "h-auto resize-y py-2.5")}
          />
        </div>
      </section>

      {/* 4. Contact */}
      <section className="space-y-4 border-t border-slate-200 pt-5">
        <h2 className="text-[17px] font-bold text-slate-900">How should we contact you?</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Your name</Label>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} className={inputCls} />
          </div>
          <div>
            <Label>Mobile number</Label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              autoComplete="tel"
              placeholder="0300 1234567"
              maxLength={16}
              className={cn(inputCls, phone && !phoneOk && "border-red-300")}
            />
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-[14.5px] text-slate-700">
          <input type="checkbox" checked={whatsapp} onChange={(e) => setWhatsapp(e.target.checked)} className="h-4 w-4 accent-[var(--color-primary,#0f766e)]" />
          This number is on WhatsApp
        </label>
        {/* Hidden from people; bots fill it in. */}
        <input value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden className="hidden" name="website" />
      </section>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-[14.5px] text-red-700">{error}</p>}

      <div>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary text-[16px] font-semibold text-white transition hover:bg-primary/90 disabled:opacity-60"
        >
          {busy && <Loader2 className="h-5 w-5 animate-spin" />} Find it for me
        </button>
        <p className="mt-2 text-center text-[12.5px] text-slate-500">Free. We&apos;ll only contact you about this request.</p>
      </div>
    </form>
  );
}

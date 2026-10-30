"use client";

/**
 * The site assistant: a chat button in the corner that opens a chat window
 * (full screen on phones).
 *
 * The common jobs run straight from buttons and short forms — no model, no
 * waiting: find a property (one form: city, area, type, size, budget, beds),
 * area prices, today's material rates, construction cost. Their answers are
 * visual cards that can be adjusted in place. Anything typed goes to the
 * model, which uses the same lookups and the same cards.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ChevronDown, Hammer, Home, KeyRound, Layers, RotateCcw, SendHorizontal, Square, X } from "lucide-react";
import { useSiteSettings } from "@/components/SiteSettingsProvider";
import { cn } from "@/lib/utils";
import type { QuickRequest, SearchPrefill, Visual } from "@/lib/assistant/types";
import { ConstructionCard, ConstructionForm, ListingsCard, MarketCard, MarketForm, RatesCard, SearchForm } from "./AssistantCards";

type Action = { type: "send"; text: string } | { type: "quick"; req: QuickRequest; say: string } | { type: "form"; card: Visual; say: string; intro: string };
type Chip = { label: string; action: Action };
type Msg = {
  id: string;
  role: "user" | "assistant";
  text: string;
  cards?: Visual[];
  /** The request behind each card, so a card can be adjusted in place. */
  reqs?: (QuickRequest | null)[];
  chips?: Chip[];
  status?: string;
  error?: boolean;
  done?: boolean;
  busyCard?: number;
};

const LS = "pd_assistant_v4";
const SEEN = "pd_assistant_seen";
const newId = () => Math.random().toString(36).slice(2, 10);

const GREETING = "Assalam-o-Alaikum! What can I help you with today? Pick an option below or just type your question.";

const SEARCH_INTRO = "Fill in what you know — leave the rest on Any.";

const searchForm = (prefill?: SearchPrefill): Visual => ({ kind: "form", form: "search", prefill });

const START: { title: string; sub: string; icon: React.ComponentType<{ className?: string }>; action: Action }[] = [
  { title: "Buy a property", sub: "Houses, plots, flats", icon: Home, action: { type: "form", card: searchForm({ purpose: "sale" }), say: "Buy a property", intro: SEARCH_INTRO } },
  { title: "Rent a property", sub: "Homes, flats, offices", icon: KeyRound, action: { type: "form", card: searchForm({ purpose: "rent" }), say: "Rent a property", intro: SEARCH_INTRO } },
  { title: "Area prices", sub: "What property costs", icon: BarChart3, action: { type: "form", card: { kind: "form", form: "market" }, say: "Check prices in an area", intro: "Which area would you like to check?" } },
  { title: "Material rates", sub: "Cement, steel, bricks", icon: Layers, action: { type: "quick", req: { tool: "material_rates", args: {} }, say: "Today's material rates" } },
  { title: "Construction cost", sub: "Cost to build a house", icon: Hammer, action: { type: "form", card: { kind: "form", form: "construction" }, say: "Construction cost", intro: "Pick your plot size and storeys." } },
];

/* ── text helpers ───────────────────────────────────────────────────────── */

/** Pulls the `[[A | B]]` choices out of a reply and strips them (and any half-typed one) from the text. */
function splitChoices(text: string): { body: string; choices: string[] } {
  const choices: string[] = [];
  const seen = new Set<string>();
  const re = /\[\[([^\]]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    for (const part of m[1]!.split("|")) {
      const c = part.trim().replace(/^[-•·*]+\s*|\s*[-•·*]+$/g, "");
      if (c && c.length <= 60 && !seen.has(c.toLowerCase())) {
        seen.add(c.toLowerCase());
        choices.push(c);
      }
    }
  }
  const body = text
    .replace(/\[\[[^\]]*\]\]/g, "")
    .replace(/\[\[[^\]]*$/, "")
    .replace(/(?:^|\n)\s*(?:choose one to proceed|select an option|options)\s*:?\s*(?=\n|$)/gi, "\n")
    .replace(/[\s·•|]+$/g, "")
    .trim();
  return { body, choices: choices.slice(0, 5) };
}

/* Safe inline markdown: **bold**, [links](/path). */
function inline(text: string, key: string) {
  const out: React.ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<strong key={`${key}b${i++}`} className="font-semibold text-slate-900">{m[1]}</strong>);
    else {
      const href = m[3]!;
      if (href.startsWith("/") && !href.startsWith("//")) out.push(<Link key={`${key}l${i++}`} href={href} className="font-medium text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary">{m[2]}</Link>);
      else if (/^https?:\/\//.test(href)) out.push(<a key={`${key}l${i++}`} href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline decoration-primary/30 underline-offset-2">{m[2]}</a>);
      else out.push(m[2]);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const cells = (line: string) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
const isSep = (line: string) => {
  const t = line.trim();
  if (!t.includes("|") || !t.includes("-")) return false;
  const c = cells(t);
  return c.length >= 2 && c.every((x) => /^:?-{2,}:?$/.test(x));
};

function Markdown({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const lines = text.replace(/\r/g, "").split("\n");
  const flush = () => {
    if (!list.length) return;
    const k = blocks.length;
    blocks.push(
      <ul key={`u${k}`} className="my-1.5 space-y-1 pl-4 [&>li]:relative [&>li]:before:absolute [&>li]:before:-left-3 [&>li]:before:top-[0.6em] [&>li]:before:h-1 [&>li]:before:w-1 [&>li]:before:rounded-full [&>li]:before:bg-slate-400">
        {list.map((it, i) => <li key={i}>{inline(it, `u${k}_${i}`)}</li>)}
      </ul>,
    );
    list = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    const t = raw.trim();
    if (t.includes("|") && i + 1 < lines.length && isSep(lines[i + 1]!)) {
      flush();
      const head = cells(t);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i]!.trim().includes("|")) {
        if (!isSep(lines[i]!)) rows.push(cells(lines[i]!));
        i++;
      }
      i--;
      const k = blocks.length;
      blocks.push(
        <div key={`t${k}`} className="my-2 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full border-collapse text-left text-[13px]">
            <thead>
              <tr className="bg-slate-50 text-[11.5px] font-semibold uppercase tracking-wide text-slate-500">
                {head.map((h, hi) => <th key={hi} className="whitespace-nowrap px-3 py-2">{inline(h, `th${k}_${hi}`)}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {head.map((_, ci) => <td key={ci} className={cn("px-3 py-2 align-top text-slate-800", ci > 0 && "whitespace-nowrap font-medium")}>{inline(r[ci] ?? "", `td${k}_${ri}_${ci}`)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    const b = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/.exec(raw);
    if (b) {
      list.push(b[1]!);
      continue;
    }
    flush();
    if (!t || /^-{3,}$/.test(t)) continue;
    if (/^#{1,4}\s+/.test(t)) blocks.push(<p key={`h${i}`} className="mb-1 mt-2.5 font-semibold text-slate-900">{inline(t.replace(/^#{1,4}\s+/, ""), `h${i}`)}</p>);
    else blocks.push(<p key={`p${i}`} className="my-1.5">{inline(t, `p${i}`)}</p>);
  }
  flush();
  return <div dir="auto" className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0">{blocks}</div>;
}

/* ── what to say and offer after a card ─────────────────────────────────── */

function summarize(card: Visual | null, req: QuickRequest): string {
  if (!card) return "Sorry, I couldn't load that right now. Please try again.";
  switch (card.kind) {
    case "listings": {
      if (!card.total) return "Nothing matches all of that right now. Try a higher budget, any size, or a nearby area.";
      const what = req.args.purpose === "rent" ? "for rent" : "for sale";
      return `Found **${card.total.toLocaleString("en-PK")}** ${card.total === 1 ? "property" : "properties"} ${what}${card.label ? ` in ${card.label}` : ""}${card.priceRange && card.total > 1 ? `, from **${card.priceRange.min}** to **${card.priceRange.max}**` : ""}.`;
    }
    case "rates":
      return card.brands.length ? `Today's ${card.focus || "material"} prices by brand.` : "Here are today's construction material rates.";
    case "construction": {
      const opt = card.options.find((o) => o.key === card.selected);
      return `A ${card.plot.toLowerCase()} ${card.floors.toLowerCase()} house in ${card.city} costs about **${opt?.total || ""}** (${opt?.label.toLowerCase()}).`;
    }
    case "market": {
      const m = card.market.find((x) => x.listings > 0);
      return m ? `Prices in ${card.place}: a typical property ${m.purpose === "rent" ? "rents for" : "sells for"} **${m.median}**.` : `There aren't enough live listings in ${card.place} yet to show prices.`;
    }
    default:
      return "";
  }
}

function chipsFor(card: Visual | null, req: QuickRequest): Chip[] {
  if (!card) return [];
  const a = req.args as Record<string, any>;
  const q = (label: string, tool: QuickRequest["tool"], args: Record<string, unknown>, say = label): Chip => ({ label, action: { type: "quick", req: { tool, args }, say } });
  const scope = { place_ids: a.place_ids, location: a.location, city: a.city, city_id: a.city_id };
  switch (card.kind) {
    case "listings": {
      const prefill: SearchPrefill = {
        purpose: a.purpose === "rent" ? "rent" : "sale",
        city: a.city,
        location: typeof a.location === "string" ? a.location : card.label?.split(",")[0],
        placeId: Array.isArray(a.place_ids) ? a.place_ids[0] : undefined,
        type: Array.isArray(a.types) ? a.types[0] : undefined,
        marla: a.min_marla,
        maxPrice: a.max_price,
        beds: a.min_beds,
      };
      const out: Chip[] = [{ label: "Change search", action: { type: "form", card: searchForm(prefill), say: "Change search", intro: SEARCH_INTRO } }];
      if (!card.total) {
        if (a.max_price) out.push(q("Any budget", "search_listings", { ...a, max_price: undefined }, "Same search, any budget"));
        if (a.min_marla) out.push(q("Any size", "search_listings", { ...a, min_marla: undefined, max_marla: undefined }, "Same search, any size"));
        return out;
      }
      if (a.sort !== "cheapest") out.push(q("Cheapest first", "search_listings", { ...a, sort: "cheapest" }));
      if (a.sort !== "newest") out.push(q("Newest first", "search_listings", { ...a, sort: "newest" }));
      if (card.label) out.push(q(`Prices in ${card.label.split(",")[0]}`, "market_prices", { ...scope, purpose: a.purpose }));
      return out;
    }
    case "rates":
      return [q("5 Marla building cost", "construction_cost", { plot_marla: 5, floors: 2 }), q("10 Marla building cost", "construction_cost", { plot_marla: 10, floors: 2 }), q("1 Kanal building cost", "construction_cost", { plot_marla: 20, floors: 2 })];
    case "construction":
      return [q("Today's material rates", "material_rates", {}), { label: "Plots for sale", action: { type: "form", card: searchForm({ purpose: "sale", type: "plot", marla: card.input?.marla, city: card.input?.city }), say: "Plots for sale", intro: SEARCH_INTRO } }];
    case "market":
      return [
        q("Show listings here", "search_listings", { ...scope, purpose: "sale" }, `Properties for sale in ${card.place}`),
        q("Rentals here", "search_listings", { ...scope, purpose: "rent" }, `Properties for rent in ${card.place}`),
        { label: "Another area", action: { type: "form", card: { kind: "form", form: "market" }, say: "Check another area", intro: "Which area would you like to check?" } },
      ];
    default:
      return [];
  }
}

/* ── the window ─────────────────────────────────────────────────────────── */

function Avatar({ size = 30 }: { size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center overflow-hidden rounded-full bg-primary" style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/api/push/badge.png" alt="" style={{ width: size * 0.58, height: size * 0.58 }} />
    </span>
  );
}

const ChatIcon = () => (
  <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden fill="currentColor">
    <path d="M12 3C6.48 3 2 6.94 2 11.8c0 2.4 1.1 4.58 2.9 6.17-.15 1.1-.62 2.3-1.67 3.2a.5.5 0 0 0 .3.88c1.95.08 3.6-.6 4.82-1.43A11.6 11.6 0 0 0 12 20.6c5.52 0 10-3.94 10-8.8S17.52 3 12 3Z" />
  </svg>
);

const Dots = ({ label }: { label?: string }) => (
  <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md bg-slate-100 px-3.5 py-3 text-[13px] text-slate-500" aria-live="polite">
    <span className="flex gap-1">
      {[0, 1, 2].map((d) => <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${d * 0.15}s` }} />)}
    </span>
    {label && <span>{label}…</span>}
  </div>
);

export default function AssistantWidget() {
  const pathname = usePathname() || "/";
  const site = useSiteSettings() as { siteName?: string };
  const brand = site?.siteName || "Property Dealer";
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [teaser, setTeaser] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLInputElement>(null);
  const stick = useRef(true);
  /** A form just appeared: show it from its top, not its bottom. */
  const showTop = useRef<string | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS) || "[]");
      if (Array.isArray(saved)) setMsgs(saved.filter((m) => m?.role && typeof m.text === "string").map((m) => ({ ...m, status: undefined, busyCard: undefined, done: true })));
    } catch {
      /* private mode */
    }
  }, []);
  useEffect(() => {
    if (busy) return;
    try {
      localStorage.setItem(LS, JSON.stringify(msgs.slice(-30)));
    } catch {
      /* private mode */
    }
  }, [msgs, busy]);

  // A short note beside the button, once, a little after the first visit.
  useEffect(() => {
    let seen = true;
    try {
      seen = !!localStorage.getItem(SEEN);
    } catch {
      /* private mode */
    }
    if (seen) return;
    const t = setTimeout(() => setTeaser(true), 10000);
    return () => clearTimeout(t);
  }, []);
  const markSeen = () => {
    setTeaser(false);
    try {
      localStorage.setItem(SEEN, "1");
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (!open) return;
    markSeen();
    if (window.matchMedia("(min-width: 640px)").matches) setTimeout(() => box.current?.focus(), 120);
    else document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Follow new content, unless the reader scrolled up to look at something.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (showTop.current) {
      const target = el.querySelector<HTMLElement>(`[data-mid="${showTop.current}"]`);
      showTop.current = null;
      if (target) {
        stick.current = false;
        el.scrollTo({ top: target.offsetTop - 12, behavior: "smooth" });
        return;
      }
    }
    if (stick.current) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [msgs, open]);
  const onScroll = () => {
    const el = scroller.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  const update = (id: string, fn: (m: Msg) => Msg) => setMsgs((all) => all.map((m) => (m.id === id ? fn(m) : m)));

  const quickFetch = async (req: QuickRequest): Promise<Visual | null> => {
    const res = await fetch("/assistant/quick", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req) });
    const j = await res.json().catch(() => null);
    return res.ok && j?.card ? (j.card as Visual) : null;
  };

  /** Runs a lookup directly and shows its card. */
  const runQuick = useCallback(
    async (req: QuickRequest, say: string) => {
      if (busy) return;
      stick.current = true;
      const reply: Msg = { id: newId(), role: "assistant", text: "", status: "Loading" };
      setMsgs((all) => [...all, { id: newId(), role: "user", text: say, done: true }, reply]);
      setBusy(true);
      try {
        const card = await quickFetch(req);
        update(reply.id, (m) => ({ ...m, text: summarize(card, req), cards: card ? [card] : [], reqs: [req], chips: chipsFor(card, req), error: !card, status: undefined, done: true }));
      } catch {
        update(reply.id, (m) => ({ ...m, text: "Connection lost. Please try again.", error: true, status: undefined, done: true }));
      } finally {
        setBusy(false);
      }
    },
    [busy],
  );

  /** Re-runs one card with changed options (size, storeys, material…) in place. */
  const refreshCard = async (msgId: string, idx: number, req: QuickRequest) => {
    update(msgId, (m) => ({ ...m, busyCard: idx }));
    try {
      const card = await quickFetch(req);
      update(msgId, (m) => {
        if (!card) return { ...m, busyCard: undefined };
        const cards = [...(m.cards || [])];
        const reqs = [...(m.reqs || [])];
        cards[idx] = card;
        reqs[idx] = req;
        return { ...m, cards, reqs, busyCard: undefined, text: m.chips ? summarize(card, req) : m.text, chips: m.chips ? chipsFor(card, req) : m.chips };
      });
    } catch {
      update(msgId, (m) => ({ ...m, busyCard: undefined }));
    }
  };

  const showForm = (card: Visual, say: string, intro: string) => {
    const user: Msg = { id: newId(), role: "user", text: say, done: true };
    showTop.current = user.id;
    setMsgs((all) => [...all, user, { id: newId(), role: "assistant", text: intro, cards: [card], done: true }]);
  };

  /** Free text goes to the model. */
  const send = useCallback(
    async (textIn?: string) => {
      const text = (textIn ?? input).trim();
      if (!text || busy) return;
      setInput("");
      stick.current = true;
      const user: Msg = { id: newId(), role: "user", text, done: true };
      const reply: Msg = { id: newId(), role: "assistant", text: "", status: "Typing" };
      const history = [...msgs, user];
      setMsgs([...history, reply]);
      setBusy(true);
      const ctrl = new AbortController();
      abort.current = ctrl;
      try {
        const res = await fetch("/assistant/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "assistant", content: GREETING }, ...history.filter((m) => m.text && !m.error).map((m) => ({ role: m.role, content: m.text }))],
            page: pathname,
          }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          const j = await res.json().catch(() => ({}));
          update(reply.id, (m) => ({ ...m, text: j?.error || "Sorry, I couldn't answer that just now. Please try again.", error: true, status: undefined, done: true }));
          return;
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i: number;
          while ((i = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, i);
            buf = buf.slice(i + 1);
            if (!line.trim()) continue;
            let ev: any;
            try {
              ev = JSON.parse(line);
            } catch {
              continue;
            }
            if (ev.t === "text") update(reply.id, (m) => ({ ...m, text: m.text + ev.d, status: undefined }));
            else if (ev.t === "reset_text") update(reply.id, (m) => ({ ...m, text: "" }));
            else if (ev.t === "status") update(reply.id, (m) => ({ ...m, status: ev.text }));
            else if (ev.t === "cards" && ev.cards?.kind === "form") {
              showTop.current = user.id;
              update(reply.id, (m) => ({ ...m, cards: [...(m.cards || []), ev.cards], reqs: [...(m.reqs || []), null] }));
            } else if (ev.t === "cards" && ev.cards?.kind) update(reply.id, (m) => ({ ...m, cards: [...(m.cards || []), ev.cards], reqs: [...(m.reqs || []), null] }));
            else if (ev.t === "error") update(reply.id, (m) => ({ ...m, text: m.text || ev.text, error: !m.text, status: undefined }));
          }
        }
      } catch (e: any) {
        if (e?.name !== "AbortError") update(reply.id, (m) => ({ ...m, text: m.text || "Connection lost. Please try again.", error: !m.text }));
      } finally {
        update(reply.id, (m) => ({ ...m, status: undefined, done: true }));
        setBusy(false);
        abort.current = null;
      }
    },
    [input, busy, msgs, pathname],
  );

  const act = (a: Action) => {
    if (busy) return;
    if (a.type === "send") void send(a.text);
    else if (a.type === "quick") void runQuick(a.req, a.say);
    else showForm(a.card, a.say, a.intro);
  };

  const reset = () => {
    abort.current?.abort();
    setMsgs([]);
    try {
      localStorage.removeItem(LS);
    } catch {
      /* ignore */
    }
  };

  if (pathname.startsWith("/dashboard") || pathname.includes("/checkout")) return null;

  const last = msgs[msgs.length - 1];
  const lastChips: Chip[] =
    last?.role === "assistant" && last.done && !busy
      ? last.chips?.length
        ? last.chips
        : splitChoices(last.text).choices.map((c) => ({ label: c, action: { type: "send", text: c } as Action }))
      : [];

  const renderCard = (m: Msg, c: Visual, i: number) => {
    const req = m.reqs?.[i] || null;
    const cardBusy = m.busyCard === i;
    switch (c.kind) {
      case "listings":
        return <ListingsCard card={c} />;
      case "rates":
        return <RatesCard card={c} busy={cardBusy} onChange={(material) => void refreshCard(m.id, i, { tool: "material_rates", args: material ? { material } : {} })} />;
      case "construction":
        return <ConstructionCard card={c} busy={cardBusy} onChange={(args) => void refreshCard(m.id, i, { tool: "construction_cost", args: { ...(req?.args || {}), ...args } })} />;
      case "market":
        return <MarketCard card={c} />;
      case "form":
        if (c.form === "search")
          return <SearchForm prefill={c.prefill} disabled={busy} onSubmit={(s) => void runQuick({ tool: "search_listings", args: s.args }, s.say)} />;
        if (c.form === "market") return <MarketForm prefill={c.prefill} disabled={busy} onSubmit={(s) => void runQuick({ tool: "market_prices", args: s.args }, s.say)} />;
        return <ConstructionForm prefill={c.prefill} disabled={busy} onSubmit={(s) => void runQuick({ tool: "construction_cost", args: s.args }, s.say)} />;
    }
  };

  return (
    <>
      {/* Launcher. Phones: above the bottom menu; hidden while the chat covers the screen. */}
      <div className={cn("fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-[91] flex items-end gap-3 md:bottom-6 md:right-6", open && "max-sm:hidden")}>
        {teaser && !open && (
          <div className="relative mb-1.5 w-[260px] rounded-2xl border border-slate-200 bg-white p-3.5 shadow-[0_8px_30px_-8px_rgba(15,23,42,0.25)]">
            <button type="button" onClick={markSeen} aria-label="Dismiss" className="absolute right-2 top-2 rounded p-0.5 text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setOpen(true)} className="pr-4 text-left">
              <span className="block text-[14px] font-semibold text-slate-900">Looking for a property?</span>
              <span className="mt-0.5 block text-[13.5px] leading-snug text-slate-600">Tell us your budget and area — see what&apos;s available right away.</span>
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close chat" : "Chat with us"}
          aria-expanded={open}
          className="grid h-[60px] w-[60px] place-items-center rounded-full bg-primary text-white shadow-[0_6px_24px_-6px_rgba(15,23,42,0.5)] transition-transform hover:scale-[1.04] active:scale-95"
        >
          {open ? <ChevronDown className="h-7 w-7" /> : <ChatIcon />}
        </button>
      </div>

      {open && (
        <div
          role="dialog"
          aria-label={`Chat with ${brand}`}
          className="assistant-open fixed inset-0 z-[90] flex flex-col bg-slate-50 sm:inset-auto sm:bottom-[100px] sm:right-6 sm:h-[min(700px,calc(100vh-120px))] sm:w-[430px] sm:overflow-hidden sm:rounded-2xl sm:border sm:border-slate-200 sm:shadow-[0_24px_64px_-16px_rgba(15,23,42,0.35)]"
        >
          <div className="flex items-center gap-3 bg-primary px-4 pb-3.5 pt-[max(0.875rem,env(safe-area-inset-top))] text-white">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/15">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/api/push/badge.png" alt="" className="h-6 w-6" />
            </span>
            <p className="min-w-0 flex-1 truncate text-[16px] font-semibold leading-tight">{brand}</p>
            {msgs.length > 0 && (
              <button type="button" onClick={reset} title="Start over" aria-label="Start over" className="grid h-9 w-9 place-items-center rounded-full text-white/85 hover:bg-white/15">
                <RotateCcw className="h-[18px] w-[18px]" />
              </button>
            )}
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full text-white/85 hover:bg-white/15">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div ref={scroller} onScroll={onScroll} className="relative flex-1 space-y-4 overflow-y-auto overscroll-contain px-3.5 py-4 text-[14.5px] leading-relaxed text-slate-800 sm:px-4">
            <div className="flex items-end gap-2">
              <Avatar />
              <div className="max-w-[86%] rounded-2xl rounded-bl-md border border-slate-200/70 bg-white px-3.5 py-2.5">{GREETING}</div>
            </div>
            {msgs.length === 0 && (
              <div className="grid grid-cols-2 gap-2 pl-[38px]">
                {START.map((s, i) => (
                  <button
                    key={s.title}
                    type="button"
                    onClick={() => act(s.action)}
                    className={cn(
                      "group flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-primary/40 hover:shadow-sm",
                      i === START.length - 1 && START.length % 2 === 1 && "col-span-2",
                    )}
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/[0.08] text-primary">
                      <s.icon className="h-[17px] w-[17px]" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-semibold leading-tight text-slate-900">{s.title}</span>
                      <span className="mt-0.5 block text-[12px] leading-snug text-slate-500">{s.sub}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}

            {msgs.map((m) => {
              if (m.role === "user")
                return (
                  <div key={m.id} data-mid={m.id} className="flex justify-end">
                    <div dir="auto" className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-white">
                      {m.text}
                    </div>
                  </div>
                );
              const { body } = splitChoices(m.text);
              const waiting = !m.done && !body && !m.cards?.length;
              return (
                <div key={m.id} data-mid={m.id} className="flex items-start gap-2">
                  <Avatar />
                  <div className="min-w-0 flex-1 space-y-2">
                    {body && (
                      <div className={cn("inline-block max-w-full rounded-2xl rounded-tl-md border border-slate-200/70 bg-white px-3.5 py-2.5", m.error && "border-red-200 bg-red-50 text-red-800")}>
                        <Markdown text={body} />
                      </div>
                    )}
                    {m.cards?.map((c, i) => <div key={i} className="assistant-pop">{renderCard(m, c, i)}</div>)}
                    {(waiting || (!m.done && m.status && m.status !== "Typing")) && <Dots label={m.status && m.status !== "Typing" ? m.status : undefined} />}
                  </div>
                </div>
              );
            })}

            {lastChips.length > 0 && (
              <div className="flex flex-wrap gap-2 pl-[38px]">
                {lastChips.map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    dir="auto"
                    onClick={() => act(c.action)}
                    className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-[13px] font-medium text-slate-700 transition-colors hover:border-primary hover:text-primary"
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="flex items-center gap-2 border-t border-slate-200 bg-white px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3"
          >
            <input
              ref={box}
              value={input}
              dir="auto"
              maxLength={1500}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your question…"
              className="h-11 min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 text-[15px] text-slate-900 outline-none transition focus:border-primary/50 focus:bg-white"
            />
            {busy && abort.current ? (
              <button type="button" onClick={() => abort.current?.abort()} aria-label="Stop" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-800 text-white">
                <Square className="h-4 w-4 fill-current" />
              </button>
            ) : (
              <button type="submit" disabled={!input.trim() || busy} aria-label="Send" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-white transition disabled:bg-slate-200 disabled:text-slate-400">
                <SendHorizontal className="h-5 w-5" />
              </button>
            )}
          </form>
        </div>
      )}
    </>
  );
}


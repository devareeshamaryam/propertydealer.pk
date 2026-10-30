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
import { BarChart3, Check, ChevronDown, ChevronRight, Hammer, Home, KeyRound, Landmark, Layers, Loader2, RotateCcw, SendHorizontal, Square, Users, X } from "lucide-react";
import { useSiteSettings } from "@/components/SiteSettingsProvider";
import { cn } from "@/lib/utils";
import type { QuickRequest, Visual } from "@/lib/assistant/types";
import { AgentsCard, ConstructionCard, ConstructionForm, GuidesCard, ListingsCard, MarketCard, MarketForm, RatesCard, SearchForm, SocietyCard, sizeLabel } from "./AssistantCards";
import { SEARCH_INTRO, chipsFor, localRoute, searchForm, type Action, type Chip } from "./suggest";
import { refusal } from "@/lib/assistant/guard";

type Msg = {
  id: string;
  role: "user" | "assistant";
  text: string;
  cards?: Visual[];
  /** The request behind each card, so a card can be adjusted in place. */
  reqs?: (QuickRequest | null)[];
  chips?: Chip[];
  status?: string;
  /** What the assistant looked up on the way, shown as steps. */
  steps?: string[];
  error?: boolean;
  done?: boolean;
  busyCard?: number;
};

const LS = "pd_assistant_v4";
const SEEN = "pd_assistant_seen";
const newId = () => Math.random().toString(36).slice(2, 10);

const GREETING = "Assalam-o-Alaikum! How can we help you today?";


const START: { title: string; icon: React.ComponentType<{ className?: string }>; action: Action }[] = [
  { title: "Buy a property", icon: Home, action: { type: "form", card: searchForm({ purpose: "sale" }), say: "Buy a property", intro: SEARCH_INTRO } },
  { title: "Rent a property", icon: KeyRound, action: { type: "form", card: searchForm({ purpose: "rent" }), say: "Rent a property", intro: SEARCH_INTRO } },
  { title: "Property prices in an area", icon: BarChart3, action: { type: "form", card: { kind: "form", form: "market" }, say: "Property prices in an area", intro: "Which area would you like to check?" } },
  { title: "Society details", icon: Landmark, action: { type: "form", card: { kind: "form", form: "society" }, say: "Society details", intro: "Which society?" } },
  { title: "Find a property dealer", icon: Users, action: { type: "quick", req: { tool: "find_agents", args: { city: "Lahore" } }, say: "Property dealers in Lahore" } },
  { title: "Today's material rates", icon: Layers, action: { type: "quick", req: { tool: "material_rates", args: {} }, say: "Today's material rates" } },
  { title: "House construction cost", icon: Hammer, action: { type: "form", card: { kind: "form", form: "construction" }, say: "House construction cost", intro: "Pick your plot size and storeys." } },
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
          <table className="w-full border-collapse text-left text-[14.5px] sm:text-[14px]">
            <thead>
              <tr className="bg-slate-50 text-[12.5px] font-semibold uppercase tracking-wide text-slate-500">
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

function summarize(card: Visual | null): string {
  if (!card) return "Sorry, I couldn't load that right now. Please try again.";
  const a: Record<string, any> = card.q || {};
  switch (card.kind) {
    case "listings": {
      if (!card.total) return "Nothing matches all of that right now. Try a higher budget, any size, or a nearby area.";
      const what = a.purpose === "rent" ? "for rent" : "for sale";
      const one = Array.isArray(a.types) && a.types.length === 1 ? String(a.types[0]) : "property";
      const word = card.total === 1 ? one : one === "property" ? "properties" : `${one}s`;
      return `Found **${card.total.toLocaleString("en-PK")}** ${word} ${what}${card.label ? ` in ${card.label}` : ""}${card.priceRange && card.total > 1 ? `, mostly **${card.priceRange.min}** to **${card.priceRange.max}**` : ""}.`;
    }
    case "rates":
      return card.brands.length ? `Today's ${card.focus || "material"} prices by brand.` : "Here are today's construction material rates.";
    case "construction": {
      const opt = card.options.find((o) => o.key === card.selected);
      return `A ${card.plot.toLowerCase()} ${card.floors.toLowerCase()} house in ${card.city} costs about **${opt?.total || ""}** (${opt?.label.toLowerCase()}).`;
    }
    case "market": {
      const m = card.market.find((x) => x.listings > 0);
      const size = a.min_marla && a.min_marla === a.max_marla ? `${sizeLabel(a.min_marla)} ` : "";
      const type = Array.isArray(a.types) && a.types.length === 1 ? String(a.types[0]) : "property";
      return m
        ? `A typical ${size}${type} in ${card.place} ${m.purpose === "rent" ? "rents for" : "sells for"} **${m.median}**${m.perMarla && !size ? ` — about **${m.perMarla}** per marla` : ""}.`
        : `There aren't enough live listings in ${card.place} yet to show prices.`;
    }
    case "agents":
      return card.items.length ? `Property dealers in ${card.city}, verified ones first. Open a profile to see their listings and contact them.` : `No dealers are listed in ${card.city} yet.`;
    case "society":
      return card.facts.length ? `Here's the key information on **${card.name}**.` : `Here's what we have on **${card.name}** right now.`;
    case "guides":
      return "These guides on the site explain it step by step.";
    default:
      return "";
  }
}

const QUICK_STEP: Record<string, string> = {
  search_listings: "Searching live listings",
  market_prices: "Reading prices from live listings",
  material_rates: "Loading today's rates",
  construction_cost: "Working out the cost",
  find_agents: "Finding dealers",
  society_info: "Looking up the society",
};

/* ── the window ─────────────────────────────────────────────────────────── */

const ChatIcon = () => (
  <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden fill="currentColor">
    <path d="M12 3C6.48 3 2 6.94 2 11.8c0 2.4 1.1 4.58 2.9 6.17-.15 1.1-.62 2.3-1.67 3.2a.5.5 0 0 0 .3.88c1.95.08 3.6-.6 4.82-1.43A11.6 11.6 0 0 0 12 20.6c5.52 0 10-3.94 10-8.8S17.52 3 12 3Z" />
  </svg>
);

/** What the assistant did to answer, like a short work log. */
function Steps({ steps, running }: { steps: string[]; running: boolean }) {
  return (
    <ul className="space-y-1 text-[13.5px] text-slate-500" aria-live="polite">
      {steps.map((st, i) => {
        const active = running && i === steps.length - 1;
        return (
          <li key={i} className="flex items-center gap-2">
            {active ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" /> : <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />}
            <span className={cn(active && "text-slate-700")}>{st}</span>
          </li>
        );
      })}
    </ul>
  );
}

const Dots = ({ label }: { label?: string }) => (
  <div className="inline-flex items-center gap-2 py-1 text-[14px] text-slate-500" aria-live="polite">
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
      const reply: Msg = { id: newId(), role: "assistant", text: "", status: "Loading", steps: [QUICK_STEP[req.tool] || "Looking it up"] };
      setMsgs((all) => [...all, { id: newId(), role: "user", text: say, done: true }, reply]);
      setBusy(true);
      try {
        const card = await quickFetch(req);
        update(reply.id, (m) => ({ ...m, text: summarize(card), cards: card ? [card] : [], reqs: [req], chips: chipsFor(card), error: !card, status: undefined, done: true }));
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
        return { ...m, cards, reqs, busyCard: undefined, text: m.chips ? summarize(card) : m.text, chips: m.chips ? chipsFor(card) : m.chips };
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
      // Requests that must not be answered (bulk numbers, personal details, spam…): a polite no, nothing sent anywhere.
      const no = refusal(text);
      if (no) {
        stick.current = true;
        setMsgs((all) => [...all, { id: newId(), role: "user", text, done: true }, { id: newId(), role: "assistant", text: no, done: true }]);
        return;
      }
      // Plain questions ("cement rate", "10 marla ghar ka kharcha") are answered here: instant, no model.
      const local = localRoute(text);
      if (local) return void runQuick(local, text);
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
            else if (ev.t === "status") update(reply.id, (m) => ({ ...m, status: ev.text, steps: m.steps?.includes(ev.text) ? m.steps : [...(m.steps || []), ev.text] }));
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
    [input, busy, msgs, pathname, runQuick],
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
        : (() => {
            // The model showed a card: suggest from the card itself; otherwise use the model's own options.
            const shown = [...(last.cards || [])].reverse().find((c) => c.kind !== "form");
            const fromCard = chipsFor(shown);
            return fromCard.length ? fromCard : splitChoices(last.text).choices.map((c) => ({ label: c, action: { type: "send", text: c } as Action }));
          })()
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
      case "agents":
        return <AgentsCard card={c} busy={cardBusy} onCity={(city) => void refreshCard(m.id, i, { tool: "find_agents", args: { city } })} />;
      case "society":
        return <SocietyCard card={c} />;
      case "guides":
        return <GuidesCard card={c} />;
      case "form":
        if (c.form === "search")
          return <SearchForm prefill={c.prefill} disabled={busy} onSubmit={(s) => void runQuick({ tool: "search_listings", args: s.args }, s.say)} />;
        if (c.form === "market") return <MarketForm prefill={c.prefill} disabled={busy} onSubmit={(s) => void runQuick({ tool: "market_prices", args: s.args }, s.say)} />;
        if (c.form === "society")
          return (
            <MarketForm
              prefill={c.prefill}
              disabled={busy}
              button="Show society details"
              onSubmit={(s) => void runQuick({ tool: "society_info", args: { name: s.args.name || s.args.city, city: s.args.city } }, s.say.replace("Property prices in", "About"))}
            />
          );
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
        <div className="relative">
          {/* "CHAT NOW" curving round the top-right of the button. */}
          {!open && (
            <svg viewBox="0 0 100 100" aria-hidden className="pointer-events-none absolute -left-5 -top-5 h-[100px] w-[100px] overflow-visible">
              <defs>
                <path id="pd-chat-ring" d="M 13,50 A 37,37 0 1,1 87,50 A 37,37 0 1,1 13,50" />
              </defs>
              <text className="fill-primary" style={{ fontSize: 14, fontWeight: 800, letterSpacing: 1.4, paintOrder: "stroke", stroke: "#fff", strokeWidth: 3.5, strokeLinejoin: "round" }}>
                <textPath href="#pd-chat-ring" startOffset="37.5%" textAnchor="middle">
                  CHAT NOW
                </textPath>
              </text>
            </svg>
          )}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Close chat" : "Chat now"}
            aria-expanded={open}
            className="relative grid h-[60px] w-[60px] place-items-center rounded-full bg-primary text-white shadow-[0_6px_24px_-6px_rgba(15,23,42,0.5)] transition-transform hover:scale-[1.04] active:scale-95"
          >
            {open ? <ChevronDown className="h-7 w-7" /> : <ChatIcon />}
          </button>
        </div>
      </div>

      {open && (
        <div
          role="dialog"
          aria-label={`Chat with ${brand}`}
          className="assistant-open fixed inset-0 z-[90] flex flex-col bg-white sm:inset-auto sm:bottom-[100px] sm:right-6 sm:h-[min(700px,calc(100vh-120px))] sm:w-[430px] sm:overflow-hidden sm:rounded-2xl sm:border sm:border-slate-200 sm:shadow-[0_24px_64px_-16px_rgba(15,23,42,0.35)]"
        >
          <div className="flex items-center gap-2.5 bg-primary px-3.5 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/api/push/badge.png" alt="" className="h-5 w-5" />
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

          <div ref={scroller} onScroll={onScroll} className="relative flex-1 space-y-3.5 overflow-y-auto overscroll-contain px-3 py-3.5 text-[16px] leading-relaxed text-slate-800 sm:text-[15px]">
            <div className="px-0.5">
              <p className="text-[17px] font-semibold text-slate-900">{GREETING}</p>
              {msgs.length === 0 && <p className="mt-0.5 text-[14.5px] text-slate-500">Choose an option, or type your question below.</p>}
            </div>
            {msgs.length === 0 && (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                {START.map((s, i) => (
                  <button
                    key={s.title}
                    type="button"
                    onClick={() => act(s.action)}
                    className={cn("flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-slate-50", i > 0 && "border-t border-slate-100")}
                  >
                    <s.icon className="h-5 w-5 shrink-0 text-primary" />
                    <span className="flex-1 text-[15.5px] font-medium text-slate-900">{s.title}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                  </button>
                ))}
              </div>
            )}

            {msgs.map((m) => {
              if (m.role === "user")
                return (
                  <div key={m.id} data-mid={m.id} className="flex justify-end">
                    <div dir="auto" className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-white">
                      {m.text}
                    </div>
                  </div>
                );
              const { body } = splitChoices(m.text);
              const running = !m.done;
              const steps = (m.steps || []).filter((st) => st !== "Typing" && st !== "Loading");
              return (
                <div key={m.id} data-mid={m.id} className="space-y-2.5">
                  {steps.length > 0 && (running || !m.error) && <Steps steps={steps} running={running && !body && !m.cards?.length} />}
                  {body && (
                    <div className={cn("px-0.5", m.error && "rounded-lg bg-red-50 px-3 py-2 text-red-800")}>
                      <Markdown text={body} />
                    </div>
                  )}
                  {m.cards?.map((c, i) => <div key={i} className="assistant-pop">{renderCard(m, c, i)}</div>)}
                  {running && !body && !m.cards?.length && !steps.length && <Dots />}
                </div>
              );
            })}

            {lastChips.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {lastChips.map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    dir="auto"
                    onClick={() => act(c.action)}
                    className="rounded-full border border-primary/25 bg-white px-3.5 py-1.5 text-left text-[14.5px] font-medium leading-snug text-primary transition-colors hover:bg-primary hover:text-white"
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
              className="h-11 min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 text-[16px] text-slate-900 outline-none transition focus:border-primary/50 focus:bg-white"
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


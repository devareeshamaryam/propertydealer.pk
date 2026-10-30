"use client";

/**
 * The site assistant: a chat button in the corner that opens a chat window
 * (full screen on phones).
 *
 * Kept plain on purpose, like the chat widgets people already know: one
 * clear greeting, a few answers to tap, readable text, and listings as a
 * clean list with a "See all" button. The assistant asks what it needs
 * (buy or rent, where, budget) one question at a time; when its reply ends
 * with a line like [[Lahore | Karachi | Islamabad]] those become buttons.
 * The conversation is kept on this device and can be started over.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, BadgeCheck, ChevronDown, MapPin, RotateCcw, SendHorizontal, Square, X } from "lucide-react";
import { useSiteSettings } from "@/components/SiteSettingsProvider";
import { cn } from "@/lib/utils";

type Card = { id: string; title: string; url: string; priceText: string; size: string; beds: number; baths: number; place: string; photo: string | null; verified: boolean; featured: boolean; purpose: string };
type Msg = {
  id: string;
  role: "user" | "assistant";
  text: string;
  results?: { total: number; items: Card[]; moreUrl?: string }[];
  status?: string;
  error?: boolean;
  done?: boolean;
};

const LS = "pd_assistant_v2";
const SEEN = "pd_assistant_seen";
const newId = () => Math.random().toString(36).slice(2, 10);

const GREETING = "Hello! I can help you find a property, check prices in an area, or work out building costs. What would you like to do?";
const START: string[] = ["Buy a property", "Rent a property", "Check prices in an area", "Construction rates and costs"];

/** The reply's text, and the tap-able answers from its last line ("[[A | B | C]]"). */
function splitChoices(text: string): { body: string; choices: string[] } {
  const m = /\n?\s*\[\[([^\]]+)\]\]\s*$/.exec(text);
  if (!m) return { body: text.replace(/\[\[[^\]]*$/, ""), choices: [] };
  return { body: text.slice(0, m.index).trimEnd(), choices: m[1]!.split("|").map((c) => c.trim()).filter(Boolean).slice(0, 6) };
}

/* A small, safe markdown: **bold**, [links](/path), lists. */
function inline(text: string, key: string) {
  const out: React.ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<strong key={`${key}b${i++}`} className="font-semibold">{m[1]}</strong>);
    else {
      const href = m[3]!;
      const internal = href.startsWith("/") && !href.startsWith("//");
      if (internal) out.push(<Link key={`${key}l${i++}`} href={href} className="font-medium text-primary underline underline-offset-2">{m[2]}</Link>);
      else if (/^https?:\/\//.test(href)) out.push(<a key={`${key}l${i++}`} href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-2">{m[2]}</a>);
      else out.push(m[2]);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Markdown({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (!list.length) return;
    blocks.push(
      <ul key={`u${blocks.length}`} className="my-1 list-disc space-y-0.5 pl-5">
        {list.map((it, i) => <li key={i}>{inline(it, `u${blocks.length}${i}`)}</li>)}
      </ul>,
    );
    list = [];
  };
  text.replace(/\r/g, "").split("\n").forEach((raw, i) => {
    const b = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/.exec(raw);
    if (b) return void list.push(b[1]!);
    flush();
    if (raw.trim()) blocks.push(<p key={`p${i}`} className="my-1">{inline(raw.replace(/^#+\s*/, ""), `p${i}`)}</p>);
  });
  flush();
  return <div dir="auto" className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0">{blocks}</div>;
}

function Results({ total, items, moreUrl }: { total: number; items: Card[]; moreUrl?: string }) {
  if (!items.length) return null;
  const shown = items.slice(0, 5);
  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
      {shown.map((c, i) => (
        <Link key={c.id} href={c.url} className={cn("flex gap-3 p-2.5 transition-colors hover:bg-slate-50", i > 0 && "border-t border-slate-100")}>
          <div className="h-[72px] w-[92px] shrink-0 overflow-hidden rounded-lg bg-slate-100">
            {c.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.photo} alt="" loading="lazy" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full place-items-center text-[11px] text-slate-400">No photo</div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 text-[15px] font-bold leading-tight text-slate-900">
              {c.priceText}
              {c.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-sky-500" aria-label="Verified agency" />}
            </p>
            <p className="mt-0.5 line-clamp-1 text-[13.5px] text-slate-700">{c.title}</p>
            <p className="mt-0.5 flex items-center gap-1 text-[12.5px] text-slate-500">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="line-clamp-1">{c.place}</span>
            </p>
            <p className="mt-0.5 text-[12.5px] text-slate-500">{[c.size, c.beds ? `${c.beds} beds` : "", c.baths ? `${c.baths} baths` : ""].filter(Boolean).join(" · ")}</p>
          </div>
        </Link>
      ))}
      {moreUrl && (
        <Link href={moreUrl} className="flex items-center justify-center gap-1.5 border-t border-slate-200 bg-slate-50 px-3 py-2.5 text-[14px] font-semibold text-primary hover:bg-slate-100">
          {total > shown.length ? `See all ${total} results` : "Open these results"}
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

/** The site's own mark (made from its favicon), on white. */
function Avatar({ size = 32 }: { size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center overflow-hidden rounded-full bg-primary" style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/api/push/badge.png" alt="" style={{ width: size * 0.6, height: size * 0.6 }} />
    </span>
  );
}

const ChatIcon = () => (
  <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden fill="currentColor">
    <path d="M12 3C6.48 3 2 6.94 2 11.8c0 2.4 1.1 4.58 2.9 6.17-.15 1.1-.62 2.3-1.67 3.2a.5.5 0 0 0 .3.88c1.95.08 3.6-.6 4.82-1.43A11.6 11.6 0 0 0 12 20.6c5.52 0 10-3.94 10-8.8S17.52 3 12 3Z" />
  </svg>
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

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS) || "[]");
      if (Array.isArray(saved)) setMsgs(saved.filter((m) => m?.role && typeof m.text === "string").map((m) => ({ ...m, status: undefined, done: true })));
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

  // A short greeting beside the button, once, a little after the first visit.
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

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [msgs, open]);

  const update = (id: string, fn: (m: Msg) => Msg) => setMsgs((all) => all.map((m) => (m.id === id ? fn(m) : m)));

  const send = useCallback(
    async (textIn?: string) => {
      const text = (textIn ?? input).trim();
      if (!text || busy) return;
      setInput("");
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
          // The greeting is part of the conversation the model sees, so "Buy a property" makes sense to it.
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
            else if (ev.t === "status") update(reply.id, (m) => ({ ...m, status: ev.text }));
            else if (ev.t === "cards" && ev.cards?.kind === "listings")
              update(reply.id, (m) => ({ ...m, results: [...(m.results || []), { total: ev.cards.total, items: ev.cards.items, moreUrl: ev.cards.moreUrl }] }));
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
  const lastChoices = last?.role === "assistant" && last.done && !busy ? splitChoices(last.text).choices : [];

  return (
    <>
      {/* Launcher. Phones: above the bottom menu; hidden while the chat covers the screen. */}
      <div className={cn("fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-[91] flex items-end gap-3 md:bottom-6 md:right-6", open && "max-sm:hidden")}>
        {teaser && !open && (
          <div className="relative mb-1.5 w-[260px] rounded-xl border border-slate-200 bg-white p-3.5 shadow-[0_8px_30px_-8px_rgba(15,23,42,0.25)]">
            <button type="button" onClick={markSeen} aria-label="Dismiss" className="absolute right-2 top-2 rounded p-0.5 text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setOpen(true)} className="pr-4 text-left">
              <span className="block text-[14px] font-semibold text-slate-900">Looking for a property?</span>
              <span className="mt-0.5 block text-[13.5px] leading-snug text-slate-600">Tell me your budget and area — I&apos;ll show you what&apos;s available.</span>
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
          className="assistant-open fixed inset-0 z-[90] flex flex-col bg-white sm:inset-auto sm:bottom-[100px] sm:right-6 sm:h-[min(640px,calc(100vh-130px))] sm:w-[390px] sm:overflow-hidden sm:rounded-2xl sm:border sm:border-slate-200 sm:shadow-[0_20px_60px_-15px_rgba(15,23,42,0.35)]"
        >
          <div className="flex items-center gap-3 bg-primary px-4 pb-3.5 pt-[max(0.875rem,env(safe-area-inset-top))] text-white">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/15">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/api/push/badge.png" alt="" className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[16px] font-semibold leading-tight">{brand}</p>
              <p className="mt-0.5 text-[13px] text-white/80">Property help · replies instantly</p>
            </div>
            {msgs.length > 0 && (
              <button type="button" onClick={reset} title="Start over" aria-label="Start over" className="grid h-9 w-9 place-items-center rounded-full text-white/85 hover:bg-white/15">
                <RotateCcw className="h-[18px] w-[18px]" />
              </button>
            )}
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full text-white/85 hover:bg-white/15">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div ref={scroller} className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-5 text-[15px] leading-relaxed text-slate-800">
            {/* The greeting is always the first message. */}
            <div className="flex items-end gap-2">
              <Avatar />
              <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-slate-100 px-3.5 py-2.5">{GREETING}</div>
            </div>
            {msgs.length === 0 && (
              <div className="flex flex-col items-stretch gap-2 pl-10">
                {START.map((s) => (
                  <button key={s} type="button" onClick={() => void send(s)} className="rounded-xl border border-primary/40 px-4 py-2.5 text-left text-[15px] font-medium text-primary transition-colors hover:bg-primary hover:text-white">
                    {s}
                  </button>
                ))}
              </div>
            )}

            {msgs.map((m) => {
              if (m.role === "user")
                return (
                  <div key={m.id} className="flex justify-end">
                    <div dir="auto" className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-3.5 py-2.5 text-white">
                      {m.text}
                    </div>
                  </div>
                );
              const { body } = splitChoices(m.text);
              return (
                <div key={m.id} className="flex items-end gap-2">
                  <Avatar />
                  <div className="min-w-0 max-w-[85%] flex-1">
                    {body && (
                      <div className={cn("rounded-2xl rounded-bl-sm bg-slate-100 px-3.5 py-2.5", m.error && "bg-red-50 text-red-800")}>
                        <Markdown text={body} />
                      </div>
                    )}
                    {m.results?.map((r, i) => <Results key={i} {...r} />)}
                    {!m.done && (m.status || !body) && (
                      <div className="mt-1 flex items-center gap-2 rounded-2xl bg-slate-100 px-3.5 py-3 text-[13.5px] text-slate-500" aria-live="polite">
                        <span className="flex gap-1">
                          {[0, 1, 2].map((d) => (
                            <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${d * 0.15}s` }} />
                          ))}
                        </span>
                        {m.status && m.status !== "Typing" && <span>{m.status}…</span>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {lastChoices.length > 0 && (
              <div className="flex flex-wrap gap-2 pl-10">
                {lastChoices.map((c) => (
                  <button key={c} type="button" dir="auto" onClick={() => void send(c)} className="rounded-full border border-primary/40 px-3.5 py-2 text-[14px] font-medium text-primary transition-colors hover:bg-primary hover:text-white">
                    {c}
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
            className="flex items-center gap-2 border-t border-slate-200 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3"
          >
            <input
              ref={box}
              value={input}
              dir="auto"
              maxLength={1500}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message…"
              className="h-11 min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 text-[15px] text-slate-900 outline-none transition focus:border-primary/50 focus:bg-white"
            />
            {busy ? (
              <button type="button" onClick={() => abort.current?.abort()} aria-label="Stop" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-800 text-white">
                <Square className="h-4 w-4 fill-current" />
              </button>
            ) : (
              <button type="submit" disabled={!input.trim()} aria-label="Send" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-white transition disabled:bg-slate-200 disabled:text-slate-400">
                <SendHorizontal className="h-5 w-5" />
              </button>
            )}
          </form>
        </div>
      )}
    </>
  );
}

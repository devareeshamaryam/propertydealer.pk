"use client";

/**
 * The chat button. Drag it up or down along either edge of the screen; let
 * go and it glides to the nearer side and stays there (remembered on this
 * device). It also moves itself above a bar fixed at the bottom of the page
 * (a calculator's sticky answer), and never sits on the phone's bottom menu.
 * "FIND WITH AI" curves round the side away from the edge.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Side = "left" | "right";
const LS = "pd_launcher_pos";

const ChatIcon = ({ small }: { small: boolean }) => (
  <svg viewBox="0 0 24 24" className={small ? "h-6 w-6" : "h-7 w-7"} aria-hidden fill="currentColor">
    <path d="M12 3C6.48 3 2 6.94 2 11.8c0 2.4 1.1 4.58 2.9 6.17-.15 1.1-.62 2.3-1.67 3.2a.5.5 0 0 0 .3.88c1.95.08 3.6-.6 4.82-1.43A11.6 11.6 0 0 0 12 20.6c5.52 0 10-3.94 10-8.8S17.52 3 12 3Z" />
  </svg>
);

export default function Launcher({
  open,
  onToggle,
  teaser,
  onTeaserOpen,
  onTeaserClose,
  onSide,
}: {
  open: boolean;
  onToggle: () => void;
  teaser: boolean;
  onTeaserOpen: () => void;
  onTeaserClose: () => void;
  onSide?: (side: Side) => void;
}) {
  const [small, setSmall] = useState(false);
  const [side, setSide] = useState<Side>("right");
  /** Distance from the bottom of the screen to the bottom of the button, px (null = the default spot). */
  const [fromBottom, setFromBottom] = useState<number | null>(null);
  /** A bar fixed at the bottom of the page (px it takes). */
  const [bar, setBar] = useState(0);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [vh, setVh] = useState(800);
  const [vw, setVw] = useState(400);
  const start = useRef<{ px: number; py: number; ox: number; oy: number; moved: boolean } | null>(null);
  const justDragged = useRef(false);
  const btn = useRef<HTMLButtonElement | null>(null);

  const size = small ? 52 : 60;
  const edge = small ? 14 : 24;
  /** Keep clear of the phone's bottom menu. */
  const floor = small ? 84 : 24;
  const ceiling = small ? 76 : 96;

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => {
      setSmall(mq.matches);
      setVh(window.innerHeight);
      setVw(window.innerWidth);
    };
    sync();
    mq.addEventListener("change", sync);
    window.addEventListener("resize", sync);
    try {
      const saved = JSON.parse(localStorage.getItem(LS) || "null");
      if (saved?.side === "left" || saved?.side === "right") setSide(saved.side);
      if (Number.isFinite(saved?.fromBottom)) setFromBottom(saved.fromBottom);
    } catch {
      /* private mode */
    }
    const onBar = (e: Event) => setBar(Math.max(0, Number((e as CustomEvent).detail) || 0));
    window.addEventListener("pd:bottom-bar", onBar);
    return () => {
      mq.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
      window.removeEventListener("pd:bottom-bar", onBar);
    };
  }, []);

  useEffect(() => onSide?.(side), [side, onSide]);

  /** Where it sits: the chosen spot, kept on screen, above the menu and any bottom bar. */
  const bottomPx = (() => {
    const lowest = Math.max(floor, bar ? bar + 10 : 0);
    const highest = Math.max(lowest, vh - ceiling - size);
    const want = fromBottom ?? floor;
    return Math.min(highest, Math.max(lowest, want));
  })();

  const save = useCallback((s: Side, fb: number) => {
    try {
      localStorage.setItem(LS, JSON.stringify({ side: s, fromBottom: Math.round(fb) }));
    } catch {
      /* private mode */
    }
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    const r = e.currentTarget.getBoundingClientRect();
    start.current = { px: e.clientX, py: e.clientY, ox: e.clientX - r.left, oy: e.clientY - r.top, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const s = start.current;
    if (!s) return;
    if (!s.moved && Math.hypot(e.clientX - s.px, e.clientY - s.py) < 7) return;
    if (!s.moved) {
      s.moved = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    const x = Math.min(window.innerWidth - size, Math.max(0, e.clientX - s.ox));
    const y = Math.min(window.innerHeight - size, Math.max(0, e.clientY - s.oy));
    setDrag({ x, y });
  };
  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const s = start.current;
    start.current = null;
    if (!s?.moved || !drag) return;
    justDragged.current = true;
    setTimeout(() => (justDragged.current = false), 50);
    const nextSide: Side = drag.x + size / 2 < window.innerWidth / 2 ? "left" : "right";
    const fb = window.innerHeight - (drag.y + size);
    setSide(nextSide);
    setFromBottom(fb);
    setDrag(null);
    save(nextSide, fb);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  // While dragging it follows the finger; let go and it glides to its edge (both by left/top, so it animates).
  const restX = side === "left" ? edge : vw - size - edge;
  const restY = vh - bottomPx - size;
  const style: React.CSSProperties = drag
    ? { left: drag.x, top: drag.y, transition: "none" }
    : { left: restX, top: restY, transition: "left 0.4s cubic-bezier(0.2, 0.9, 0.25, 1.15), top 0.4s cubic-bezier(0.2, 0.9, 0.25, 1)" };

  const ring = size + 40;
  const fontSize = small ? 11 : 12;

  return (
    <div className={cn("fixed z-[91]", open && "max-sm:hidden")} style={{ ...style, width: size, height: size }}>
      {/* The note, on the side away from the edge. */}
      {teaser && !open && !drag && (
        <div
          className="absolute bottom-0 w-[min(250px,calc(100vw-110px))] rounded-2xl border border-slate-200 bg-white p-3.5 shadow-[0_8px_30px_-8px_rgba(15,23,42,0.25)]"
          style={side === "left" ? { left: size + 12 } : { right: size + 12 }}
        >
          <button type="button" onClick={onTeaserClose} aria-label="Dismiss" className="absolute right-2 top-2 rounded p-0.5 text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
          <button type="button" onClick={onTeaserOpen} className="pr-4 text-left">
            <span className="block text-[14px] font-semibold text-slate-900">Looking for a property?</span>
            <span className="mt-0.5 block text-[13.5px] leading-snug text-slate-600">Tell us your budget and area — see what&apos;s available right away.</span>
          </button>
        </div>
      )}
      <div className="relative h-full w-full">
        {/* "FIND WITH AI", curving round the side away from the edge. */}
        {!open && (
          <svg
            viewBox="0 0 100 100"
            aria-hidden
            className="pointer-events-none absolute overflow-visible"
            style={{ width: ring, height: ring, left: -20, top: -20 }}
          >
            <defs>
              <path id="pd-chat-ring" d="M 50,87 A 37,37 0 1,1 50,13 A 37,37 0 1,1 50,87" />
            </defs>
            <text className="fill-primary" style={{ fontSize, fontWeight: 800, letterSpacing: 1, paintOrder: "stroke", stroke: "#fff", strokeWidth: 3.5, strokeLinejoin: "round" }}>
              <textPath href="#pd-chat-ring" startOffset={side === "left" ? "62.5%" : "37.5%"} textAnchor="middle">
                FIND WITH AI
              </textPath>
            </text>
          </svg>
        )}
        <button
          ref={btn}
          type="button"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            start.current = null;
            setDrag(null);
          }}
          onClick={() => {
            if (justDragged.current) return;
            onToggle();
          }}
          aria-label={open ? "Close chat" : "Find with AI — drag to move"}
          aria-expanded={open}
          className={cn(
            "relative grid h-full w-full touch-none select-none place-items-center rounded-full bg-primary text-white shadow-[0_6px_24px_-6px_rgba(15,23,42,0.5)] transition-transform",
            drag ? "scale-110 cursor-grabbing shadow-[0_14px_34px_-8px_rgba(15,23,42,0.55)]" : "cursor-pointer hover:scale-[1.04] active:scale-95",
          )}
        >
          {open ? <ChevronDown className={small ? "h-6 w-6" : "h-7 w-7"} /> : <ChatIcon small={small} />}
        </button>
      </div>
    </div>
  );
}

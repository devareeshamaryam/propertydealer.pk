"use client";

import { useMemo, useState } from "react";
import { EyeOff, GripVertical, LayoutTemplate, Megaphone, Plus, RectangleHorizontal, Square, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AD_PAGES, type AdItem, type AdPage, type AdSize, type LayoutPart } from "@/lib/ads";
import { cn } from "@/lib/utils";

/*
 * The ad layout, drawn as the pages really are: each page's sections in
 * order, with a gap between each. Drag a new ad from the right into a gap,
 * drag an ad from one gap to another, or tap + in a gap (phones and
 * keyboards). Click an ad to set its size and ad unit.
 */

const SIZES: { key: AdSize; label: string; hint: string; icon: typeof Square }[] = [
  { key: "auto", label: "Responsive", hint: "Fits the space — best for most gaps", icon: LayoutTemplate },
  { key: "banner", label: "Banner", hint: "Wide and short — between sections", icon: RectangleHorizontal },
  { key: "box", label: "Box", hint: "Square-ish — sidebars", icon: Square },
];

const newId = () => Math.random().toString(36).slice(2, 10);

type Drag = { kind: "new"; size: AdSize } | { kind: "move"; id: string };

export function AdLayoutEditor({
  items,
  onChange,
  show,
  defaultSlot,
  every,
  onEvery,
}: {
  items: AdItem[];
  onChange: (items: AdItem[]) => void;
  /** Homepage section switches: false = hidden on the site. */
  show: Record<string, boolean>;
  defaultSlot: string;
  every: number;
  onEvery: (n: number) => void;
}) {
  const [page, setPage] = useState<AdPage>("home");
  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const layout = AD_PAGES.find((p) => p.key === page)!;
  const zones = useMemo(
    () => [...layout.main, ...(layout.side ?? []), ...(layout.below ?? [])].filter((p): p is Extract<LayoutPart, { type: "zone" }> => p.type === "zone"),
    [layout],
  );
  const counts = useMemo(() => Object.fromEntries(AD_PAGES.map((p) => [p.key, items.filter((a) => a.page === p.key).length])), [items]);
  const sel = items.find((a) => a.id === selected) ?? null;

  const place = (at: string, d: Drag | null) => {
    if (!d) return;
    if (d.kind === "new") {
      const id = newId();
      onChange([...items, { id, page, at, size: d.size }]);
      setSelected(id);
    } else {
      onChange(items.map((a) => (a.id === d.id ? { ...a, page, at } : a)));
      setSelected(d.id);
    }
  };
  const patch = (id: string, p: Partial<AdItem>) => onChange(items.map((a) => (a.id === id ? { ...a, ...p } : a)));
  const remove = (id: string) => {
    onChange(items.filter((a) => a.id !== id));
    if (selected === id) setSelected(null);
  };

  const startDrag = (e: React.DragEvent, d: Drag) => {
    e.dataTransfer.effectAllowed = d.kind === "new" ? "copy" : "move";
    e.dataTransfer.setData("text/plain", JSON.stringify(d));
    setDrag(d);
  };
  const endDrag = () => {
    setDrag(null);
    setOver(null);
  };

  const renderPart = (p: LayoutPart, i: number) => {
    if (p.type === "section") {
      const hidden = p.show ? show[p.show] === false : false;
      return (
        <div
          key={`s-${p.key}-${i}`}
          className={cn(
            "flex items-center justify-between gap-2 rounded-lg px-3 text-[12.5px] font-semibold",
            p.tall ? "h-16" : "h-10",
            hidden ? "border border-dashed border-slate-300 bg-white text-slate-400" : "bg-slate-200/70 text-slate-600",
          )}
        >
          <span className="truncate">{p.label}</span>
          {hidden && (
            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium">
              <EyeOff className="h-3 w-3" /> hidden on site
            </span>
          )}
        </div>
      );
    }
    const here = items.filter((a) => a.page === page && a.at === p.at);
    const active = over === p.at;
    return (
      <div
        key={`z-${p.at}`}
        onDragOver={(e) => {
          if (!drag) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = drag.kind === "new" ? "copy" : "move";
          if (over !== p.at) setOver(p.at);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver((o) => (o === p.at ? null : o));
        }}
        onDrop={(e) => {
          e.preventDefault();
          let d = drag;
          try {
            d = JSON.parse(e.dataTransfer.getData("text/plain")) as Drag;
          } catch {
            // use the state
          }
          place(p.at, d);
          endDrag();
        }}
        className={cn(
          "group rounded-lg border-2 border-dashed transition-colors",
          active ? "border-primary bg-primary/10" : drag ? "border-primary/40 bg-primary/[0.03]" : here.length ? "border-amber-300/70 bg-amber-50/40" : "border-transparent hover:border-slate-200",
          here.length || drag ? "p-1.5" : "px-1.5 py-0.5",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className={cn("truncate text-[11px] font-medium", active ? "text-primary" : "text-slate-400")}>
            {active ? "Drop the ad here" : p.label}
            {p.feed && ` — one every ${every} listings`}
          </span>
          <button
            type="button"
            onClick={() => place(p.at, { kind: "new", size: p.at === "sidebar" ? "box" : "auto" })}
            className="inline-flex h-6 shrink-0 items-center gap-0.5 rounded-md px-1.5 text-[11px] font-semibold text-primary opacity-70 hover:bg-primary/10 hover:opacity-100"
            aria-label={`Add an ad: ${p.label}`}
          >
            <Plus className="h-3.5 w-3.5" /> Ad
          </button>
        </div>
        {here.length > 0 && (
          <div className="mt-1 space-y-1">
            {here.map((a) => (
              <div
                key={a.id}
                draggable
                onDragStart={(e) => startDrag(e, { kind: "move", id: a.id })}
                onDragEnd={endDrag}
                onClick={() => setSelected(a.id)}
                className={cn(
                  "flex cursor-grab items-center gap-2 rounded-md border bg-amber-100 px-2 text-[12px] font-semibold text-amber-900 active:cursor-grabbing",
                  a.size === "box" ? "h-14" : a.size === "banner" ? "h-8" : "h-10",
                  selected === a.id ? "border-primary ring-2 ring-primary/30" : "border-amber-300",
                )}
              >
                <GripVertical className="h-4 w-4 shrink-0 opacity-60" />
                <Megaphone className="h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">
                  Ad · {SIZES.find((s) => s.key === (a.size ?? "auto"))?.label}
                  <span className="font-normal opacity-70"> · {a.slot ? `slot ${a.slot}` : "main ad unit"}</span>
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(a.id);
                  }}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded hover:bg-amber-200"
                  aria-label="Remove this ad"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Pages */}
      <div className="flex flex-wrap gap-1.5">
        {AD_PAGES.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => {
              setPage(p.key);
              setSelected(null);
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors",
              page === p.key ? "border-primary bg-primary text-white" : "border-slate-200 text-slate-700 hover:bg-slate-50",
            )}
          >
            {p.label}
            <span className={cn("rounded px-1.5 text-[11px]", page === p.key ? "bg-white/20" : "bg-slate-100 text-slate-500")}>{counts[p.key]}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        {/* The page, as it is */}
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="flex items-center gap-1.5 border-b bg-slate-50 px-3 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
            <span className="ml-2 truncate text-xs font-medium text-slate-500">{layout.label}</span>
          </div>
          <div className="space-y-1.5 p-3">
            <div className="h-7 rounded-md bg-slate-800/80 px-3 text-[11px] font-semibold leading-7 text-white/80">Header</div>
            {layout.side ? (
              <div className="grid grid-cols-[minmax(0,1fr)_34%] gap-2">
                <div className="space-y-1.5">{layout.main.map(renderPart)}</div>
                <div className="space-y-1.5">{layout.side.map(renderPart)}</div>
              </div>
            ) : (
              <div className="space-y-1.5">{layout.main.map(renderPart)}</div>
            )}
            {layout.below && <div className="space-y-1.5">{layout.below.map(renderPart)}</div>}
            <div className="h-7 rounded-md bg-slate-800/80 px-3 text-[11px] font-semibold leading-7 text-white/80">Footer</div>
          </div>
        </div>

        {/* New ads, and the chosen ad */}
        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-3">
            <p className="text-sm font-semibold">Add an ad</p>
            <p className="mb-2 text-xs text-muted-foreground">Drag one onto a gap on the page — or press “+ Ad” in the gap.</p>
            <div className="space-y-1.5">
              {SIZES.map((s) => (
                <div
                  key={s.key}
                  draggable
                  onDragStart={(e) => startDrag(e, { kind: "new", size: s.key })}
                  onDragEnd={endDrag}
                  className="flex cursor-grab items-center gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2 active:cursor-grabbing"
                >
                  <GripVertical className="h-4 w-4 shrink-0 text-amber-700/60" />
                  <s.icon className="h-4 w-4 shrink-0 text-amber-800" />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-amber-950">{s.label}</span>
                    <span className="block text-[11px] text-amber-900/70">{s.hint}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {page === "archive" && (
            <label className="flex items-center justify-between gap-2 rounded-xl border bg-white p-3 text-sm">
              <span className="font-medium">Inside the listings: one ad every</span>
              <Input
                type="number"
                min={3}
                max={24}
                value={every}
                onChange={(e) => onEvery(Math.min(24, Math.max(3, Number(e.target.value) || 6)))}
                className="h-9 w-16"
              />
            </label>
          )}

          <div className="rounded-xl border bg-white p-3">
            {sel ? (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold">
                    This ad
                    <span className="block text-xs font-normal text-muted-foreground">
                      {AD_PAGES.find((p) => p.key === sel.page)?.label} · {zones.find((z) => z.at === sel.at)?.label ?? sel.at}
                    </span>
                  </p>
                  <Button variant="ghost" size="icon" onClick={() => remove(sel.id)} aria-label="Remove this ad">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Shape</p>
                  <div className="grid grid-cols-3 gap-1">
                    {SIZES.map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => patch(sel.id, { size: s.key })}
                        className={cn(
                          "rounded-md border px-1 py-1.5 text-xs font-semibold",
                          (sel.size ?? "auto") === s.key ? "border-primary bg-primary text-white" : "border-slate-200 hover:bg-slate-50",
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Ad unit (slot)</p>
                  <Input
                    value={sel.slot ?? ""}
                    inputMode="numeric"
                    placeholder={defaultSlot ? `Main unit — ${defaultSlot}` : "Ad slot"}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 20);
                      patch(sel.id, v ? { slot: v } : { slot: undefined });
                    }}
                    className="h-9"
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Move to</p>
                  <select
                    value={sel.at}
                    onChange={(e) => patch(sel.id, { at: e.target.value })}
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  >
                    {zones.map((z) => (
                      <option key={z.at} value={z.at}>
                        {z.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Click an ad on the page to change its shape, ad unit or place.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

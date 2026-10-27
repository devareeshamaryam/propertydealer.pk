"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, MapPin, X } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * A city picker you can type into — "mul" finds Multan — instead of scrolling
 * a long <select>. The same in every form that asks for a city: search,
 * sign-up, the account, listings, the dashboard. Keyboard: ↑ ↓ to move,
 * Enter to choose, Esc to close.
 */

export interface PickerOption {
  value: string;
  label: string;
}

export function CityPicker({
  options,
  value,
  onChange,
  placeholder = "Search city",
  allLabel,
  disabled,
  id,
  className,
  inputClassName,
  ariaLabel = "City",
  icon = true,
  clearable,
}: {
  options: PickerOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** An option for "no city" at the top — "All cities", "Any city". */
  allLabel?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  /** Replaces the input's look, to match the form it sits in. */
  inputClassName?: string;
  ariaLabel?: string;
  icon?: boolean;
  /** Show an × to clear the choice. */
  clearable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();
  const chosen = options.find((o) => o.value === value);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const found = term
      ? [
          ...options.filter((o) => o.label.toLowerCase().startsWith(term)),
          ...options.filter((o) => !o.label.toLowerCase().startsWith(term) && o.label.toLowerCase().includes(term)),
        ]
      : options;
    return allLabel && !term ? [{ value: "", label: allLabel }, ...found] : found;
  }, [options, q, allLabel]);

  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-i="${hi}"]`)?.scrollIntoView({ block: "nearest" });
  }, [hi]);

  const pick = (v: string) => {
    onChange(v);
    setQ("");
    setOpen(false);
  };

  return (
    <div ref={box} className={cn("relative", className)}>
      {icon && <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />}
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        autoComplete="off"
        disabled={disabled}
        value={open ? q : chosen?.label ?? (value ? value : "")}
        placeholder={chosen ? chosen.label : allLabel && !value ? allLabel : placeholder}
        onFocus={() => {
          setOpen(true);
          setHi(0);
        }}
        onClick={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setHi(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setHi((h) => Math.min(rows.length - 1, h + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHi((h) => Math.max(0, h - 1));
          } else if (e.key === "Enter") {
            if (open && rows[hi]) {
              e.preventDefault();
              pick(rows[hi]!.value);
            }
          } else if (e.key === "Escape") {
            setOpen(false);
            setQ("");
          }
        }}
        className={cn(
          inputClassName ??
            "h-11 w-full rounded-lg border border-slate-300 bg-white pr-9 text-[14px] text-slate-900 outline-none transition-colors placeholder:text-slate-500 hover:border-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-slate-50",
          icon ? "pl-9" : "pl-3",
          "pr-9",
        )}
      />
      {clearable && value && !open ? (
        <button
          type="button"
          aria-label="Clear city"
          onClick={() => pick("")}
          className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        >
          <X className="h-4 w-4" />
        </button>
      ) : (
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      )}
      {open && !disabled && (
        <ul
          ref={list}
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-[90] max-h-[280px] min-w-[200px] overflow-y-auto rounded-lg border border-slate-300 bg-white py-1 shadow-xl"
        >
          {rows.length === 0 && <li className="px-3 py-4 text-center text-[13.5px] text-slate-600">No city named &ldquo;{q.trim()}&rdquo;</li>}
          {rows.map((o, i) => (
            <li key={o.value || "__all"} role="option" aria-selected={o.value === value}>
              <button
                type="button"
                data-i={i}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(o.value);
                }}
                onMouseEnter={() => setHi(i)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-[14px]",
                  i === hi ? "bg-slate-100" : "",
                  o.value === "" ? "font-semibold text-primary" : "text-slate-900",
                )}
              >
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
                {o.value === value && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

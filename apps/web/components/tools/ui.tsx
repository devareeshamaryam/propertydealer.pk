'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Minus, Plus, Share2 } from 'lucide-react';
import { rsShort } from '@/lib/tools';
import { cn } from '@/lib/utils';

/*
 * The tools' own kit. Plain and solid: white panels with a clear border,
 * dark readable text, one strong brand colour for what is chosen and for the
 * answer — no glows, gradients or see-through layers. Every tool is built
 * from these, so they all look and behave alike.
 */

/** A panel: a title bar (when given) over its content. */
export function Card({
  title,
  action,
  children,
  className,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('overflow-hidden rounded-xl border border-slate-300 bg-white', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
          {title && <h2 className="text-[16px] font-bold text-slate-900">{title}</h2>}
          {action && <span className="text-[13px] font-medium text-slate-600">{action}</span>}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

/** A row of options, the chosen one filled in the brand colour. */
export function Segment<T extends string | number>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { v: T; label: string; sub?: string }[];
  label?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && <p className="mb-2 text-[14px] font-semibold text-slate-800">{label}</p>}
      <div
        className="grid overflow-hidden rounded-lg border border-slate-400"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
        role="radiogroup"
        aria-label={label}
      >
        {options.map((o, i) => {
          const on = o.v === value;
          return (
            <button
              key={String(o.v)}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.v)}
              className={cn(
                'min-h-[46px] px-1.5 py-2 text-center transition-colors',
                i > 0 && 'border-l border-slate-400',
                on ? 'bg-primary text-white' : 'bg-white text-slate-800 hover:bg-slate-100',
              )}
            >
              <span className="block truncate text-[14px] font-bold leading-tight">{o.label}</span>
              {o.sub && <span className={cn('mt-0.5 block truncate text-[12px] leading-tight', on ? 'text-white' : 'text-slate-600')}>{o.sub}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** – n + */
export function Stepper({ label, value, onChange, min = 0, max = 20, sub }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number; sub?: string }) {
  const btn = 'grid h-10 w-10 place-items-center rounded-lg border border-slate-400 bg-white text-slate-900 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40';
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5">
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold text-slate-900">{label}</span>
        {sub && <span className="block text-[13px] text-slate-600">{sub}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} className={btn} aria-label={`Less: ${label}`}>
          <Minus className="h-4 w-4" strokeWidth={2.5} />
        </button>
        <span className="w-8 text-center text-[18px] font-bold tabular-nums text-slate-900">{value}</span>
        <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} className={btn} aria-label={`More: ${label}`}>
          <Plus className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </span>
    </div>
  );
}

/**
 * A number with a slider under it — drag for a quick answer, or type an
 * exact one in the box.
 */
export function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  hint,
  format,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  hint?: React.ReactNode;
  /** How the ends of the slider read (e.g. "5%"). */
  format?: (n: number) => string;
}) {
  const [text, setText] = useState(String(value));
  if (Number(text) !== value && text !== '' && !text.endsWith('.')) setText(String(value));
  const pct = max > min ? ((Math.min(max, Math.max(min, value)) - min) / (max - min)) * 100 : 0;
  const f = format ?? ((n: number) => `${n}${suffix ? ` ${n === 1 && suffix === 'yrs' ? 'yr' : suffix}` : ''}`);
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label className="text-[14px] font-semibold text-slate-800">{label}</label>
        <span className="flex items-center gap-1 rounded-lg border border-slate-400 bg-white px-2.5 py-1.5 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
          <input
            type="number"
            inputMode="decimal"
            value={text}
            min={min}
            max={max}
            step={step}
            aria-label={label}
            onChange={(e) => {
              setText(e.target.value);
              const n = Number(e.target.value);
              if (e.target.value !== '' && Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
            }}
            onBlur={() => setText(String(value))}
            className="w-16 bg-transparent text-right text-[16px] font-bold tabular-nums text-slate-900 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
          {suffix && <span className="text-[14px] font-semibold text-slate-700">{suffix}</span>}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={Math.min(max, Math.max(min, value))}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={`${label} slider`}
        className="tool-range mt-3.5 h-2 w-full cursor-pointer appearance-none rounded-full"
        style={{ background: `linear-gradient(to right, var(--primary) ${pct}%, #cbd5e1 ${pct}%)` }}
      />
      <div className="mt-1.5 flex justify-between gap-2 text-[12.5px] font-medium text-slate-600">
        <span>{f(min)}</span>
        {hint ? <span className="text-center font-semibold text-slate-800">{hint}</span> : null}
        <span>{f(max)}</span>
      </div>
    </div>
  );
}

/** Rupees: typed with or without commas, read back in lakh / crore, with quick picks. */
export function MoneyField({
  label,
  value,
  onChange,
  chips = [],
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  chips?: number[];
  hint?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-[14px] font-semibold text-slate-800">{label}</label>
      <div className="flex items-center gap-2 rounded-lg border border-slate-400 bg-white px-3.5 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
        <span className="text-[16px] font-bold text-slate-600">Rs</span>
        <input
          inputMode="numeric"
          value={value ? value.toLocaleString('en-PK') : ''}
          onChange={(e) => onChange(Number(e.target.value.replace(/[^\d]/g, '').slice(0, 13)) || 0)}
          placeholder="0"
          aria-label={label}
          className="h-[52px] min-w-0 flex-1 bg-transparent text-[20px] font-bold tabular-nums text-slate-900 outline-none placeholder:text-slate-400"
        />
        {value > 0 && <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-[13px] font-bold text-slate-900">{rsShort(value).replace('Rs ', '')}</span>}
      </div>
      {chips.length > 0 && (
        <div className="hide-scrollbar -mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1">
          {chips.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              className={cn(
                'shrink-0 rounded-md border px-3 py-1.5 text-[13px] font-semibold transition-colors',
                value === c ? 'border-primary bg-primary text-white' : 'border-slate-300 bg-white text-slate-800 hover:border-slate-500',
              )}
            >
              {rsShort(c).replace('Rs ', '')}
            </button>
          ))}
        </div>
      )}
      {hint && <p className="mt-1.5 text-[13px] text-slate-600">{hint}</p>}
    </div>
  );
}

/** The answer: a solid brand-colour band with the figure, details beneath on white. */
export function ResultHero({
  label,
  value,
  sub,
  children,
  heroRef,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  children?: React.ReactNode;
  heroRef?: React.Ref<HTMLElement>;
}) {
  return (
    <section ref={heroRef} className="overflow-hidden rounded-xl border border-primary bg-white">
      <div className="bg-primary px-4 py-4 text-white sm:px-5">
        <p className="text-[14px] font-semibold text-white">{label}</p>
        <p className="mt-0.5 text-[34px] font-extrabold leading-tight tabular-nums [overflow-wrap:anywhere] sm:text-[40px]">{value}</p>
        {sub && <p className="mt-0.5 text-[15px] font-medium leading-relaxed text-white">{sub}</p>}
      </div>
      {children && <div className="p-3 sm:p-4">{children}</div>}
    </section>
  );
}

/** Small figures: white boxes with a border. */
export function Tiles({ items }: { items: { label: string; value: string; hint?: string }[]; onBrand?: boolean }) {
  return (
    <dl className={cn('grid gap-2', items.length === 2 ? 'grid-cols-2' : items.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3')}>
      {items.map((t) => (
        <div key={t.label} className="rounded-lg border border-slate-300 bg-white px-2 py-2.5 text-center">
          <dt className="text-[12.5px] font-semibold text-slate-600">{t.label}</dt>
          <dd className="mt-0.5 text-[16px] font-bold tabular-nums text-slate-900 [overflow-wrap:anywhere]">{t.value}</dd>
          {t.hint && <p className="text-[12px] text-slate-600">{t.hint}</p>}
        </div>
      ))}
    </dl>
  );
}

/** A row of a list: label (and a note) on the left, the figure on the right. */
export function Row({ label, value, note, strong }: { label: React.ReactNode; value: React.ReactNode; note?: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-3">
      <span className="min-w-0">
        <span className={cn('block text-[15px]', strong ? 'font-bold text-slate-900' : 'font-medium text-slate-800')}>{label}</span>
        {note && <span className="block text-[13px] text-slate-600">{note}</span>}
      </span>
      <span className={cn('shrink-0 text-right tabular-nums text-slate-900', strong ? 'text-[17px] font-extrabold' : 'text-[15px] font-bold')}>{value}</span>
    </div>
  );
}

/** Opens on tap — long tables and the finer options. */
export function Disclosure({ title, sub, children, defaultOpen = false }: { title: string; sub?: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="overflow-hidden rounded-xl border border-slate-300 bg-white">
      <button type="button" onClick={() => setOpen((v) => !v)} className={cn('flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-slate-50', open && 'border-b border-slate-200')} aria-expanded={open}>
        <span className="min-w-0">
          <span className="block text-[16px] font-bold text-slate-900">{title}</span>
          {sub && <span className="block text-[13px] text-slate-600">{sub}</span>}
        </span>
        <ChevronDown className={cn('h-5 w-5 shrink-0 text-slate-700 transition-transform', open && 'rotate-180')} strokeWidth={2.5} />
      </button>
      <div className={cn('p-4', open ? 'block' : 'hidden print:block')}>{children}</div>
    </section>
  );
}

/** True while the element is on screen. */
export function useOnScreen<T extends Element>() {
  const ref = useRef<T | null>(null);
  const [on, setOn] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setOn(!!e?.isIntersecting), { rootMargin: '-64px 0px 0px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, on] as const;
}

/**
 * The answer, kept in sight on a phone: a bar under the site header once the
 * answer has scrolled away (tap it to jump back).
 */
export function StickyAnswer({ show, label, value, onTap }: { show: boolean; label: string; value: string; onTap?: () => void }) {
  return (
    <button
      type="button"
      onClick={onTap}
      aria-hidden={!show}
      tabIndex={show ? 0 : -1}
      className={cn(
        'fixed inset-x-0 top-16 z-40 flex items-center justify-between gap-3 border-b-2 border-black/10 bg-primary px-4 py-2.5 text-left text-white transition-transform duration-200 lg:hidden print:hidden',
        show ? 'translate-y-0' : 'pointer-events-none -translate-y-full',
      )}
    >
      <span className="truncate text-[13.5px] font-semibold text-white">{label}</span>
      <span className="shrink-0 text-[18px] font-extrabold tabular-nums">{value}</span>
    </button>
  );
}

/** Two columns on a desktop (inputs | answer), one on a phone. */
export function ToolLayout({ inputs, results }: { inputs: React.ReactNode; results: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:items-start lg:gap-6">
      <div className="space-y-4 lg:sticky lg:top-20">{inputs}</div>
      <div className="min-w-0 space-y-4">{results}</div>
    </div>
  );
}

/** Share this tool (the phone's share sheet), or copy its link. */
export function ShareButton({ title }: { title: string }) {
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title, url });
      else {
        await navigator.clipboard.writeText(url);
        const { toast } = await import('sonner');
        toast.success('Link copied');
      }
    } catch {
      // Share sheet dismissed.
    }
  };
  return (
    <button
      type="button"
      onClick={share}
      className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-slate-400 bg-white px-3 text-[14px] font-semibold text-slate-800 hover:bg-slate-100 print:hidden"
    >
      <Share2 className="h-4 w-4" />
      <span className="hidden sm:inline">Share</span>
    </button>
  );
}

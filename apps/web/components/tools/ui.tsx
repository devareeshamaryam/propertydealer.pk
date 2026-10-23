'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Minus, Plus, Share2 } from 'lucide-react';
import { rsShort } from '@/lib/tools';
import { cn } from '@/lib/utils';

/*
 * The tools' own small app kit — big touch targets, one idea per card, the
 * answer always in sight. Every tool is built from these, so they all look
 * and behave alike.
 */

/** A rounded card with an optional title row. */
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
    <section className={cn('rounded-3xl bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_10px_30px_-18px_rgba(15,23,42,0.25)] ring-1 ring-slate-200/70 sm:p-5', className)}>
      {(title || action) && (
        <header className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="text-[16px] font-bold tracking-tight text-slate-900">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

/** iOS-style segmented control. */
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
      {label && <p className="mb-1.5 text-[13px] font-semibold text-slate-500">{label}</p>}
      <div className="grid gap-1 rounded-2xl bg-slate-100 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }} role="radiogroup" aria-label={label}>
        {options.map((o) => {
          const on = o.v === value;
          return (
            <button
              key={String(o.v)}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.v)}
              className={cn(
                'min-h-[40px] rounded-xl px-1.5 py-1.5 text-center transition-all',
                on ? 'bg-white text-slate-900 shadow-[0_1px_3px_rgba(15,23,42,0.15)]' : 'text-slate-500 hover:text-slate-800',
              )}
            >
              <span className="block truncate text-[13.5px] font-bold leading-tight">{o.label}</span>
              {o.sub && <span className={cn('block truncate text-[11px] leading-tight', on ? 'text-slate-500' : 'text-slate-400')}>{o.sub}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** – n + */
export function Stepper({ label, value, onChange, min = 0, max = 20, sub }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number; sub?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3.5 py-2.5">
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold text-slate-800">{label}</span>
        {sub && <span className="block text-[12px] text-slate-500">{sub}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} className="grid h-9 w-9 place-items-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 disabled:opacity-40" aria-label={`Less: ${label}`}>
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-7 text-center text-[17px] font-bold tabular-nums text-slate-900">{value}</span>
        <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} className="grid h-9 w-9 place-items-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 disabled:opacity-40" aria-label={`More: ${label}`}>
          <Plus className="h-4 w-4" />
        </button>
      </span>
    </div>
  );
}

/**
 * A number with a slider under it — drag for a quick answer, or tap the
 * number and type an exact one.
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
        <label className="text-[14px] font-semibold text-slate-700">{label}</label>
        <span className="flex items-center gap-1 rounded-xl bg-slate-50 px-2.5 py-1 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-primary/40">
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
            className="w-16 bg-transparent text-right text-[15px] font-bold tabular-nums text-slate-900 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
          {suffix && <span className="text-[13px] font-semibold text-slate-500">{suffix}</span>}
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
        className="tool-range mt-3 h-2 w-full cursor-pointer appearance-none rounded-full"
        style={{ background: `linear-gradient(to right, var(--primary) ${pct}%, #e2e8f0 ${pct}%)` }}
      />
      <div className="mt-1 flex justify-between text-[11.5px] text-slate-400">
        <span>{f(min)}</span>
        {hint ? <span className="text-center text-slate-500">{hint}</span> : null}
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
      <label className="mb-1.5 block text-[14px] font-semibold text-slate-700">{label}</label>
      <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3.5 ring-1 ring-slate-200 focus-within:bg-white focus-within:ring-2 focus-within:ring-primary/40">
        <span className="text-[15px] font-bold text-slate-400">Rs</span>
        <input
          inputMode="numeric"
          value={value ? value.toLocaleString('en-PK') : ''}
          onChange={(e) => onChange(Number(e.target.value.replace(/[^\d]/g, '').slice(0, 13)) || 0)}
          placeholder="0"
          aria-label={label}
          className="h-[52px] min-w-0 flex-1 bg-transparent text-[20px] font-bold tabular-nums text-slate-900 outline-none"
        />
        {value > 0 && <span className="shrink-0 text-[13px] font-bold text-primary">{rsShort(value).replace('Rs ', '')}</span>}
      </div>
      {chips.length > 0 && (
        <div className="hide-scrollbar -mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1">
          {chips.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              className={cn(
                'shrink-0 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors',
                value === c ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              {rsShort(c).replace('Rs ', '')}
            </button>
          ))}
        </div>
      )}
      {hint && <p className="mt-1.5 text-[12.5px] text-slate-500">{hint}</p>}
    </div>
  );
}

/** The answer, in the brand colour. */
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
    <section ref={heroRef} className="overflow-hidden rounded-3xl bg-primary p-5 text-white shadow-[0_18px_40px_-20px_var(--primary)] sm:p-6">
      <p className="text-[13px] font-semibold text-white/75">{label}</p>
      <p className="mt-0.5 text-[34px] font-extrabold leading-tight tracking-tight tabular-nums [overflow-wrap:anywhere] sm:text-[40px]">{value}</p>
      {sub && <p className="mt-1 text-[14.5px] leading-relaxed text-white/85">{sub}</p>}
      {children}
    </section>
  );
}

/** Small figures under the answer: white-on-brand inside a hero, or grey tiles. */
export function Tiles({ items, onBrand }: { items: { label: string; value: string; hint?: string }[]; onBrand?: boolean }) {
  return (
    <dl className={cn('grid gap-2', items.length === 2 ? 'grid-cols-2' : items.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3', onBrand && 'mt-4')}>
      {items.map((t) => (
        <div key={t.label} className={cn('rounded-2xl px-2.5 py-2.5 text-center', onBrand ? 'bg-white/12 ring-1 ring-white/15' : 'bg-slate-50')}>
          <dt className={cn('text-[11.5px] font-medium', onBrand ? 'text-white/70' : 'text-slate-500')}>{t.label}</dt>
          <dd className={cn('text-[15px] font-bold tabular-nums [overflow-wrap:anywhere]', onBrand ? 'text-white' : 'text-slate-900')}>{t.value}</dd>
          {t.hint && <p className={cn('text-[11px]', onBrand ? 'text-white/60' : 'text-slate-400')}>{t.hint}</p>}
        </div>
      ))}
    </dl>
  );
}

/** A row of a list: label (and a note) on the left, the figure on the right. */
export function Row({ label, value, note, strong }: { label: React.ReactNode; value: React.ReactNode; note?: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5">
      <span className="min-w-0">
        <span className={cn('block text-[14px]', strong ? 'font-bold text-slate-900' : 'text-slate-600')}>{label}</span>
        {note && <span className="block text-[12px] text-slate-400">{note}</span>}
      </span>
      <span className={cn('shrink-0 text-right tabular-nums', strong ? 'text-[16px] font-extrabold text-slate-900' : 'text-[14.5px] font-semibold text-slate-900')}>{value}</span>
    </div>
  );
}

/** Opens on tap — long tables and the finer options. */
export function Disclosure({ title, sub, children, defaultOpen = false }: { title: string; sub?: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-3xl bg-white ring-1 ring-slate-200/70">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left sm:px-5" aria-expanded={open}>
        <span className="min-w-0">
          <span className="block text-[15px] font-bold text-slate-900">{title}</span>
          {sub && <span className="block text-[12.5px] text-slate-500">{sub}</span>}
        </span>
        <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 transition-transform', open && 'rotate-180')}>
          <ChevronDown className="h-4 w-4 text-slate-600" />
        </span>
      </button>
      <div className={cn('px-4 pb-4 sm:px-5', open ? 'block' : 'hidden print:block')}>{children}</div>
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
 * The answer, kept in sight on a phone: a slim bar under the site header
 * once the answer card has scrolled away (tap it to jump back).
 */
export function StickyAnswer({ show, label, value, onTap }: { show: boolean; label: string; value: string; onTap?: () => void }) {
  return (
    <button
      type="button"
      onClick={onTap}
      aria-hidden={!show}
      tabIndex={show ? 0 : -1}
      className={cn(
        'fixed inset-x-3 top-[72px] z-40 flex items-center justify-between gap-3 rounded-2xl bg-primary px-4 py-2.5 text-left text-white shadow-lg transition-all duration-200 lg:hidden print:hidden',
        show ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-3 opacity-0',
      )}
    >
      <span className="truncate text-[12.5px] font-semibold text-white/80">{label}</span>
      <span className="shrink-0 text-[17px] font-extrabold tabular-nums">{value}</span>
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
    <button type="button" onClick={share} aria-label="Share" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-700 transition-colors hover:bg-slate-200 print:hidden">
      <Share2 className="h-[18px] w-[18px]" />
    </button>
  );
}

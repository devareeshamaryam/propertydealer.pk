'use client';

import { useState } from 'react';
import { amountShort } from '@/lib/pk';
import { cn } from '@/lib/utils';

export const inputCls =
  'h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-[16px] tabular-nums text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20';

/** A rupee amount, typed with or without commas, read back in lakh / crore. */
export function MoneyField({ id, label, value, onChange, hint }: { id: string; label: string; value: number; onChange: (n: number) => void; hint?: string }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-slate-600">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] font-semibold text-slate-400">Rs</span>
        <input
          id={id}
          inputMode="numeric"
          value={value ? value.toLocaleString('en-PK') : ''}
          onChange={(e) => onChange(Number(e.target.value.replace(/[^\d]/g, '')) || 0)}
          className={cn(inputCls, 'pl-10')}
          placeholder="0"
        />
      </div>
      <p className="mt-1 min-h-4 text-[12px] text-slate-500">{value > 0 ? amountShort(value) : hint}</p>
    </div>
  );
}

/** A number with its unit after it: 15 %, 20 years. */
export function NumberField({
  id,
  label,
  value,
  onChange,
  suffix,
  min = 0,
  max,
  step = 'any',
  hint,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (n: number) => void;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number | 'any';
  hint?: string;
}) {
  // What is typed ("1.", "") can differ from the number it means.
  const [text, setText] = useState(String(value));
  if (Number(text) !== value && !(text === '' && value === min)) setText(String(value));
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-slate-600">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const n = Number(e.target.value);
            onChange(Number.isFinite(n) ? Math.max(min, max !== undefined ? Math.min(max, n) : n) : min);
          }}
          className={cn(inputCls, suffix && 'pr-16')}
        />
        {suffix && <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[14px] text-slate-400">{suffix}</span>}
      </div>
      {hint && <p className="mt-1 text-[12px] text-slate-500">{hint}</p>}
    </div>
  );
}

export function Stat({ label, value, sub, strong }: { label: string; value: string; sub?: string; strong?: boolean }) {
  return (
    <div className={cn('rounded-xl p-3 sm:p-4', strong ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white')}>
      <p className={cn('text-[12px] font-semibold', strong ? 'text-white/60' : 'text-slate-500')}>{label}</p>
      <p className={cn('mt-0.5 font-extrabold tabular-nums [overflow-wrap:anywhere]', strong ? 'text-[24px] sm:text-[28px]' : 'text-[19px] text-slate-900')}>{value}</p>
      {sub && <p className={cn('text-[12px]', strong ? 'text-white/70' : 'text-slate-500')}>{sub}</p>}
    </div>
  );
}

export function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn('rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5', className)}>{children}</section>;
}

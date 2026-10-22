'use client';

import { useState } from 'react';
import { Check, Ruler } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DISPLAY_UNITS, type DisplayUnit } from '@/lib/area-units';
import { cn } from '@/lib/utils';
import { useAreaUnit } from './AreaUnitProvider';

const SHORT: Record<DisplayUnit, string> = { auto: 'Unit', sqft: 'Sq ft', sqyd: 'Sq yd', sqm: 'Sq m', marla: 'Marla', kanal: 'Kanal' };

/**
 * "Select your preferred area unit" — in the header on a desktop, in the menu
 * on a phone. Every size on the site follows it.
 */
export default function AreaUnitPicker({ variant = 'icon', onDone }: { variant?: 'icon' | 'row'; onDone?: () => void }) {
  const { unit, setUnit } = useAreaUnit();
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<DisplayUnit>(unit);

  const openIt = () => {
    setPick(unit);
    setOpen(true);
  };

  return (
    <>
      {variant === 'icon' ? (
        <button
          type="button"
          onClick={openIt}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13.5px] font-medium text-slate-700 hover:bg-slate-100"
          aria-label="Area unit"
          title="Show sizes in…"
        >
          <Ruler className="h-4 w-4" />
          <span>{SHORT[unit]}</span>
        </button>
      ) : (
        <button type="button" onClick={openIt} className="flex w-full items-center justify-between px-4 py-2.5 text-left text-[15px] text-slate-800 hover:bg-slate-50">
          <span className="inline-flex items-center gap-2">
            <Ruler className="h-4 w-4 text-slate-500" /> Area unit
          </span>
          <span className="text-[13px] font-semibold text-primary">{DISPLAY_UNITS.find((u) => u.key === unit)?.label}</span>
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[20px]">Select your preferred area unit</DialogTitle>
            <DialogDescription>Every size on the site is shown in it. A marla is the one in each listing&apos;s city.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5">
            {DISPLAY_UNITS.map((u) => {
              const on = pick === u.key;
              return (
                <button
                  key={u.key}
                  type="button"
                  onClick={() => setPick(u.key)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-xl border px-4 py-3.5 text-left transition-colors',
                    on ? 'border-primary/40 bg-primary/5' : 'border-slate-200 hover:bg-slate-50',
                  )}
                  aria-pressed={on}
                >
                  <span>
                    <span className={cn('block text-[15.5px]', on ? 'font-bold text-slate-900' : 'text-slate-800')}>{u.label}</span>
                    {u.hint && <span className="block text-[12px] text-slate-500">{u.hint}</span>}
                  </span>
                  <span className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-md border-2', on ? 'border-primary bg-primary text-white' : 'border-slate-300')}>
                    {on && <Check className="h-4 w-4" strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button type="button" onClick={() => setOpen(false)} className="btn-shape h-12 rounded-xl border border-slate-300 text-[16px] font-medium text-slate-800 hover:bg-slate-50">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setUnit(pick);
                setOpen(false);
                onDone?.();
              }}
              className="btn-shape h-12 rounded-xl bg-primary text-[16px] font-bold text-white hover:bg-primary/90"
            >
              Apply
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

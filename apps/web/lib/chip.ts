import { cn } from '@/lib/utils';

/**
 * The filter chips on results pages — locations, property types, sizes, a
 * society's phases. One look for all of them, and the corners follow the
 * admin's button shape (Settings → Appearance), like every other button.
 */
export function chipClass(selected: boolean, className?: string) {
  return cn(
    'btn-shape inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap border px-3 text-[13px] font-medium transition-colors',
    selected ? 'border-primary bg-primary/10 text-primary' : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400',
    className,
  );
}

'use client';

import { createContext, useCallback, useContext, useSyncExternalStore } from 'react';
import { DISPLAY_UNITS, sizeIn, type DisplayUnit, type SizedListing } from '@/lib/area-units';

/*
 * The visitor's "show sizes in" choice (header → area unit), kept in this
 * browser. Pages are cached and the same for everyone, so the server renders
 * sizes as listed and the browser switches to the visitor's unit at once.
 */

const KEY = 'pd-area-unit';
const EVENT = 'pd-area-unit';

const valid = (v: string | null): v is DisplayUnit => !!v && DISPLAY_UNITS.some((u) => u.key === v);

function read(): DisplayUnit {
  try {
    const v = localStorage.getItem(KEY);
    return valid(v) ? v : 'auto';
  } catch {
    return 'auto'; // Private mode / blocked storage: sizes simply show as listed.
  }
}

function subscribe(onChange: () => void) {
  // Another tab, or this one.
  const onStorage = (e: StorageEvent) => e.key === KEY && onChange();
  window.addEventListener('storage', onStorage);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(EVENT, onChange);
  };
}

const Ctx = createContext<{ unit: DisplayUnit; setUnit: (u: DisplayUnit) => void }>({ unit: 'auto', setUnit: () => undefined });

export function AreaUnitProvider({ children }: { children: React.ReactNode }) {
  const unit = useSyncExternalStore(subscribe, read, () => 'auto' as DisplayUnit);

  const setUnit = useCallback((u: DisplayUnit) => {
    try {
      localStorage.setItem(KEY, u);
    } catch {
      // ignore
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return <Ctx.Provider value={{ unit, setUnit }}>{children}</Ctx.Provider>;
}

export function useAreaUnit() {
  return useContext(Ctx);
}

/** A listing's size in the visitor's unit. */
export function useSize(p: SizedListing, style: 'long' | 'short' = 'long') {
  const { unit } = useAreaUnit();
  return sizeIn(p, unit, style);
}

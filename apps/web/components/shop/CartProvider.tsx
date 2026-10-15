'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CartItem, ShopProduct } from '@/lib/shop';

/*
 * One cart for the whole materials shop, kept in the browser.
 *
 * It used to be cement-only and mounted on the cement page alone, so a bag
 * added there vanished on any other page. It now lives in the site layout, so
 * the header's cart button can show it everywhere. Carts saved by the old
 * version ("cement_cart") are carried over once.
 */

const STORAGE_KEY = 'pd_cart_v2';
const LEGACY_KEY = 'cement_cart';

interface CartContextValue {
  items: CartItem[];
  count: number;
  subTotal: number;
  ready: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
  add: (product: ShopProduct, quantity?: number) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  quantityOf: (key: string) => number;
}

const CartContext = createContext<CartContextValue | null>(null);

export const cartKey = (p: { type: string; id: string }) => `${p.type}:${p.id}`;

function readStored(): CartItem[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const old = JSON.parse(legacy) as Array<Record<string, any>>;
      localStorage.removeItem(LEGACY_KEY);
      return old.map((i) => ({
        key: `cement:${i.id}`,
        type: 'cement',
        id: String(i.id),
        title: `${i.brand} — ${i.weightKg ?? 50} kg bag`,
        brand: i.brand,
        unit: `${i.weightKg ?? 50} kg bag`,
        city: i.city ?? '',
        price: Number(i.price) || 0,
        image: i.image ?? '',
        href: `/today-cement-rate-in-pakistan/${i.slug ?? ''}`,
        quantity: Number(i.quantity) || 1,
      }));
    }
  } catch {
    // Storage blocked or corrupt — start empty.
  }
  return [];
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);

  // localStorage only exists in the browser, so the saved cart loads after mount.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(readStored());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Private mode: the cart still works for this visit.
    }
  }, [items, ready]);

  const add = useCallback((p: ShopProduct, quantity = 1) => {
    const key = cartKey(p);
    setItems((prev) => {
      const existing = prev.find((i) => i.key === key);
      if (existing) return prev.map((i) => (i.key === key ? { ...i, quantity: i.quantity + quantity, price: p.price } : i));
      return [
        ...prev,
        {
          key, type: p.type, id: p.id, title: p.title, brand: p.brand, unit: p.unit, city: p.city,
          price: p.price, image: p.image, href: p.href, quantity,
        },
      ];
    });
  }, []);

  const setQuantity = useCallback((key: string, quantity: number) => {
    setItems((prev) =>
      quantity < 1 ? prev.filter((i) => i.key !== key) : prev.map((i) => (i.key === key ? { ...i, quantity } : i)),
    );
  }, []);

  const remove = useCallback((key: string) => setItems((prev) => prev.filter((i) => i.key !== key)), []);
  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((s, i) => s + i.quantity, 0);
    const subTotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    return {
      items, count, subTotal, ready, open, setOpen, add, setQuantity, remove, clear,
      quantityOf: (key: string) => items.find((i) => i.key === key)?.quantity ?? 0,
    };
  }, [items, ready, open, add, setQuantity, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}

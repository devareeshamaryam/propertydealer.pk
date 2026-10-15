'use client';

import Link from 'next/link';
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useCart } from '@/components/shop/CartProvider';
import { useSiteSettings } from '@/components/SiteSettingsProvider';
import { imageSrc, rs } from '@/lib/shop';
import { cn } from '@/lib/utils';

/** The cart icon in the header. Hidden until something is in the cart. */
export function CartButton({ className }: { className?: string }) {
  const { count, ready, setOpen } = useCart();
  const { shopEnabled } = useSiteSettings();
  if (!ready || count === 0 || !shopEnabled) return null;
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label={`Cart, ${count} items`}
      className={cn('relative grid h-9 w-9 place-items-center rounded-xl text-slate-700 hover:bg-slate-100', className)}
    >
      <ShoppingBag className="h-5 w-5" />
      <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
        {count > 99 ? '99+' : count}
      </span>
    </button>
  );
}

/** The cart drawer, mounted once in the site layout. */
export default function CartSheet() {
  const { items, count, subTotal, open, setOpen, setQuantity, remove } = useCart();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <div className="border-b px-5 py-4">
          <SheetTitle className="text-[17px] font-bold">Your cart</SheetTitle>
          <p className="text-[13px] text-slate-500">{count} {count === 1 ? 'item' : 'items'}</p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-16 text-center text-slate-500">
              <ShoppingBag className="h-10 w-10 text-slate-300" />
              <p className="font-medium text-slate-700">Your cart is empty</p>
              <p className="text-sm">Add cement, steel, bricks and more from today&apos;s rates.</p>
              <Link href="/today-cement-rate-in-pakistan" onClick={() => setOpen(false)} className="mt-2 text-sm font-semibold text-primary hover:underline">
                Browse materials
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {items.map((item) => (
                <li key={item.key} className="flex gap-3 py-3">
                  <Link href={item.href} onClick={() => setOpen(false)} className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-50 ring-1 ring-slate-200">
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imageSrc(item.image)} alt="" className="h-full w-full object-contain p-1" />
                    ) : (
                      <span className="text-sm font-bold text-slate-400">{item.brand.slice(0, 2).toUpperCase()}</span>
                    )}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={item.href} onClick={() => setOpen(false)} className="line-clamp-2 text-[14px] font-semibold leading-snug text-slate-900 hover:text-primary">
                      {item.title}
                    </Link>
                    <p className="text-[12px] text-slate-500">
                      {item.unit}{item.city ? ` · ${item.city}` : ''} · {rs(item.price)}
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center rounded-lg ring-1 ring-slate-200">
                        <button type="button" aria-label="Less" onClick={() => setQuantity(item.key, item.quantity - 1)} className="grid h-8 w-8 place-items-center text-slate-600 hover:text-slate-900">
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <input
                          aria-label="Quantity"
                          inputMode="numeric"
                          value={item.quantity}
                          onChange={(e) => {
                            const n = parseInt(e.target.value.replace(/\D/g, ''), 10);
                            if (Number.isFinite(n)) setQuantity(item.key, Math.min(100000, n));
                          }}
                          className="h-8 w-12 border-x border-slate-200 text-center text-[13px] font-semibold outline-none"
                        />
                        <button type="button" aria-label="More" onClick={() => setQuantity(item.key, item.quantity + 1)} className="grid h-8 w-8 place-items-center text-slate-600 hover:text-slate-900">
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-bold text-slate-900">{rs(item.price * item.quantity)}</span>
                        <button type="button" aria-label="Remove" onClick={() => remove(item.key)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="space-y-3 border-t bg-slate-50/60 px-5 py-4">
            <div className="flex items-center justify-between text-[15px]">
              <span className="text-slate-600">Subtotal</span>
              <span className="text-lg font-bold text-slate-900">{rs(subTotal)}</span>
            </div>
            <p className="text-[12px] text-slate-500">Delivery is worked out at checkout. Prices are today&apos;s rates and are confirmed when you order.</p>
            <Link
              href="/today-cement-rate-in-pakistan/checkout"
              onClick={() => setOpen(false)}
              className="flex h-12 w-full items-center justify-center rounded-xl bg-primary text-[15px] font-semibold text-white hover:bg-primary/90 btn-shape"
            >
              Checkout
            </Link>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

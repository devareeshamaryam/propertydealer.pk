'use client';

import Link from 'next/link';
import { Check, Minus, Plus, ShoppingBag, TrendingDown, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { cartKey, useCart } from '@/components/shop/CartProvider';
import { useSiteSettings } from '@/components/SiteSettingsProvider';
import { imageSrc, rs, type ShopProduct } from '@/lib/shop';
import { cn } from '@/lib/utils';

/** Today's change against yesterday, the way rate boards show it. */
export function PriceChange({ change, className }: { change: number; className?: string }) {
  if (!change) return <span className={cn('text-[11.5px] font-medium text-slate-400', className)}>No change</span>;
  const up = change > 0;
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[11.5px] font-semibold', up ? 'text-red-600' : 'text-emerald-600', className)}>
      {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      {up ? '+' : '−'}Rs {Math.abs(change).toLocaleString('en-PK')}
    </span>
  );
}

export function ProductImage({ product, className }: { product: ShopProduct; className?: string }) {
  const src = imageSrc(product.image);
  return (
    <div className={cn('grid place-items-center overflow-hidden bg-gradient-to-b from-slate-50 to-slate-100', className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={product.title} loading="lazy" className="h-full w-full object-contain p-2" />
      ) : (
        <span className="text-center">
          <span className="block text-2xl font-black tracking-tight text-slate-300">{product.brand.slice(0, 2).toUpperCase()}</span>
          <span className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400">{product.unit}</span>
        </span>
      )}
    </div>
  );
}

/** Add / quantity control, shared by the card and the product page. */
export function AddToCart({ product, size = 'sm', className }: { product: ShopProduct; size?: 'sm' | 'lg'; className?: string }) {
  const { add, quantityOf, setQuantity, setOpen } = useCart();
  const { shopEnabled } = useSiteSettings();
  const key = cartKey(product);
  const qty = quantityOf(key);
  const h = size === 'lg' ? 'h-12 text-[15px]' : 'h-9 text-[13px]';

  if (!shopEnabled) return null;

  if (qty > 0) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className={cn('flex flex-1 items-center justify-between rounded-xl bg-primary/10 text-primary', h)}>
          <button type="button" aria-label="Less" onClick={() => setQuantity(key, qty - 1)} className="grid h-full w-9 place-items-center">
            <Minus className="h-4 w-4" />
          </button>
          <span className="font-bold tabular-nums">{qty}</span>
          <button type="button" aria-label="More" onClick={() => setQuantity(key, qty + 1)} className="grid h-full w-9 place-items-center">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        {size === 'lg' && (
          <button type="button" onClick={() => setOpen(true)} className={cn('inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 font-semibold text-white', h)}>
            <Check className="h-4 w-4" /> View cart
          </button>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        add(product, 1);
        toast.success('Added to cart', {
          description: product.title,
          action: { label: 'View cart', onClick: () => setOpen(true) },
        });
      }}
      className={cn('inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary font-semibold text-white transition-colors hover:bg-primary/90', h, className)}
    >
      <ShoppingBag className="h-4 w-4" />
      Add to cart
    </button>
  );
}

export default function ProductCard({ product, view = 'grid' }: { product: ShopProduct; view?: 'grid' | 'list' }) {
  if (view === 'list') {
    return (
      <article className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-2.5 transition-colors hover:border-slate-300 sm:gap-4">
        <Link href={product.href} className="shrink-0">
          <ProductImage product={product} className="h-20 w-20 rounded-xl sm:h-24 sm:w-24" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{product.category || product.unit}</p>
          <Link href={product.href} className="line-clamp-2 text-[14px] font-semibold leading-snug text-slate-900 hover:text-primary">
            {product.title}
          </Link>
          <p className="text-[12px] text-slate-500">{product.unit}{product.city ? ` · ${product.city}` : ''}</p>
        </div>
        <div className="w-32 shrink-0 space-y-1.5 text-right sm:w-40">
          <p className="text-[17px] font-extrabold text-slate-900">{rs(product.price)}</p>
          <PriceChange change={product.change} />
          <AddToCart product={product} />
        </div>
      </article>
    );
  }

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-colors hover:border-slate-300">
      <Link href={product.href} className="relative block">
        <ProductImage product={product} className="aspect-square w-full" />
        {product.category && (
          <span className="absolute left-2 top-2 rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200">
            {product.category}
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-2.5 sm:p-3">
        <Link href={product.href} className="line-clamp-2 text-[13.5px] font-semibold leading-snug text-slate-900 group-hover:text-primary">
          {product.title}
        </Link>
        <p className="mt-0.5 text-[12px] text-slate-500">{product.unit}{product.city ? ` · ${product.city}` : ''}</p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <p className="text-[17px] font-extrabold leading-none text-slate-900">{rs(product.price)}</p>
          <PriceChange change={product.change} />
        </div>
        <AddToCart product={product} className="mt-2.5" />
      </div>
    </article>
  );
}

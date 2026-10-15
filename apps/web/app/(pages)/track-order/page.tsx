'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Check, Loader2, PackageSearch, X } from 'lucide-react';
import { ORDER_STATUS_LABEL, rs, shopApi, type PublicOrder } from '@/lib/shop';
import { cn } from '@/lib/utils';

/*
 * "Where is my order?" — by order number and the phone it was placed with,
 * no account needed. Both must match, so a guessed order number shows
 * nothing.
 */

const STEPS = ['PENDING', 'CONFIRMED', 'OUT_FOR_DELIVERY', 'DELIVERED'];

function TrackOrder() {
  const params = useSearchParams();
  const [number, setNumber] = useState(params.get('number') ?? '');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<PublicOrder | null>(null);

  const lookUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      setOrder(await shopApi.track(number.trim(), phone.trim()));
    } catch (err: any) {
      setOrder(null);
      setError(err?.response?.data?.message || 'Could not find that order.');
    } finally {
      setLoading(false);
    }
  };

  const cancelled = order?.status === 'CANCELLED';
  const reached = order
    ? Math.max(
        0,
        STEPS.indexOf(order.status === 'PROCESSING' ? 'CONFIRMED' : order.status === 'COMPLETED' ? 'DELIVERED' : order.status),
      )
    : 0;

  return (
    <div className="bg-slate-50 py-8">
      <div className="container mx-auto max-w-xl px-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <PackageSearch className="h-8 w-8 text-primary" />
          <h1 className="mt-2 text-[22px] font-bold text-slate-900">Track your order</h1>
          <p className="text-[14px] text-slate-600">Enter the order number from your confirmation and the phone number you ordered with.</p>
          <form onSubmit={lookUp} className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input value={number} onChange={(e) => setNumber(e.target.value.toUpperCase())} placeholder="PD-261015-1234" required className="h-11 rounded-xl border border-slate-200 px-3.5 text-[14.5px] outline-none focus:border-primary" />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03XX XXXXXXX" inputMode="tel" required className="h-11 rounded-xl border border-slate-200 px-3.5 text-[14.5px] outline-none focus:border-primary" />
            <button type="submit" disabled={loading} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-semibold text-white disabled:opacity-60">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Track
            </button>
          </form>
          {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[13.5px] text-red-700">{error}</p>}
        </div>

        {order && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[18px] font-bold tracking-wide text-slate-900">{order.orderNumber}</p>
              <p className="text-[13px] text-slate-500">
                Placed {new Date(order.createdAt).toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
              </p>
            </div>

            {cancelled ? (
              <p className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 px-3.5 py-3 font-semibold text-red-700">
                <X className="h-5 w-5" /> This order was cancelled.
              </p>
            ) : (
              <ol className="mt-5 grid grid-cols-4 gap-1">
                {STEPS.map((step, i) => (
                  <li key={step} className="flex flex-col items-center text-center">
                    <span className={cn('grid h-8 w-8 place-items-center rounded-full text-[13px] font-bold', i <= reached ? 'bg-primary text-white' : 'bg-slate-100 text-slate-400')}>
                      {i < reached || order.status === 'DELIVERED' || order.status === 'COMPLETED' ? <Check className="h-4 w-4" /> : i + 1}
                    </span>
                    <span className={cn('mt-1.5 text-[11.5px] font-medium leading-tight', i <= reached ? 'text-slate-900' : 'text-slate-400')}>
                      {ORDER_STATUS_LABEL[step]}
                    </span>
                  </li>
                ))}
              </ol>
            )}

            <ul className="mt-5 divide-y divide-slate-100 text-[14px]">
              {order.items.map((i, idx) => (
                <li key={idx} className="flex justify-between gap-3 py-2">
                  <span className="text-slate-700">{i.quantity} × {i.title}</span>
                  <span className="shrink-0 font-semibold">{rs(i.price * i.quantity)}</span>
                </li>
              ))}
              <li className="flex justify-between py-2 text-slate-600"><span>Delivery</span><span>{order.deliveryCharges ? rs(order.deliveryCharges) : 'Free'}</span></li>
              <li className="flex justify-between py-2 text-[16px] font-bold"><span>Total</span><span>{rs(order.total)}</span></li>
            </ul>
            <p className="mt-2 text-[13px] text-slate-500">Delivering to: {order.address}{order.customerCity ? `, ${order.customerCity}` : ''}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TrackOrderPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-slate-400">Loading…</div>}>
      <TrackOrder />
    </Suspense>
  );
}

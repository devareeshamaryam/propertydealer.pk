'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ChevronLeft, Loader2, MessageCircle, PackageSearch, ShieldCheck, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/auth-context';
import { useCart } from '@/components/shop/CartProvider';
import { useSiteSettings } from '@/components/SiteSettingsProvider';
import { resolved, waDigits } from '@/lib/site-settings';
import { imageSrc, rs, shopApi, type PublicOrder } from '@/lib/shop';
import { cn } from '@/lib/utils';

/*
 * Checkout for the materials shop.
 *
 * The old page posted the buyer's name and address without the cart — no
 * items, no totals — so the API rejected every order, and it demanded an
 * account first. This one takes guests, sends what is in the cart (type, id,
 * quantity only; the server prices it), shows delivery and minimum-order
 * rules from Settings → Shop before the button is pressed, and ends on an
 * order number the buyer can track and a one-tap WhatsApp confirmation.
 */

const inputCls =
  'h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-[14.5px] outline-none transition-colors placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/15';

export default function CheckoutPage() {
  const { user } = useAuth();
  const { items, subTotal, ready, clear } = useCart();
  const settings = useSiteSettings();
  const site = resolved(settings);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [payment, setPayment] = useState<'cod' | 'bank'>(settings.shopCodEnabled ? 'cod' : 'bank');
  const [placing, setPlacing] = useState(false);
  const [order, setOrder] = useState<PublicOrder | null>(null);

  // Prefill from the account, when there is one; never required.
  useEffect(() => {
    if (user?.name && !name) setName(user.name);
    if (user?.email && !email) setEmail(user.email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const freeDelivery = settings.shopFreeDeliveryOver > 0 && subTotal >= settings.shopFreeDeliveryOver;
  const delivery = freeDelivery ? 0 : settings.shopDeliveryFee;
  const total = subTotal + delivery;
  const belowMin = settings.shopMinOrder > 0 && subTotal < settings.shopMinOrder;
  const cities = useMemo(() => [...new Set(items.map((i) => i.city).filter(Boolean))], [items]);

  useEffect(() => {
    if (!city && cities.length === 1) setCity(cities[0]!);
  }, [cities, city]);

  const placeOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !address.trim()) {
      toast.error('Please fill in your name, phone and delivery address.');
      return;
    }
    setPlacing(true);
    try {
      const placed = await shopApi.placeOrder({
        customerName: name,
        customerPhone: phone,
        customerEmail: email,
        customerCity: city,
        address,
        deliveryInstruction: note,
        paymentMethod: payment,
        items: items.map((i) => ({ type: i.type, id: i.id, quantity: i.quantity })),
      });
      setOrder(placed);
      clear();
      window.scrollTo({ top: 0 });
    } catch (err: any) {
      toast.error('Could not place the order', {
        description: err?.response?.data?.message || 'Please check your details and try again.',
      });
    } finally {
      setPlacing(false);
    }
  };

  // ── Order placed ──
  if (order) {
    const whatsapp = settings.shopWhatsapp || site.whatsapp;
    const text = encodeURIComponent(`Hi, I just placed order ${order.orderNumber} (${rs(order.total)}). Please confirm delivery.`);
    return (
      <div className="bg-slate-50 py-10">
        <div className="container mx-auto max-w-xl px-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
            <h1 className="mt-3 text-[22px] font-bold text-slate-900">Order placed</h1>
            <p className="mt-1 text-slate-600">Thank you, {order.customerName}. Our team will call you shortly to confirm.</p>
            <div className="mx-auto mt-4 inline-block rounded-xl bg-slate-50 px-5 py-3">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">Order number</p>
              <p className="text-[22px] font-extrabold tracking-wider text-slate-900">{order.orderNumber}</p>
            </div>
            <ul className="mt-5 divide-y divide-slate-100 text-left text-[14px]">
              {order.items.map((i, idx) => (
                <li key={idx} className="flex justify-between gap-3 py-2">
                  <span className="text-slate-700">{i.quantity} × {i.title}</span>
                  <span className="shrink-0 font-semibold">{rs(i.price * i.quantity)}</span>
                </li>
              ))}
              <li className="flex justify-between py-2 text-slate-600"><span>Delivery</span><span>{order.deliveryCharges ? rs(order.deliveryCharges) : 'Free'}</span></li>
              <li className="flex justify-between py-2 text-[16px] font-bold"><span>Total</span><span>{rs(order.total)}</span></li>
            </ul>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <a href={`https://wa.me/${waDigits(whatsapp)}?text=${text}`} target="_blank" rel="noopener noreferrer" className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#25D366] font-semibold text-white">
                <MessageCircle className="h-4 w-4" /> Confirm on WhatsApp
              </a>
              <Link href={`/track-order?number=${order.orderNumber}`} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 font-semibold text-slate-800 hover:bg-slate-50">
                <PackageSearch className="h-4 w-4" /> Track this order
              </Link>
            </div>
            <Link href="/today-cement-rate-in-pakistan" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">Continue shopping</Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Empty cart ──
  if (ready && items.length === 0) {
    return (
      <div className="bg-slate-50 py-16">
        <div className="container mx-auto max-w-md px-4 text-center">
          <h1 className="text-xl font-bold text-slate-900">Your cart is empty</h1>
          <p className="mt-1 text-slate-600">Add materials from today&apos;s rates to place an order.</p>
          <Link href="/today-cement-rate-in-pakistan" className="mt-5 inline-flex h-11 items-center rounded-xl bg-primary px-5 font-semibold text-white">Browse materials</Link>
          <p className="mt-4 text-sm text-slate-500">Already ordered? <Link href="/track-order" className="font-medium text-primary hover:underline">Track your order</Link></p>
        </div>
      </div>
    );
  }

  if (!settings.shopEnabled) {
    return (
      <div className="bg-slate-50 py-16">
        <div className="container mx-auto max-w-md px-4 text-center">
          <h1 className="text-xl font-bold text-slate-900">Online ordering is paused</h1>
          <p className="mt-1 text-slate-600">Please call <a href={site.phoneHref} className="font-semibold text-primary">{site.phone}</a> to order.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 pb-12 pt-5">
      <div className="container mx-auto px-3 sm:px-4">
        <Link href="/today-cement-rate-in-pakistan" className="inline-flex items-center gap-1 text-[13px] font-medium text-slate-600 hover:text-primary">
          <ChevronLeft className="h-4 w-4" /> Continue shopping
        </Link>
        <h1 className="mt-2 text-[24px] font-bold tracking-tight text-slate-900">Checkout</h1>

        <form onSubmit={placeOrder} className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-8">
          <div className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="mb-4 text-[16px] font-bold text-slate-900">Your details</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[13px] font-medium text-slate-700">Full name *</span>
                  <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required maxLength={80} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[13px] font-medium text-slate-700">Mobile number *</span>
                  <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" inputMode="tel" placeholder="03XX XXXXXXX" required maxLength={20} />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-[13px] font-medium text-slate-700">Email <span className="font-normal text-slate-400">(optional)</span></span>
                  <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={120} />
                </label>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="mb-4 text-[16px] font-bold text-slate-900">Delivery</h2>
              <div className="grid gap-3">
                <label className="block">
                  <span className="mb-1 block text-[13px] font-medium text-slate-700">City</span>
                  <input className={inputCls} value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Multan" maxLength={60} list="checkout-cities" />
                  <datalist id="checkout-cities">{cities.map((c) => <option key={c} value={c} />)}</datalist>
                </label>
                <label className="block">
                  <span className="mb-1 block text-[13px] font-medium text-slate-700">Full delivery address *</span>
                  <textarea className={cn(inputCls, 'h-auto py-2.5')} rows={3} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="House / plot number, street, block, society" required maxLength={300} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[13px] font-medium text-slate-700">Notes for delivery <span className="font-normal text-slate-400">(optional)</span></span>
                  <textarea className={cn(inputCls, 'h-auto py-2.5')} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Best time to deliver, landmark, unloading help…" maxLength={500} />
                </label>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="mb-3 text-[16px] font-bold text-slate-900">Payment</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {settings.shopCodEnabled && (
                  <PayOption checked={payment === 'cod'} onSelect={() => setPayment('cod')} title="Cash on delivery" text="Pay when the material reaches your site." />
                )}
                <PayOption checked={payment === 'bank'} onSelect={() => setPayment('bank')} title="Bank transfer / JazzCash" text="We share the account details on the confirmation call." />
              </div>
            </section>
          </div>

          {/* Summary */}
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="mb-3 text-[16px] font-bold text-slate-900">Order summary</h2>
              <ul className="max-h-[320px] divide-y divide-slate-100 overflow-y-auto">
                {items.map((i) => (
                  <li key={i.key} className="flex gap-3 py-2.5">
                    <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-50 ring-1 ring-slate-200">
                      {i.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={imageSrc(i.image)} alt="" className="h-full w-full object-contain p-0.5" />
                      ) : (
                        <span className="text-xs font-bold text-slate-400">{i.brand.slice(0, 2).toUpperCase()}</span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-1 text-[13.5px] font-medium text-slate-900">{i.title}</span>
                      <span className="block text-[12px] text-slate-500">{i.quantity} × {rs(i.price)}</span>
                    </span>
                    <span className="shrink-0 text-[13.5px] font-semibold">{rs(i.price * i.quantity)}</span>
                  </li>
                ))}
              </ul>
              <dl className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-[14px]">
                <div className="flex justify-between text-slate-600"><dt>Subtotal</dt><dd>{rs(subTotal)}</dd></div>
                <div className="flex justify-between text-slate-600">
                  <dt>Delivery</dt>
                  <dd>{delivery ? rs(delivery) : settings.shopDeliveryFee || freeDelivery ? 'Free' : 'Confirmed on call'}</dd>
                </div>
                <div className="flex justify-between pt-1 text-[17px] font-bold text-slate-900"><dt>Total</dt><dd>{rs(total)}</dd></div>
              </dl>
              {settings.shopFreeDeliveryOver > 0 && !freeDelivery && (
                <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-800">
                  Add {rs(settings.shopFreeDeliveryOver - subTotal)} more for free delivery.
                </p>
              )}
              {belowMin && (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
                  The minimum order is {rs(settings.shopMinOrder)}.
                </p>
              )}
              {settings.shopOrderNote && <p className="mt-2 text-[12.5px] text-slate-500">{settings.shopOrderNote}</p>}
              <button
                type="submit"
                disabled={placing || belowMin || !ready}
                className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-[15px] font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                {placing && <Loader2 className="h-4 w-4 animate-spin" />}
                Place order · {rs(total)}
              </button>
              <ul className="mt-4 space-y-1.5 text-[12.5px] text-slate-500">
                <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Prices are today&apos;s rates, confirmed on the call</li>
                <li className="flex items-center gap-2"><Truck className="h-4 w-4 text-emerald-600" /> Delivered to your site</li>
              </ul>
            </div>
          </aside>
        </form>
      </div>
    </div>
  );
}

function PayOption({ checked, onSelect, title, text }: { checked: boolean; onSelect: () => void; title: string; text: string }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn('rounded-xl border p-3.5 text-left transition-colors', checked ? 'border-primary bg-primary/5 ring-2 ring-primary/15' : 'border-slate-200 hover:border-slate-300')}
    >
      <span className="flex items-center gap-2 text-[14px] font-semibold text-slate-900">
        <span className={cn('grid h-4 w-4 place-items-center rounded-full border-2', checked ? 'border-primary' : 'border-slate-300')}>
          {checked && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
        </span>
        {title}
      </span>
      <span className="mt-1 block pl-6 text-[12.5px] text-slate-500">{text}</span>
    </button>
  );
}

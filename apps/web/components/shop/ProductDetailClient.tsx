'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Clock, MapPin, MessageCircle, PackageCheck, Phone, ShieldCheck, Truck } from 'lucide-react';
import api from '@/lib/api';
import ProductCard, { AddToCart, PriceChange, ProductImage } from '@/components/shop/ProductCard';
import { useSiteSettings } from '@/components/SiteSettingsProvider';
import { resolved, waDigits } from '@/lib/site-settings';
import { imageSrc, rs, typeMeta, type ShopProduct } from '@/lib/shop';
import { useMaterialTypes } from '@/components/MaterialTypesProvider';
import { cn } from '@/lib/utils';

/*
 * A material's own page: photos, today's price and its change, a quantity
 * and add-to-cart, how delivery works, the description, and more of the same
 * material underneath. Shared by cement and every other material, so each
 * of the eight product pages looks and behaves the same.
 */

export default function ProductDetailClient({
  product,
  images = [],
  description,
}: {
  product: ShopProduct;
  images?: string[];
  description?: string | null;
}) {
  const settings = useSiteSettings();
  const site = resolved(settings);
  const meta = typeMeta(product.type, useMaterialTypes());
  const gallery = [product.image, ...images].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
  const [active, setActive] = useState(0);
  const [related, setRelated] = useState<ShopProduct[]>([]);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/shop/products', { params: { type: product.type } })
      .then((res) => {
        if (cancelled) return;
        const list = (res.data?.data ?? []) as ShopProduct[];
        setRelated(list.filter((p) => p.id !== product.id).slice(0, 8));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [product.type, product.id]);

  const whatsapp = settings.shopWhatsapp || site.whatsapp;
  // Same text on the server and in the browser (window.location here broke hydration).
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://propertydealer.pk').replace(/\/$/, '');
  const waText = encodeURIComponent(`Hi, I'd like to order ${product.title} (${product.unit}) at ${rs(product.price)}. ${siteUrl}${product.href}`);
  const updated = product.updatedAt
    ? new Date(product.updatedAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <div className="bg-slate-50 pb-12">
      <div className="container mx-auto px-4 pt-3 sm:pt-4">
        <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1 text-[12.5px] text-slate-500">
          <Link href="/" className="hover:text-primary">Home</Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <Link href={meta.path} className="hover:text-primary">{meta.label} rates</Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="line-clamp-1 text-slate-700">{product.brand}</span>
        </nav>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-8">
          {/* Photos */}
          <div>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {gallery.length > 0 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageSrc(gallery[active])} alt={product.title} className="aspect-square w-full object-contain p-6 sm:aspect-[4/3]" />
              ) : (
                <ProductImage product={product} className="aspect-square w-full sm:aspect-[4/3]" />
              )}
            </div>
            {gallery.length > 1 && (
              <div className="hide-scrollbar mt-2 flex gap-2 overflow-x-auto">
                {gallery.map((src, i) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setActive(i)}
                    className={cn('h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-white', i === active ? 'border-primary' : 'border-transparent ring-1 ring-slate-200')}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageSrc(src)} alt="" className="h-full w-full object-contain p-1" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Buy box */}
          <div className="lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-primary">{product.category || meta.single}</p>
              <h1 className="mt-1 text-[24px] font-bold leading-snug tracking-tight text-slate-900 sm:text-[28px]">{product.title}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-slate-500">
                <span>{product.unit}</span>
                {product.city && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{product.city}</span>}
                {updated && <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />Updated {updated}</span>}
              </p>

              <div className="mt-4 flex items-end justify-between rounded-xl bg-slate-50 p-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Today&apos;s rate</p>
                  <p className="text-[30px] font-extrabold leading-none tracking-tight text-slate-900">{rs(product.price)}</p>
                  <p className="mt-1 text-[12px] text-slate-500">{product.unit}</p>
                </div>
                <PriceChange change={product.change} className="text-[13px]" />
              </div>

              <div className="mt-4">
                <AddToCart product={product} size="lg" />
              </div>
              <a
                href={`https://wa.me/${waDigits(whatsapp)}?text=${waText}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#25D366] font-semibold text-[#128C7E] hover:bg-[#25D366]/5 btn-shape"
              >
                <MessageCircle className="h-4 w-4" /> Order on WhatsApp
              </a>
              <a href={site.phoneHref} className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-medium text-slate-600 hover:bg-slate-50">
                <Phone className="h-4 w-4" /> Call {site.phone}
              </a>

              <ul className="mt-4 space-y-2.5 border-t border-slate-100 pt-4 text-[13px] text-slate-600">
                <li className="flex items-start gap-2.5"><Truck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {settings.shopFreeDeliveryOver > 0
                    ? `Free delivery on orders over ${rs(settings.shopFreeDeliveryOver)}`
                    : settings.shopDeliveryFee > 0 ? `Delivery ${rs(settings.shopDeliveryFee)} per order` : 'Delivery charges confirmed on the call'}
                </li>
                <li className="flex items-start gap-2.5"><PackageCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{settings.shopCodEnabled ? 'Cash on delivery available' : 'Bank transfer before dispatch'}</li>
                <li className="flex items-start gap-2.5"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />We call to confirm every order before it is dispatched</li>
              </ul>
            </div>
          </div>
        </div>

        {description && (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-lg font-bold text-slate-900">About {product.brand}</h2>
            <div className="prose prose-sm max-w-none leading-relaxed text-slate-700 prose-headings:text-slate-900 prose-a:text-primary" dangerouslySetInnerHTML={{ __html: description }} />
          </section>
        )}

        {related.length > 0 && (
          <section className="mt-8">
            <div className="mb-3 flex items-end justify-between">
              <h2 className="text-lg font-bold text-slate-900">More {meta.label.toLowerCase()}</h2>
              <Link href={meta.path} className="text-[13.5px] font-semibold text-primary hover:underline">All {meta.label.toLowerCase()} rates</Link>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
              {related.map((p) => <ProductCard key={`${p.type}-${p.id}`} product={p} />)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

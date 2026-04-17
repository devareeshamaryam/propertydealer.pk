 'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  TrendingUp, TrendingDown,
  Minus, Package, ChevronLeft, ChevronRight,
  Shield, Truck, BadgeCheck, Clock, Facebook, Mail, Linkedin, Phone,
} from 'lucide-react';

interface CementRate {
  _id: string;
  brand: string;
  slug: string;
  title?: string;
  price: number;
  change?: number;
  weightKg?: number;
  category?: string;
  image?: string;
  images?: string[];
  description?: string;
  isActive?: boolean;
}

function getImageUrl(image?: string): string | undefined {
  if (!image) return undefined;
  if (image.startsWith('http://') || image.startsWith('https://')) return image;
  return image.startsWith('/') ? image : `/${image}`;
}

function getAllImages(rate: CementRate): string[] {
  const all: string[] = [];
  if (rate.image) all.push(rate.image);
  if (rate.images?.length) {
    rate.images.forEach(img => { if (!all.includes(img)) all.push(img); });
  }
  return all.map(img => getImageUrl(img)!).filter(Boolean);
}

function XIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.745l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.91-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function WhatsAppIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.845L0 24l6.335-1.528A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.006-1.374l-.36-.214-3.724.898.915-3.628-.234-.372A9.818 9.818 0 0112 2.182c5.425 0 9.818 4.393 9.818 9.818 0 5.426-4.393 9.818-9.818 9.818z" />
    </svg>
  );
}

const MAX_QTY        = 10;
const CONTACT_NUMBER = '923052736792';
const CALL_NUMBER    = '+92 305 2736792';

export default function CementDetailClient({ rate }: { rate: CementRate }) {
  const [qty, setQty]             = useState(1);
  const [activeImg, setActiveImg] = useState(0);
  const [pageUrl, setPageUrl]     = useState('');
  const images = getAllImages(rate);

  useEffect(() => { setPageUrl(window.location.href); }, []);

  const prevImg = () => setActiveImg(i => (i - 1 + images.length) % images.length);
  const nextImg = () => setActiveImg(i => (i + 1) % images.length);

  const shareTitle = encodeURIComponent(`${rate.brand} — Rs ${rate.price} | PropertyDealer.pk`);
  const shareUrl   = encodeURIComponent(pageUrl);

  const shareLinks = [
    { label: 'Facebook', icon: <Facebook size={13} />, href: `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}` },
    { label: 'X',        icon: <XIcon size={13} />,    href: `https://twitter.com/intent/tweet?text=${shareTitle}&url=${shareUrl}` },
    { label: 'Email',    icon: <Mail size={13} />,     href: `mailto:?subject=${shareTitle}&body=${shareUrl}` },
    { label: 'LinkedIn', icon: <Linkedin size={13} />, href: `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}` },
    { label: 'WhatsApp', icon: <WhatsAppIcon size={13} />, href: `https://wa.me/?text=${shareTitle}%20${shareUrl}` },
  ];

  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const PriceChange = ({ change }: { change?: number }) => {
    if (!change || change === 0)
      return <span className="flex items-center gap-1 text-gray-400 text-xs"><Minus className="w-3 h-3" /> No change today</span>;
    if (change > 0)
      return <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium"><TrendingUp className="w-3 h-3" /> +Rs {change} today</span>;
    return <span className="flex items-center gap-1 text-red-500 text-xs font-medium"><TrendingDown className="w-3 h-3" /> Rs {change} today</span>;
  };

  return (
    <div className="pt-24 bg-white min-h-screen">
      <div className="max-w-6xl mx-auto px-3 py-5">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 text-xs text-gray-400 mb-4">
          <Link href="/" className="hover:text-black transition-colors">Home</Link>
          <span>/</span>
          <Link href="/today-cement-rate-in-pakistan" className="hover:text-black transition-colors">Cement Rates</Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">{rate.brand}</span>
        </nav>

        <div className="grid lg:grid-cols-2 gap-5">

          {/* ── Left: Image ── */}
          <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
            <div className="relative w-full h-96 bg-gray-50">
              {images.length > 0 ? (
                <>
                  <img
                    key={activeImg}
                    src={images[activeImg]}
                    alt={`${rate.brand} - ${activeImg + 1}`}
                    className="w-full h-full object-contain p-4"
                    onError={(e) => {
                      const t = e.currentTarget as HTMLImageElement;
                      t.style.display = 'none';
                      const fb = t.nextElementSibling as HTMLElement;
                      if (fb) fb.style.display = 'flex';
                    }}
                  />
                  <div className="absolute inset-0 hidden flex-col items-center justify-center gap-2">
                    <Package className="w-10 h-10 text-gray-300" />
                    <p className="text-sm font-semibold text-gray-400">{rate.brand}</p>
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                  <Package className="w-10 h-10 text-gray-300" />
                  <p className="text-sm font-semibold text-gray-400">{rate.brand}</p>
                </div>
              )}

              <button onClick={prevImg} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded bg-white border border-gray-300 shadow flex items-center justify-center hover:bg-gray-100 transition-colors z-10">
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              <button onClick={nextImg} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded bg-white border border-gray-300 shadow flex items-center justify-center hover:bg-gray-100 transition-colors z-10">
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>

              {images.length > 1 && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {images.map((_, i) => (
                    <button key={i} onClick={() => setActiveImg(i)}
                      className={`h-1.5 rounded-full transition-all ${i === activeImg ? 'w-4 bg-black' : 'w-1.5 bg-gray-300'}`}
                    />
                  ))}
                </div>
              )}
            </div>

            {images.length > 1 && (
              <div className="flex gap-1.5 p-2 border-t border-gray-100 overflow-x-auto">
                {images.map((img, i) => (
                  <button key={i} onClick={() => setActiveImg(i)}
                    className={`shrink-0 w-12 h-12 rounded overflow-hidden border transition-all ${i === activeImg ? 'border-black' : 'border-gray-200 hover:border-gray-400'}`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Right: Details ── */}
          <div className="space-y-4">

            {/* Brand + price change */}
            <div>
              <h1 className="text-2xl font-bold text-gray-900 leading-tight">{rate.brand}</h1>
              <div className="mt-1"><PriceChange change={rate.change} /></div>
            </div>

            {/* Price box */}
            <div className="border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Today's Price</p>
                <p className="text-3xl font-black text-gray-900">Rs {rate.price.toLocaleString()}</p>
              </div>
              <p className="text-xs text-gray-400">per {rate.weightKg ?? 50} Kg bag</p>
            </div>

            {/* Specs grid */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: Package, label: 'Weight',   value: `${rate.weightKg ?? 50} Kg` },
                { icon: Shield,  label: 'Type',     value: rate.category ?? 'OPC Cement' },
                { icon: Truck,   label: 'Delivery', value: 'Available' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded px-3 py-2">
                  <Icon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <div>
                    <p className="text-[10px] text-gray-400 leading-none">{label}</p>
                    <p className="text-xs font-semibold text-gray-800 mt-0.5">{value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Quantity selector only ── */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 font-medium">Quantity:</span>
              <div className="flex items-center border border-gray-300 rounded overflow-hidden">
                <button
                  onClick={() => setQty(q => Math.max(1, q - 1))}
                  disabled={qty <= 1}
                  className="w-9 h-9 flex items-center justify-center bg-gray-100 hover:bg-gray-200 font-bold text-base transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  −
                </button>
                <span className="w-10 text-center text-sm font-semibold select-none">{qty}</span>
                <button
                  onClick={() => setQty(q => Math.min(MAX_QTY, q + 1))}
                  disabled={qty >= MAX_QTY}
                  className="w-9 h-9 flex items-center justify-center bg-gray-100 hover:bg-gray-200 font-bold text-base transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  +
                </button>
              </div>
              {qty >= MAX_QTY && (
                <span className="text-[10px] text-red-500 font-medium">Max 10 bags</span>
              )}
            </div>

            {/* Call + WhatsApp buttons */}
            <div className="grid grid-cols-2 gap-2">
              <a
                href={`tel:${CALL_NUMBER}`}
                className="flex items-center justify-center gap-1.5 h-9 rounded border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                Call Us
              </a>
              <a
                href={`https://wa.me/${CONTACT_NUMBER}?text=${encodeURIComponent(`Hi, I'm interested in ${rate.brand} (${qty} bag${qty > 1 ? 's' : ''}) — Rs ${rate.price}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 h-9 rounded border border-green-600 text-sm font-semibold text-green-700 hover:bg-green-50 transition-colors"
              >
                <WhatsAppIcon size={14} />
                WhatsApp
              </a>
            </div>

            {/* Trust badges */}
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { icon: Shield,     label: 'Premium Quality' },
                { icon: Truck,      label: 'Fast Delivery' },
                { icon: BadgeCheck, label: 'Verified Supplier' },
                { icon: Clock,      label: '24/7 Support' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-1.5 border border-gray-200 rounded px-2.5 py-1.5 text-xs text-gray-600">
                  <Icon className="w-3 h-3 text-gray-400 shrink-0" />
                  <span>{label}</span>
                </div>
              ))}
            </div>

            {/* Share buttons */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-gray-400 font-medium">Share:</span>
              {shareLinks.map(({ label, icon, href }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" title={label}
                  className="w-7 h-7 rounded border border-gray-200 flex items-center justify-center text-gray-500 hover:text-black hover:border-gray-400 transition-colors"
                >
                  {icon}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* ── Section nav ── */}
        <div className="mt-6 flex border-b border-gray-200 gap-0">
          {[
            { id: 'section-description', label: 'Description' },
            { id: 'section-additional',  label: 'Additional Information' },
          ].map(({ id, label }) => (
            <button key={id} onClick={() => scrollTo(id)}
              className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-black hover:border-b-2 hover:border-black transition-all"
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Description ── */}
        {rate.description && (
          <div id="section-description" className="mt-4 border border-gray-200 rounded-lg overflow-hidden scroll-mt-20">
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-2">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Description</span>
            </div>
            <div
              className="prose prose-sm max-w-none p-5 text-gray-700 leading-relaxed text-sm
                [&_h2]:text-sm [&_h2]:font-bold [&_h2]:text-gray-900 [&_h2]:mt-4 [&_h2]:mb-1.5
                [&_strong]:text-gray-900 [&_p]:my-2 [&_table]:text-xs"
              dangerouslySetInnerHTML={{ __html: rate.description }}
            />
          </div>
        )}

        {/* ── Additional Information ── */}
        <div id="section-additional" className="mt-4 border border-gray-200 rounded-lg overflow-hidden scroll-mt-20">
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-2">
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Additional Information</span>
          </div>
          <div className="p-5">
            <table className="w-full text-sm">
              <tbody>
                {[
                  { label: 'Product Name', value: rate.brand },
                  { label: 'Title',        value: rate.title ?? `${rate.brand} — ${rate.weightKg ?? 50} Kg Bag` },
                  { label: 'Price',        value: `Rs ${rate.price.toLocaleString()} / bag` },
                  { label: 'Weight',       value: `${rate.weightKg ?? 50} Kg` },
                  { label: 'Category',     value: rate.category ?? 'OPC Cement' },
                  { label: 'Availability', value: rate.isActive ? 'In Stock' : 'Out of Stock' },
                  ...(rate.change !== undefined && rate.change !== 0
                    ? [{ label: 'Price Change', value: `${rate.change > 0 ? '+' : ''}Rs ${rate.change} today` }]
                    : []),
                ].map(({ label, value }) => (
                  <tr key={label} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 pr-6 text-gray-400 font-medium w-44">{label}</td>
                    <td className="py-2 text-gray-800 font-semibold">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
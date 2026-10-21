'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Bath, BedDouble, ChevronLeft, ChevronRight, MapPin, Phone, Play, Ruler } from 'lucide-react';
import { Property } from '@/lib/data';
import { cn, toTitleCase } from '@/lib/utils';
import { amountShort, propertySizeLabel } from '@/lib/pk';
import { useImpression } from '@/components/analytics/impression';
import { trackContact } from '@/lib/analytics';
import { useSiteSettings } from '@/components/SiteSettingsProvider';
import { resolved, waDigits } from '@/lib/site-settings';
import VerifiedBadge from '@/components/VerifiedBadge';

/*
 * Similar listings at the foot of a property page, as one row that scrolls
 * sideways: two cards across a phone, three on a tablet, four on a desktop.
 * The rest of the site keeps the list-style PropertyCard; here a stacked list
 * made the page twice as long, so the cards are the compact photo-on-top kind.
 */

function MiniCard({ property }: { property: Property }) {
  const ref = useImpression<HTMLElement>(property.id);
  const realImage = property.image && !property.image.includes('images.unsplash.com') ? property.image : '';
  const poster = property.videoPosterUrl || realImage;
  const hasVideo = Boolean(property.videoUrl || property.videoPosterUrl);
  const closed = property.availability === 'sold' || property.availability === 'rented';
  const price = amountShort(property.price) || property.price.toLocaleString('en-PK');
  const isRent = property.purpose === 'rent';
  const place = [property.location, property.city]
    .filter(Boolean)
    .map((part) => toTitleCase(String(part)))
    .filter((part, i, all) => all.findIndex((p) => p.toLowerCase() === part.toLowerCase()) === i)
    .join(', ');
  const size = propertySizeLabel({ marla: property.marla, kanal: property.kanal, areaSize: Number(property.area) });

  const settings = useSiteSettings();
  const site = resolved(settings);
  const phone = property.contactNumber || site.phone;
  const rawWhatsApp = property.whatsappNumber || property.contactNumber || site.whatsapp;
  const whatsapp = rawWhatsApp ? waDigits(rawWhatsApp) : '';
  const phoneHref = phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : '';
  const waText = encodeURIComponent(
    `Hi, I am interested in: ${property.name} (${typeof window !== 'undefined' ? window.location.origin : 'https://propertydealer.pk'}/properties/${property.slug})`
  );
  const waUrl = whatsapp ? `https://wa.me/${whatsapp}?text=${waText}` : '';

  return (
    <article ref={ref} className={cn('group relative flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white', closed && 'opacity-80')}>
      <Link href={`/properties/${property.slug}`} className="absolute inset-0 z-10" aria-label={property.name} />
      <div className="relative aspect-[4/3] bg-slate-100">
        {poster ? (
          <Image src={poster} alt={property.name} fill className="object-cover" sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 260px" />
        ) : (
          <div className="grid h-full w-full place-items-center text-[11px] text-slate-400">No photo</div>
        )}
        {hasVideo && !realImage && (
          <span className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-black/55 text-white">
              <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
            </span>
          </span>
        )}
        {(closed || property.isFeatured) && (
          <span
            className={cn(
              'pointer-events-none absolute left-1.5 top-1.5 rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
              closed ? 'bg-slate-900 text-white' : 'bg-amber-400 text-slate-900',
            )}
          >
            {closed ? (property.availability === 'rented' ? 'Rented' : 'Sold') : 'Featured'}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-2 sm:p-2.5">
        <p className="flex items-baseline gap-1 text-slate-900">
          <span className="text-[10px] font-semibold text-slate-500">PKR</span>
          <span className="text-[16px] font-bold leading-none tracking-tight sm:text-[18px]">{price}</span>
          {isRent && <span className="text-[10.5px] text-slate-500">/month</span>}
          {property.ownerVerified && <VerifiedBadge icon className="ml-auto self-center" />}
        </p>
        <h3 className="mt-1 line-clamp-2 text-[13px] font-medium leading-snug text-slate-900 group-hover:text-primary sm:text-[14px]">
          {property.name}
        </h3>
        {place && (
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500 sm:text-[12px]">
            <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
            <span className="truncate">{place}</span>
          </p>
        )}
        <div className="mt-auto flex items-center justify-between gap-1 pt-1.5">
          <ul className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-600 sm:text-[12px]">
            {property.bedrooms > 0 && (
              <li className="inline-flex items-center gap-0.5"><BedDouble className="h-3.5 w-3.5 text-slate-400" />{property.bedrooms}</li>
            )}
            {property.bathrooms > 0 && (
              <li className="inline-flex items-center gap-0.5"><Bath className="h-3.5 w-3.5 text-slate-400" />{property.bathrooms}</li>
            )}
            {size && size !== '—' && (
              <li className="inline-flex min-w-0 items-center gap-0.5"><Ruler className="h-3.5 w-3.5 shrink-0 text-slate-400" /><span className="truncate">{size}</span></li>
            )}
          </ul>
          {!closed && (phone || whatsapp) && (
            <div className="relative z-20 flex shrink-0 items-center gap-1">
              {phone && (
                <a
                  href={phoneHref}
                  onClick={(e) => {
                    e.stopPropagation();
                    trackContact(property.id, 'phone');
                  }}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 shadow-xs transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-primary active:scale-95"
                  title={`Call: ${phone}`}
                  aria-label={`Call ${property.name}`}
                >
                  <Phone className="h-2.5 w-2.5 text-slate-600" />
                </a>
              )}
              {whatsapp && (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    e.stopPropagation();
                    trackContact(property.id, 'whatsapp');
                  }}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#25D366] text-white shadow-xs transition-colors hover:bg-[#20ba59] active:scale-95"
                  title={`WhatsApp: ${whatsapp}`}
                  aria-label={`WhatsApp about ${property.name}`}
                >
                  <svg viewBox="0 0 24 24" className="h-3 w-3 fill-current" aria-hidden="true">
                    <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.06 2.88 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.05 21.79h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88zm8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89 0-3.18-1.24-6.17-3.48-8.42z" />
                  </svg>
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export default function RelatedCarousel({ items }: { items: Property[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  // Arrows appear only when there is more to scroll that way.
  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure, items.length]);

  const go = (dir: 1 | -1) => {
    const el = scroller.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: 'smooth' });
  };

  const arrow = 'absolute top-[32%] z-20 hidden h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-slate-200 bg-white text-slate-800 shadow-md transition hover:bg-slate-50 sm:grid';

  return (
    <div className="relative">
      {canPrev && (
        <button type="button" onClick={() => go(-1)} aria-label="Previous" className={cn(arrow, '-left-3')}>
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      {canNext && (
        <button type="button" onClick={() => go(1)} aria-label="Next" className={cn(arrow, '-right-3')}>
          <ChevronRight className="h-5 w-5" />
        </button>
      )}
      <div ref={scroller} onScroll={measure} className="hide-scrollbar flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth sm:gap-3">
        {items.map((item) => (
          <div key={item.id} className="w-[calc((100%-0.5rem)/2)] shrink-0 snap-start sm:w-[calc((100%-1.5rem)/3)] lg:w-[calc((100%-2.25rem)/4)]">
            <MiniCard property={item} />
          </div>
        ))}
      </div>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Bath, BedDouble, ChevronLeft, ChevronRight, MapPin, Play, Ruler } from 'lucide-react';
import { Property } from '@/lib/data';
import { cn, toTitleCase } from '@/lib/utils';
import { amountShort, propertySizeLabel } from '@/lib/pk';
import { useImpression } from '@/components/analytics/impression';
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
        <ul className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-0.5 pt-1.5 text-[11px] text-slate-600 sm:text-[12px]">
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

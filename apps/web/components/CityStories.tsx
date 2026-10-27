'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { isPropertyDetail } from '@/lib/routes';
import { cn, toTitleCase } from '@/lib/utils';

/*
 * Cities as a row of round "story" shortcuts — a photo in a ring of the
 * theme colour, the name underneath — the way apps show categories you can
 * tap through. Four fit across a phone and the rest scroll; a desktop shows
 * more. Sorted by popularity (major cities first), then live listings count.
 *
 * Homepage: the ten most popular and a "View all" circle. Results pages: all
 * of them, with the current city highlighted, linking within the same
 * purpose (rent / sale / all) you are already browsing.
 */

export interface CityStory {
  _id: string;
  name: string;
  slug: string;
  thumbnail?: string;
  image?: string;
  count?: number;
}

const DEFAULT_CITY_IMAGES: Record<string, string> = {
  karachi: 'https://images.unsplash.com/photo-1570533113000-67623306634d?w=300&q=70',
  lahore: 'https://images.unsplash.com/photo-1596422846543-75c6fc18a5ce?w=300&q=70',
  islamabad: 'https://images.unsplash.com/photo-1621538356947-f495bf847683?w=300&q=70',
  faisalabad: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=300&q=70',
  faislabad: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=300&q=70',
  multan: 'https://images.unsplash.com/photo-1570533113000-67623306634d?w=300&q=70',
  gujranwala: 'https://images.unsplash.com/photo-1596422846543-75c6fc18a5ce?w=300&q=70',
};

const imageFor = (c: CityStory) => c.thumbnail || c.image || DEFAULT_CITY_IMAGES[c.name.trim().toLowerCase()] || '';

/** Mobile: exactly four across. Desktop: fixed-size circles that scroll. */
const ITEM = 'w-1/4 shrink-0 snap-start sm:w-[104px]';

function Ring({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <span className={cn('block rounded-full p-[2.5px] transition-transform group-active:scale-95', active ? 'bg-primary' : 'bg-primary/80')}>
      <span className="block rounded-full bg-white p-[2.5px]">{children}</span>
    </span>
  );
}

export default function CityStories({
  cities,
  limit,
  viewAllHref,
  className,
  linkMode = 'all',
}: {
  cities: CityStory[];
  limit?: number;
  viewAllHref?: string;
  className?: string;
  /** 'all' → /properties/all/<city>; 'follow' keeps the purpose of the current results page. */
  linkMode?: 'all' | 'follow';
}) {
  const pathname = usePathname() || '';
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
  }, [measure, cities.length]);

  const page = (dir: 1 | -1) => {
    const el = scroller.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  if (isPropertyDetail(pathname) || cities.length === 0) return null;

  const parts = pathname.split('/').filter(Boolean); // properties / rent|sale|all / city / …
  const purpose = parts[0] === 'properties' && ['rent', 'sale', 'all'].includes(parts[1] ?? '') ? parts[1]! : 'all';
  const currentCity = parts[0] === 'properties' ? parts[2] : undefined;
  const shown = typeof limit === 'number' ? cities.slice(0, limit) : cities;
  const hrefFor = (slug: string) => `/properties/${linkMode === 'follow' ? purpose : 'all'}/${slug}`;

  const arrow = 'absolute top-[33px] z-10 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white text-slate-900 shadow-[0_2px_10px_rgba(15,23,42,0.18)] ring-1 ring-slate-200 transition-opacity hover:bg-slate-50 sm:top-[38px] sm:h-9 sm:w-9';

  return (
    <div className="relative">
      {canPrev && (
        <button type="button" aria-label="Previous cities" onClick={() => page(-1)} className={cn(arrow, 'left-0 sm:-left-2')}>
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      {canNext && (
        <button type="button" aria-label="More cities" onClick={() => page(1)} className={cn(arrow, 'right-0 sm:-right-2')}>
          <ChevronRight className="h-5 w-5" />
        </button>
      )}
    <div ref={scroller} onScroll={measure} className={cn('hide-scrollbar -mx-[var(--gutter)] flex snap-x overflow-x-auto scroll-smooth sm:mx-0 sm:gap-2', className)}>
      {shown.map((city, i) => {
        const active = currentCity === city.slug;
        const src = imageFor(city);
        return (
          <Link key={city._id} href={hrefFor(city.slug)} className={cn(ITEM, 'group flex flex-col items-center px-1.5 py-1 text-center')}>
            <Ring active={active}>
              <span className="relative block h-[62px] w-[62px] overflow-hidden rounded-full bg-primary/10 sm:h-[72px] sm:w-[72px]">
                {src ? (
                  <Image src={src} alt={toTitleCase(city.name)} fill sizes="72px" className="object-cover" priority={i < 4} />
                ) : (
                  <span className="grid h-full w-full place-items-center text-[18px] font-bold text-primary">
                    {city.name.trim().slice(0, 2).toUpperCase()}
                  </span>
                )}
              </span>
            </Ring>
            <span className={cn('mt-1.5 line-clamp-1 max-w-full text-[12px] leading-tight sm:text-[13px]', active ? 'font-bold text-primary' : 'font-medium text-slate-900')}>
              {toTitleCase(city.name)}
            </span>
          </Link>
        );
      })}

      {viewAllHref && (
        <Link href={viewAllHref} className={cn(ITEM, 'group flex flex-col items-center px-1.5 py-1 text-center')}>
          <Ring>
            <span className="grid h-[62px] w-[62px] place-items-center rounded-full bg-primary/10 text-primary sm:h-[72px] sm:w-[72px]">
              <ArrowRight className="h-6 w-6" />
            </span>
          </Ring>
          <span className="mt-1.5 text-[12px] font-semibold leading-tight text-primary sm:text-[13px]">View all</span>
        </Link>
      )}
    </div>
    </div>
  );
}

/** The results pages' strip: every city, under the header, hidden on a listing's own page. */
export function CityStoriesBar({ cities }: { cities: CityStory[] }) {
  const pathname = usePathname() || '';
  if (isPropertyDetail(pathname) || cities.length === 0) return null;
  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="container mx-auto px-4 py-2.5 sm:py-3">
        <CityStories cities={cities} linkMode="follow" />
      </div>
    </div>
  );
}

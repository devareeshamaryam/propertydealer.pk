'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useSiteSettings } from '@/components/SiteSettingsProvider';
import { adLayout, adsAt, type AdPage, type AdSize, type AdUnit } from '@/lib/ads';
import { cn } from '@/lib/utils';

/*
 * One Google AdSense ad — a responsive unit, at a placement the admin has
 * switched on (Settings → Ads).
 *
 * Kept off the page's critical path: AdSense's script is not in the HTML at
 * all. It is added once, after the page has finished loading, and only when
 * the first ad comes within a screen or so of being seen — so it never slows
 * the first paint, and pages whose ads are never reached never load it. Each
 * ad's space is reserved up front so nothing jumps when it fills, and an ad
 * Google has nothing for folds away instead of leaving a gap.
 */

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const SCRIPT_ID = 'adsbygoogle-js';

function loadAdSense(client: string) {
  if (document.getElementById(SCRIPT_ID)) return;
  const s = document.createElement('script');
  s.id = SCRIPT_ID;
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
  document.head.appendChild(s);
}

/** Space kept for the ad before it loads: a banner across the page, or a box. */
const RESERVE: Record<AdSize, string> = {
  banner: 'min-h-[110px] sm:min-h-[100px]',
  box: 'min-h-[280px] sm:min-h-[250px]',
  auto: 'min-h-[250px] sm:min-h-[120px]',
};
const FORMAT: Record<AdSize, string> = { banner: 'horizontal', box: 'rectangle', auto: 'auto' };

function Ad({ unit, className }: { unit: AdUnit; className?: string }) {
  const client = unit?.client ?? '';
  const slot = unit?.slot ?? '';
  const box = useRef<HTMLDivElement>(null);
  const ins = useRef<HTMLModElement>(null);
  const [near, setNear] = useState(false);
  const [unfilled, setUnfilled] = useState(false);

  // Wait for the page to finish loading, then for the ad's place to come near the screen.
  useEffect(() => {
    if (!slot || near) return;
    const el = box.current;
    if (!el) return;
    let io: IntersectionObserver | null = null;
    const watch = () => {
      // A browser without IntersectionObserver simply gets the ad.
      if (typeof IntersectionObserver === 'undefined') {
        setNear(true);
        return;
      }
      io = new IntersectionObserver(
        ([entry]) => {
          // A hidden box (display:none on this screen size) has no width — AdSense cannot fill it.
          if (entry?.isIntersecting && el.offsetWidth > 0) {
            setNear(true);
            io?.disconnect();
          }
        },
        { rootMargin: '600px 0px' },
      );
      io.observe(el);
    };
    if (document.readyState === 'complete') watch();
    else window.addEventListener('load', watch, { once: true });
    return () => {
      io?.disconnect();
      window.removeEventListener('load', watch);
    };
  }, [slot, near]);

  // Ask AdSense for this one ad, once.
  useEffect(() => {
    const el = ins.current;
    if (!near || !slot || !el) return;
    loadAdSense(client);
    if (!el.getAttribute('data-adsbygoogle-status')) {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch {
        // An ad that cannot be placed must never break the page.
      }
    }
    const watchStatus = new MutationObserver(() => {
      if (el.getAttribute('data-ad-status') === 'unfilled') setUnfilled(true);
    });
    watchStatus.observe(el, { attributes: true, attributeFilter: ['data-ad-status'] });
    return () => watchStatus.disconnect();
  }, [near, client, slot]);

  if (!unit || unfilled) return null;
  const test = typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);

  return (
    <div ref={box} className={cn('ad-slot w-full overflow-hidden', RESERVE[unit.size], className)}>
      <p className="mb-1 text-center text-[10px] font-medium uppercase tracking-wider text-slate-400">Advertisement</p>
      {near && (
        <ins
          ref={ins}
          className="adsbygoogle"
          style={{ display: 'block' }}
          data-ad-client={unit.client}
          data-ad-slot={unit.slot}
          data-ad-format={FORMAT[unit.size]}
          data-full-width-responsive="true"
          {...(test ? { 'data-adtest': 'on' } : {})}
        />
      )}
    </div>
  );
}

/** The ads the admin put in one gap of one page (Settings → Ads). */
export function useAdsAt(page: AdPage, at: string): AdUnit[] {
  const settings = useSiteSettings();
  const layout = useMemo(() => adLayout(settings), [settings]);
  return useMemo(() => adsAt(settings, page, at, layout), [settings, page, at, layout]);
}

/**
 * The ads in one gap of a page — nothing at all (not even an empty wrapper)
 * when there are none there. A new page gets new ads.
 */
export function AdZone({ page, at, className, wrap }: { page: AdPage; at: string; className?: string; wrap?: string }) {
  const pathname = usePathname();
  const units = useAdsAt(page, at);
  if (!units.length) return null;
  const ads = units.map((u) => <Ad key={`${pathname}-${u.id}`} unit={u} className={className} />);
  return wrap ? <div className={wrap}>{ads}</div> : <>{ads}</>;
}

/** One ad already chosen (the results feed picks which goes where). */
export function AdUnitView({ unit, className }: { unit: AdUnit; className?: string }) {
  const pathname = usePathname();
  return <Ad key={`${pathname}-${unit.id}`} unit={unit} className={className} />;
}

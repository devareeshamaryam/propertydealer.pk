'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { markReturn, rememberFrom } from '@/lib/nav-memory';

/*
 * Back and forward land where you left the page — not on the footer.
 *
 * The browser restores the old scroll position the instant the URL changes,
 * before the page has its content back (listings, related properties and
 * images arrive a moment later). On a page that is still short, the old
 * position is past the end, so it was clamped to the bottom — the footer —
 * and stayed there once the content filled in.
 *
 * This takes the job over: it remembers each page's position when you leave
 * it, and on back/forward waits until the page is tall enough before
 * scrolling there (giving up after a few seconds, or as soon as you scroll
 * yourself). Ordinary link clicks still open the next page at the top.
 */

const STORE = 'pd-scroll-positions';
const keyOf = () => `${window.location.pathname}${window.location.search}`;

function read(): Record<string, number> {
  try {
    return JSON.parse(sessionStorage.getItem(STORE) || '{}');
  } catch {
    return {};
  }
}

function write(positions: Record<string, number>) {
  try {
    // Keep the newest 60 pages; this only needs to cover a browsing session.
    const entries = Object.entries(positions).slice(-60);
    sessionStorage.setItem(STORE, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Storage blocked: back simply behaves like the browser's default.
  }
}

export default function ScrollRestorer() {
  const pathname = usePathname();
  const currentKey = useRef<string>('');
  const popPending = useRef(false);
  const lastNavAt = useRef(0);
  const positions = useRef<Record<string, number>>({});

  // Take over from the browser, and keep a live record of where we are.
  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    positions.current = read();
    currentKey.current = keyOf();

    const save = () => {
      if (!currentKey.current) return;
      positions.current[currentKey.current] = window.scrollY;
      write(positions.current);
    };

    let ticking = false;
    const onScroll = () => {
      // Ignore the jump to the top that a navigation itself causes.
      if (Date.now() - lastNavAt.current < 600 || ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        save();
      });
    };

    // Leaving by a link: remember this page first.
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.('a');
      if (!a || a.target === '_blank' || e.defaultPrevented) return;
      save();
      lastNavAt.current = Date.now();
    };

    // Back / forward: remember this page, and restore the next one.
    const onPop = () => {
      save();
      markReturn();
      lastNavAt.current = Date.now();
      popPending.current = true;
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('click', onClick, true);
    window.addEventListener('popstate', onPop);
    window.addEventListener('pagehide', save);
    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('pagehide', save);
    };
  }, []);

  // A new page is on screen.
  useEffect(() => {
    const key = keyOf();
    if (key === currentKey.current && !popPending.current) return;
    // Opened from another page of this site: remember which, for "back".
    if (!popPending.current && currentKey.current) rememberFrom(key, currentKey.current);
    currentKey.current = key;
    lastNavAt.current = Date.now();

    if (!popPending.current) return; // a normal navigation — Next opens it at the top
    popPending.current = false;

    const target = positions.current[key];
    if (!target) {
      window.scrollTo(0, 0);
      return;
    }

    let cancelled = false;
    const stop = () => { cancelled = true; };
    window.addEventListener('wheel', stop, { passive: true, once: true });
    window.addEventListener('touchstart', stop, { passive: true, once: true });
    window.addEventListener('keydown', stop, { once: true });

    const started = Date.now();
    const attempt = () => {
      if (cancelled) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max >= target - 2) {
        window.scrollTo(0, target);
        // Content above may still grow for a moment (images); hold the spot briefly.
        if (Date.now() - started < 1200) requestAnimationFrame(attempt);
        return;
      }
      // Not tall enough yet: wait (never park on the footer meanwhile).
      // (If it never gets that tall — e.g. "show more" pages that are not
      // reloaded — the page simply stays at the top rather than the footer.)
      if (Date.now() - started < 4000) requestAnimationFrame(attempt);
    };
    requestAnimationFrame(attempt);

    return () => {
      cancelled = true;
      window.removeEventListener('wheel', stop);
      window.removeEventListener('touchstart', stop);
      window.removeEventListener('keydown', stop);
    };
  }, [pathname]);

  return null;
}

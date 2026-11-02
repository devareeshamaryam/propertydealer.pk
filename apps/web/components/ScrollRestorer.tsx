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
  /*
   * The page the scroll position belongs to. It switches the moment the
   * address changes (before the next page renders), not when React gets
   * round to it — otherwise the next page's jump to the top was saved as
   * this page's position whenever that page took a while to load, and
   * "back" then returned to the top.
   */
  const scrollKey = useRef<string>('');
  /** On the way to another page: the scrolling that follows is not this page's. */
  const leaving = useRef(false);
  /** Putting a page back where it was: don't record the steps on the way. */
  const restoring = useRef(false);

  // Take over from the browser, and keep a live record of where we are.
  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    positions.current = read();
    currentKey.current = keyOf();
    scrollKey.current = keyOf();
    // Back/forward that loaded the whole page again (after a deploy, a weak connection,
    // or a link the router couldn't load in place): put this page back where it was too.
    const nav = performance.getEntriesByType?.('navigation')?.[0] as PerformanceNavigationTiming | undefined;
    if (nav?.type === 'back_forward' && positions.current[keyOf()]) {
      popPending.current = true;
      restoring.current = true;
      setTimeout(() => (restoring.current = false), 9500);
    }

    const save = () => {
      if (!scrollKey.current) return;
      positions.current[scrollKey.current] = window.scrollY;
      write(positions.current);
    };

    let ticking = false;
    const onScroll = () => {
      if (leaving.current || restoring.current || ticking) return;
      ticking = true;
      // A timer, not an animation frame: frames stop in background tabs and some webviews.
      setTimeout(() => {
        ticking = false;
        if (!leaving.current && !restoring.current) save();
      }, 100);
    };

    // Leaving by a link: remember this page first, and stop recording until the next page is in.
    let leaveTimer: ReturnType<typeof setTimeout> | undefined;
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.('a');
      if (!a || a.target === '_blank' || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
      let url: URL;
      try {
        url = new URL(a.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin || `${url.pathname}${url.search}` === keyOf()) return; // elsewhere, or a #hash on this page
      save();
      leaving.current = true;
      lastNavAt.current = Date.now();
      clearTimeout(leaveTimer);
      leaveTimer = setTimeout(() => (leaving.current = false), 10_000); // the click didn't navigate after all
    };

    // Every way to a new address (links, router.push, forms) goes through pushState.
    const push = history.pushState.bind(history);
    const replace = history.replaceState.bind(history);
    history.pushState = function (...args: Parameters<History['pushState']>) {
      if (!leaving.current && !restoring.current) save();
      push(...args);
      scrollKey.current = keyOf();
      leaving.current = false;
      lastNavAt.current = Date.now();
    };
    history.replaceState = function (...args: Parameters<History['replaceState']>) {
      replace(...args);
      // Same entry, new filters in the address: the position now belongs to it.
      scrollKey.current = keyOf();
    };

    // Back / forward: remember the page we're on, and restore the next one.
    const onPop = () => {
      save();
      scrollKey.current = keyOf();
      leaving.current = false;
      restoring.current = true;
      // Back to the same page with other filters doesn't re-render a "new page": never stay stuck.
      setTimeout(() => (restoring.current = false), 9500);
      markReturn();
      lastNavAt.current = Date.now();
      popPending.current = true;
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('click', onClick, true);
    window.addEventListener('popstate', onPop);
    window.addEventListener('pagehide', save);
    return () => {
      history.pushState = push;
      history.replaceState = replace;
      clearTimeout(leaveTimer);
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
    // In case the address changed without pushState (never expected, but harmless).
    if (scrollKey.current !== key) scrollKey.current = key;
    leaving.current = false;
    lastNavAt.current = Date.now();

    if (!popPending.current) return; // a normal navigation — Next opens it at the top
    popPending.current = false;

    const target = positions.current[key];
    if (!target) {
      restoring.current = false;
      window.scrollTo(0, 0);
      return;
    }

    let cancelled = false;
    let reachedAt = 0;
    const finish = () => {
      restoring.current = false;
    };
    const stop = () => {
      cancelled = true;
      finish();
    };
    window.addEventListener('wheel', stop, { passive: true, once: true });
    window.addEventListener('touchstart', stop, { passive: true, once: true });
    window.addEventListener('keydown', stop, { once: true });

    const started = Date.now();
    const attempt = () => {
      if (cancelled) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max >= target - 2) {
        window.scrollTo(0, target);
        reachedAt ||= Date.now();
        // Content above may still grow for a moment (images): hold the spot briefly, then hand back.
        if (Date.now() - reachedAt < 1200) setTimeout(attempt, 40);
        else finish();
        return;
      }
      // Not tall enough yet (a slow connection still loading the results): wait,
      // up to 8 seconds, without parking on the footer meanwhile.
      if (Date.now() - started < 8000) setTimeout(attempt, 40);
      else {
        // It never got that tall (fewer results now): go as far as it goes, short of the footer.
        if (max > 0) window.scrollTo(0, Math.min(target, Math.max(0, max - window.innerHeight)));
        finish();
      }
    };
    setTimeout(attempt, 40);

    return () => {
      cancelled = true;
      finish();
      window.removeEventListener('wheel', stop);
      window.removeEventListener('touchstart', stop);
      window.removeEventListener('keydown', stop);
    };
  }, [pathname]);

  return null;
}

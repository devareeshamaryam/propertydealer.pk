/*
 * What this browser tab remembers about moving around the site — so "back"
 * returns to the page you came from, as you left it.
 *
 * document.referrer cannot tell: it never changes on in-app navigation, so a
 * visitor who arrived from Google and then opened a listing still looked like
 * "came from Google", and the back button sent them home. Instead each page
 * records the page that led to it, and a back/forward step leaves a short
 * note so a page can put back what it had loaded (e.g. "show more" results).
 */

const FROM = 'pd-nav-from';
const POP = 'pd-nav-pop';
const SNAP = 'pd-nav-snap:';

export const pageKey = () => `${window.location.pathname}${window.location.search}`;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: back simply behaves as the browser's default.
  }
}

/** A link or router push took us from `from` to `to`. */
export function rememberFrom(to: string, from: string) {
  if (!from || to === from) return;
  const map = readJson<Record<string, string>>(FROM, {});
  delete map[to];
  map[to] = from;
  const entries = Object.entries(map).slice(-100);
  writeJson(FROM, Object.fromEntries(entries));
}

/** The page on this site that led here in this tab, if any. */
export function cameFrom(key = pageKey()): string | null {
  return readJson<Record<string, string>>(FROM, {})[key] ?? null;
}

/** Called on back/forward: the page now showing was returned to, not opened. */
export function markReturn() {
  writeJson(POP, { key: pageKey(), at: Date.now() });
}

/** True when this page is being shown by back/forward (in the last few seconds). */
export function isReturn(key = pageKey()): boolean {
  const p = readJson<{ key?: string; at?: number }>(POP, {});
  return p.key === key && Date.now() - (p.at ?? 0) < 5000;
}

/** Keep what a page had loaded, to put back on return. */
export function saveSnapshot(name: string, data: unknown, key = pageKey()) {
  writeJson(SNAP + name + ':' + key, { at: Date.now(), data });
  // Only a handful are ever needed; drop the oldest.
  try {
    const keys = Object.keys(sessionStorage).filter((k) => k.startsWith(SNAP));
    if (keys.length > 12) {
      keys
        .map((k) => [k, readJson<{ at?: number }>(k, {}).at ?? 0] as const)
        .sort((a, b) => a[1] - b[1])
        .slice(0, keys.length - 12)
        .forEach(([k]) => sessionStorage.removeItem(k));
    }
  } catch {
    // ignore
  }
}

export function readSnapshot<T>(name: string, maxAgeMs = 30 * 60_000, key = pageKey()): T | null {
  const s = readJson<{ at?: number; data?: T }>(SNAP + name + ':' + key, {});
  return s.data !== undefined && Date.now() - (s.at ?? 0) < maxAgeMs ? s.data : null;
}

/*
 * Mark a back/forward step before the router renders the page it returns
 * to: this runs when the module loads, ahead of Next's own listener, so the
 * page's first render already knows it is a return.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => markReturn());
}

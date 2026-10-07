"use client";

/**
 * Listing analytics, from the browser's side.
 *
 * Three events, all fire-and-forget: a view when a listing is opened, an
 * impression when its card is actually scrolled into view, and a contact when
 * Call or WhatsApp is tapped. None of them may ever block a click or surface an
 * error — if a counter is lost, nobody is harmed.
 *
 * `fetch` with `keepalive` rather than the axios client on purpose: these must
 * survive the page being navigated away from, and must not carry the auth
 * header or trip the client's 401-refresh interceptor.
 */

import { publicApiBaseUrl } from "@/lib/api";

const VIEWED_KEY = "pd:viewed-listings";

function post(path: string, body: unknown) {
  try {
    void fetch(`${publicApiBaseUrl()}/properties/analytics/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
      // No cookies needed, and sending them would make this a credentialed
      // cross-origin request for no reason.
      credentials: "omit",
    }).catch(() => {});
  } catch {
    // Blocked by an extension, offline, whatever. Not our problem.
  }
}

/** Ids already counted this session, so a refresh is not a second view. */
function viewedThisSession(): Set<string> {
  try {
    const raw = sessionStorage.getItem(VIEWED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function remember(id: string) {
  try {
    const seen = viewedThisSession();
    seen.add(id);
    // Bound it: a long browsing session should not grow without limit.
    const trimmed = [...seen].slice(-300);
    sessionStorage.setItem(VIEWED_KEY, JSON.stringify(trimmed));
  } catch {
    // Private mode — count the view again next time rather than not at all.
  }
}

/** One view per listing per session. */
export function trackView(id?: string | null) {
  if (!id) return;
  if (viewedThisSession().has(id)) return;
  remember(id);
  post("view", { id });
}

export function trackContact(id: string | null | undefined, kind: "phone" | "whatsapp") {
  if (!id) return;
  post("contact", { id, kind });
}

/* ───────────────────────── impressions ───────────────────────── */

const pending = new Set<string>();
const sentThisPage = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

/**
 * Queue a card that has come into view. Batched for ~1.2s so scrolling a feed
 * of twenty cards is one request, not twenty.
 */
export function trackImpression(id?: string | null) {
  if (!id || sentThisPage.has(id) || pending.has(id)) return;
  pending.add(id);

  if (!timer) {
    timer = setTimeout(flushImpressions, 1200);
  }
}

export function flushImpressions() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (pending.size === 0) return;

  const ids = [...pending];
  pending.clear();
  for (const id of ids) sentThisPage.add(id);

  post("impressions", { ids });
}

// Whatever is still queued when the tab goes away still counts.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushImpressions();
  });
}

/**
 * The browser side of push notifications (client components only).
 *
 *   enablePush(source)   ask permission, subscribe, register this device
 *   syncPush()           every visit: keep this device's record current (account,
 *                        what it has been browsing); re-subscribe if the browser
 *                        dropped it or the site's keys changed
 *   disablePush()        turn notifications off on this device
 *   detachPushUser()     before signing out, so the next person on this device
 *                        does not get this account's notifications
 *   askForPush(context)  offer notifications right after an action they help with
 *   rememberListing()    a listing was opened: its area feeds "new in your area"
 */
import { getAccessToken } from "@/lib/api";

const SW_URL = "/push-sw.js";
const SCOPE = "/";

export type PushContext = "post" | "contact" | "review" | "browse";

export interface ClientPushConfig {
  enabled: boolean;
  publicKey: string | null;
  siteName: string;
  icon: string;
  prompt: {
    enabled: boolean;
    title: string;
    body: string;
    allow: string;
    later: string;
    delaySec: number;
    minPageViews: number;
    snoozeDays: number;
    excludePaths: string[];
    contexts: Record<string, { title: string; body: string }>;
  };
}

const headers = (): Record<string, string> => {
  const token = typeof window !== "undefined" ? getAccessToken() : null;
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};

let cfgPromise: Promise<ClientPushConfig | null> | null = null;
export function getPushConfigClient(): Promise<ClientPushConfig | null> {
  cfgPromise ??= fetch("/api/push/config")
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  return cfgPromise;
}

const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const standalone = () => window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true;

/** "ok", "ios-install" (iPhone: only once the site is added to the Home Screen), or "unsupported". */
export function pushSupport(): "ok" | "ios-install" | "unsupported" {
  if (typeof window === "undefined") return "unsupported";
  if ("serviceWorker" in navigator && "PushManager" in window && "Notification" in window) return "ok";
  return isIOS() && !standalone() ? "ios-install" : "unsupported";
}

export function pushPermission(): NotificationPermission | "unsupported" {
  return typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported";
}

function keyBytes(b64: string) {
  const s = b64.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(s + "=".repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
const sameKey = (a: ArrayBuffer | null | undefined, b: Uint8Array) => {
  if (!a) return false;
  const x = new Uint8Array(a);
  return x.length === b.length && x.every((v, i) => v === b[i]);
};

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = (await navigator.serviceWorker.getRegistrations()).find((r) => (r.active || r.waiting || r.installing)?.scriptURL.endsWith(SW_URL));
  const reg = existing || (await navigator.serviceWorker.register(SW_URL, { scope: SCOPE }));
  if (!reg.active) {
    const w = reg.installing || reg.waiting;
    if (w) {
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, 15_000);
        w.addEventListener("statechange", () => {
          if (w.state === "activated") {
            clearTimeout(t);
            resolve();
          }
        });
      });
    }
  }
  return reg;
}

async function subscription(reg: ServiceWorkerRegistration, publicKey: string) {
  const key = keyBytes(publicKey);
  let sub = await reg.pushManager.getSubscription();
  // Made with other keys: it can never receive ours. Replace it.
  if (sub && !sameKey(sub.options?.applicationServerKey, key)) {
    await sub.unsubscribe().catch(() => {});
    sub = null;
  }
  return sub || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
}

/* ── what this device has been looking at ─────────────────────────────── */

const LS_INTEREST = "push_interest";
type Interest = { areaId: string; area?: string; cityId?: string; purpose?: string; type?: string; at: number };
type Seen = { interests: Interest[]; viewed: string[]; changedAt?: number };

function readSeen(): Seen {
  try {
    const s = JSON.parse(localStorage.getItem(LS_INTEREST) || "{}");
    return { interests: Array.isArray(s.interests) ? s.interests : [], viewed: Array.isArray(s.viewed) ? s.viewed : [], changedAt: s.changedAt };
  } catch {
    return { interests: [], viewed: [] };
  }
}

/** A listing was opened. Remembered on this device only; sent with the next check-in. */
export function rememberListing(l: { id?: string; areaId?: string; area?: string; cityId?: string; purpose?: string; type?: string }) {
  if (typeof window === "undefined" || !l.id) return;
  try {
    const seen = readSeen();
    const viewed = [l.id, ...seen.viewed.filter((v) => v !== l.id)].slice(0, 30);
    let interests = seen.interests;
    let changed = false;
    if (l.areaId) {
      const purpose = l.purpose === "rent" ? "rent" : "sale";
      const had = interests.find((i) => i.areaId === l.areaId && i.purpose === purpose);
      changed = !had || interests[0] !== had;
      interests = [{ areaId: l.areaId, area: l.area, cityId: l.cityId, purpose, type: l.type, at: Date.now() }, ...interests.filter((i) => !(i.areaId === l.areaId && i.purpose === purpose))].slice(0, 10);
    }
    localStorage.setItem(LS_INTEREST, JSON.stringify({ interests, viewed, changedAt: changed ? Date.now() : seen.changedAt }));
    if (changed && pushPermission() === "granted") void syncPush(undefined, true);
  } catch {
    /* private mode */
  }
}

/** How many different listings this device opened (for the "browse" ask). */
export function viewedCount(): number {
  return typeof window === "undefined" ? 0 : readSeen().viewed.length;
}

/* ── subscribing ──────────────────────────────────────────────────────── */

const LS_SYNC = "push_sync";
async function report(sub: PushSubscription, source: string, who: string, oldEndpoint?: string) {
  const seen = readSeen();
  const r = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ subscription: sub.toJSON(), source, oldEndpoint, interests: seen.interests, viewed: seen.viewed }),
  });
  if (r.ok) {
    try {
      localStorage.setItem(LS_SYNC, JSON.stringify({ endpoint: sub.endpoint, who, at: Date.now() }));
    } catch {
      /* private mode */
    }
  }
  return r.ok;
}

export type EnableResult = { ok: boolean; reason?: "denied" | "unsupported" | "ios-install" | "error" };

/** Ask for permission and subscribe this device. */
export async function enablePush(source: string, who = ""): Promise<EnableResult> {
  const support = pushSupport();
  if (support !== "ok") return { ok: false, reason: support };
  const cfg = await getPushConfigClient();
  if (!cfg?.enabled || !cfg.publicKey) return { ok: false, reason: "unsupported" };
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, reason: "denied" };
  try {
    const reg = await registration();
    const sub = await subscription(reg, cfg.publicKey);
    return { ok: await report(sub, source, who) };
  } catch {
    return { ok: false, reason: "error" };
  }
}

let syncing = false;
/**
 * Every visit, when already allowed: refresh this device's record — at most
 * twice a day, at once when the signed-in person changed, and within 15
 * minutes when it started looking at a new area.
 */
export async function syncPush(who?: string, interestChanged = false): Promise<void> {
  if (syncing || pushSupport() !== "ok" || Notification.permission !== "granted") return;
  syncing = true;
  try {
    const cfg = await getPushConfigClient();
    if (!cfg?.enabled || !cfg.publicKey) return;
    const reg = await registration();
    const sub = await subscription(reg, cfg.publicKey);
    let last: { endpoint?: string; who?: string; at?: number } = {};
    try {
      last = JSON.parse(localStorage.getItem(LS_SYNC) || "{}");
    } catch {
      /* ignore */
    }
    const age = Date.now() - (last.at || 0);
    const person = who === undefined ? last.who || "" : who;
    const stale = age > 12 * 3_600_000 || (interestChanged && age > 15 * 60_000);
    if (stale || last.endpoint !== sub.endpoint || (who !== undefined && last.who !== who)) await report(sub, "sync", person);
  } catch {
    /* again next visit */
  } finally {
    syncing = false;
  }
}

export async function currentPushEndpoint(): Promise<string | null> {
  if (pushSupport() !== "ok") return null;
  const reg = (await navigator.serviceWorker.getRegistrations()).find((r) => (r.active || r.waiting || r.installing)?.scriptURL.endsWith(SW_URL));
  return (await reg?.pushManager.getSubscription())?.endpoint || null;
}

/** Turn notifications off on this device. */
export async function disablePush(): Promise<void> {
  const reg = pushSupport() === "ok" ? (await navigator.serviceWorker.getRegistrations()).find((r) => (r.active || r.waiting || r.installing)?.scriptURL.endsWith(SW_URL)) : null;
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await fetch("/api/push/subscribe", { method: "DELETE", headers: headers(), body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
  try {
    localStorage.removeItem(LS_SYNC);
  } catch {
    /* ignore */
  }
}

/** Before signing out: this device stops getting this account's notifications. */
export async function detachPushUser(): Promise<void> {
  try {
    const endpoint = await currentPushEndpoint();
    if (!endpoint) return;
    await fetch("/api/push/subscribe", { method: "PATCH", headers: headers(), body: JSON.stringify({ endpoint, detach: true }), keepalive: true });
    localStorage.setItem(LS_SYNC, JSON.stringify({ endpoint, who: "", at: Date.now() }));
  } catch {
    /* signing out must never fail because of this */
  }
}

/**
 * Offer notifications right after an action where they obviously help.
 * Remembered for one page load too, because some of those actions navigate
 * straight away (posting a listing opens My Listings).
 */
export const PUSH_ASK_KEY = "push_ask_next";
export function askForPush(context: PushContext) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(PUSH_ASK_KEY, context);
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new CustomEvent("push:ask", { detail: context }));
}

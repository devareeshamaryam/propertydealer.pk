/* eslint-disable no-restricted-globals */
/**
 * Push service worker for propertydealer.pk. Push only — no fetch handler, so
 * pages are never served from a stale cache.
 *
 * Payload (apps/api/src/push/push-core.service.ts → payloadOf):
 *   { title, body, url, icon, badge, image, tag, renotify, requireInteraction,
 *     actions: [{ action, title, url }], t: type, c: campaignId, id }
 */
const ORIGIN = self.location.origin;
const abs = (u) => {
  try { return new URL(String(u || "/"), ORIGIN).href; } catch (e) { return ORIGIN + "/"; }
};

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

async function track(e, data) {
  try {
    const sub = await self.registration.pushManager.getSubscription();
    await fetch(abs("/api/push/track"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ e, id: data.id, t: data.t, c: data.c, endpoint: sub ? sub.endpoint : undefined }),
      keepalive: true,
    });
  } catch (err) { /* best effort */ }
}

self.addEventListener("push", (event) => {
  let p = {};
  try { p = event.data ? event.data.json() : {}; } catch (err) { p = { title: event.data ? event.data.text() : "" }; }
  const data = {
    url: abs(p.url || "/"),
    id: p.id || "",
    t: p.t || "",
    c: p.c || "",
    actions: (p.actions || []).map((a) => ({ action: a.action, url: abs(a.url || "/") })),
  };
  const options = {
    body: p.body || "",
    icon: p.icon ? abs(p.icon) : abs("/api/push/icon.png"),
    badge: p.badge ? abs(p.badge) : abs("/api/push/badge.png"),
    image: p.image ? abs(p.image) : undefined,
    tag: p.tag || undefined,
    renotify: !!(p.tag && p.renotify),
    requireInteraction: !!p.requireInteraction,
    actions: (p.actions || []).map((a) => ({ action: a.action, title: a.title })),
    data,
    timestamp: Date.now(),
  };
  event.waitUntil(Promise.all([self.registration.showNotification(p.title || "Property Dealer", options), track("delivered", data)]));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const action = (data.actions || []).find((a) => a.action === event.action);
  const target = (action && action.url) || data.url || abs("/");
  event.waitUntil(Promise.all([
    track("click", data),
    (async () => {
      // A tab of this site already open: bring it forward and go to the page.
      const wins = (await self.clients.matchAll({ type: "window", includeUncontrolled: true })).filter((w) => w.url.startsWith(ORIGIN));
      const same = wins.find((w) => w.url === target) || wins[0];
      if (same) {
        await same.focus();
        if (same.url !== target && "navigate" in same) { try { await same.navigate(target); } catch (err) { /* ignore */ } }
        return;
      }
      if (self.clients.openWindow) await self.clients.openWindow(target);
    })(),
  ]));
});

self.addEventListener("notificationclose", (event) => {
  event.waitUntil(track("close", event.notification.data || {}));
});

// The browser replaced the subscription: subscribe again and tell the site, so this device keeps getting them.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil((async () => {
    try {
      let key = event.oldSubscription && event.oldSubscription.options && event.oldSubscription.options.applicationServerKey;
      if (!key) {
        const cfg = await (await fetch(abs("/api/push/config"))).json();
        if (!cfg.publicKey) return;
        const b64 = cfg.publicKey.replace(/-/g, "+").replace(/_/g, "/");
        const raw = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
        key = Uint8Array.from(raw, (ch) => ch.charCodeAt(0));
      }
      const sub = event.newSubscription || (await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }));
      await fetch(abs("/api/push/subscribe"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON(), oldEndpoint: event.oldSubscription ? event.oldSubscription.endpoint : undefined, source: "rotate" }),
      });
    } catch (err) { /* the page re-syncs on the next visit */ }
  })());
});

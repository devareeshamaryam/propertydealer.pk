"use client";

/**
 * Asks visitors to allow notifications the way large sites do:
 *   - our own card first; the browser's permission dialog appears only after
 *     "Allow", so a "Not now" never blocks the site for good;
 *   - never on the first page, not straight away (admin: page views + delay),
 *     never on excluded pages (dashboard, sign-in…), "Not now" snoozes it;
 *   - right after a useful moment — posting a listing, calling an agent,
 *     writing a review, or browsing several listings — with words for that
 *     moment (at most once every 3 days);
 *   - on iPhone it explains Add to Home Screen, the only way iOS allows it.
 * Already allowed: it quietly keeps this device's record current each visit.
 * Every word comes from Dashboard → Push notifications → Settings.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, Loader2, Share, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/auth-context";
import {
  enablePush, getPushConfigClient, pushPermission, pushSupport, syncPush, viewedCount, PUSH_ASK_KEY, type ClientPushConfig,
} from "@/lib/push-client";

const LS = { views: "push_pv", snooze: "push_snooze", ctxAt: "push_ctx_at" };
const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode */
  }
};

type Ask = { title: string; body: string; source: string; ios: boolean };

export default function PushPrompt() {
  const pathname = usePathname() || "/";
  const { user, isLoading } = useAuth();
  const who = user?._id || "";
  const [cfg, setCfg] = useState<ClientPushConfig | null>(null);
  const [ask, setAsk] = useState<Ask | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void getPushConfigClient().then(setCfg);
  }, []);

  // Already allowed: keep the record current (and re-link the account after signing in here).
  useEffect(() => {
    if (isLoading || !cfg?.enabled) return;
    if (pushPermission() === "granted") void syncPush(who);
  }, [cfg, isLoading, who]);

  const excluded = useCallback(
    (path: string) => !!cfg?.prompt.excludePaths.some((p) => p && (path === p || path.startsWith(p.endsWith("/") ? p : `${p}/`))),
    [cfg],
  );
  const canAsk = useCallback(() => {
    if (!cfg?.enabled || !cfg.prompt.enabled) return null;
    const support = pushSupport();
    if (support === "unsupported") return null;
    if (support === "ok" && pushPermission() !== "default") return null;
    return support;
  }, [cfg]);

  // The general ask: after N page views and a few seconds on the page.
  useEffect(() => {
    if (!cfg || isLoading) return;
    const views = Number(read(LS.views) || 0) + 1;
    write(LS.views, String(views));
    if (timer.current) clearTimeout(timer.current);
    const support = canAsk();
    if (!support || excluded(pathname) || ask) return;
    if (Date.now() < Number(read(LS.snooze) || 0) || views < cfg.prompt.minPageViews) return;
    timer.current = setTimeout(() => {
      if (document.visibilityState !== "visible") return;
      // Someone who has been opening listings hears about alerts for their area.
      const copy = viewedCount() >= 3 ? cfg.prompt.contexts.browse || cfg.prompt : cfg.prompt;
      setAsk({ title: copy.title, body: copy.body, source: viewedCount() >= 3 ? "browse" : "prompt", ios: support === "ios-install" });
    }, Math.max(0, cfg.prompt.delaySec) * 1000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, cfg, isLoading]);

  // After an action (askForPush): even when the general ask was snoozed, but at most once every 3 days.
  const contextAsk = useCallback(
    (context: string) => {
      const support = canAsk();
      if (!support || !cfg) return;
      if (Date.now() - Number(read(LS.ctxAt) || 0) < 3 * 86_400_000) return;
      const copy = cfg.prompt.contexts[context] || cfg.prompt;
      write(LS.ctxAt, String(Date.now()));
      setAsk({ title: copy.title, body: copy.body, source: context || "prompt", ios: support === "ios-install" });
    },
    [cfg, canAsk],
  );

  useEffect(() => {
    const onAsk = (e: Event) => contextAsk(String((e as CustomEvent).detail || ""));
    window.addEventListener("push:ask", onAsk);
    try {
      const pending = sessionStorage.getItem(PUSH_ASK_KEY);
      if (pending) {
        sessionStorage.removeItem(PUSH_ASK_KEY);
        setTimeout(() => contextAsk(pending), 1200);
      }
    } catch {
      /* private mode */
    }
    return () => window.removeEventListener("push:ask", onAsk);
  }, [contextAsk]);

  const later = () => {
    write(LS.snooze, String(Date.now() + (cfg?.prompt.snoozeDays || 7) * 86_400_000));
    setAsk(null);
  };

  const allow = async () => {
    if (!ask) return;
    setBusy(true);
    const r = await enablePush(ask.source, who);
    setBusy(false);
    setAsk(null);
    if (r.ok) toast.success("Notifications are on");
    else if (r.reason === "denied") {
      write(LS.snooze, String(Date.now() + 90 * 86_400_000));
      toast.error("Notifications are blocked", { description: "You can allow them from the lock icon next to the address bar." });
    } else toast.error("Couldn't turn on notifications in this browser");
  };

  if (!ask || !cfg) return null;
  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={ask.title}
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+9.5rem)] left-3 right-3 z-[70] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:bottom-5 sm:left-5 sm:right-auto sm:w-[380px]"
    >
      <button type="button" onClick={later} aria-label="Close" className="absolute right-2.5 top-2.5 rounded-full p-1.5 text-slate-400 hover:bg-slate-100">
        <X className="h-4 w-4" />
      </button>
      <div className="flex gap-3 pr-6">
        <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-primary/10">
          {cfg.icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cfg.icon} alt="" className="h-9 w-9 object-contain" />
          ) : (
            <Bell className="h-5 w-5 text-primary" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-[14.5px] font-semibold leading-snug text-slate-900">{ask.title}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{ask.body}</p>
        </div>
      </div>
      {ask.ios ? (
        <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-[12.5px] leading-relaxed text-slate-600">
          On iPhone: tap <Share className="-mt-0.5 inline h-3.5 w-3.5" /> <b>Share</b>, then <b>Add to Home Screen</b>. Open {cfg.siteName} from your Home Screen and turn notifications on there.
        </p>
      ) : (
        <div className="mt-3.5 flex gap-2">
          <button type="button" onClick={later} className="h-10 flex-1 rounded-xl border border-slate-200 text-[14px] font-semibold text-slate-600 hover:bg-slate-50">
            {cfg.prompt.later}
          </button>
          <button
            type="button"
            onClick={() => void allow()}
            disabled={busy}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-[14px] font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />} {cfg.prompt.allow}
          </button>
        </div>
      )}
    </div>
  );
}

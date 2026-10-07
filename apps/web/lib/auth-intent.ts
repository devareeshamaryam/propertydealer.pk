"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * "Finish what you started" sign-in.
 *
 * A visitor who taps Call or WhatsApp on a listing is not asking to visit a
 * login page — they are asking for a phone number. So the thing they were
 * doing is remembered, and once they are in, it happens: the dialler opens,
 * WhatsApp opens. Being sent to a login form and then dumped back on the page
 * to find the button again is how people give up.
 *
 * The intent rides inside the `next` path (`/properties/x?intent=call`) rather
 * than as a separate parameter, so it survives both the password form and the
 * Google round trip without any extra plumbing.
 */

export type Intent = "call" | "whatsapp" | "post";

const REASONS: Record<Intent, string> = {
  call: "Sign in to see the agent's number",
  whatsapp: "Sign in to message the agent on WhatsApp",
  post: "Sign in to list your property",
};

/** The sign-in URL that comes back here and resumes `intent`. */
export function loginUrl(returnTo: string, intent?: Intent): string {
  const target = intent
    ? `${returnTo}${returnTo.includes("?") ? "&" : "?"}intent=${encodeURIComponent(intent)}`
    : returnTo;
  return `/login?next=${encodeURIComponent(target)}`;
}

/** The sign-up URL for the same journey. `as=agent` creates an agent account. */
export function registerUrl(
  returnTo: string,
  options: { intent?: Intent; asAgent?: boolean } = {},
): string {
  const target = options.intent
    ? `${returnTo}${returnTo.includes("?") ? "&" : "?"}intent=${encodeURIComponent(options.intent)}`
    : returnTo;
  const as = options.asAgent ? "&as=agent" : "";
  return `/register?next=${encodeURIComponent(target)}${as}`;
}

/**
 * Where to go after signing in, from `?next=` — only ever a page on this site.
 *
 * An absolute URL here would otherwise be followed as given, so a link like
 * `/login?next=https://evil.example` would send someone to a copy of the site
 * immediately after they typed their password.
 */
export function safeNextUrl(raw: string | null | undefined, fallback = "/dashboard"): string {
  if (!raw) return fallback;

  const path = raw.trim();

  // A scheme, a protocol-relative URL, or a backslash (which some browsers
  // normalise to a slash) means it is pointing off-site.
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith("//") || path.includes("\\")) {
    return fallback;
  }
  if (!path.startsWith("/")) return fallback;

  // Never back to the auth pages themselves — that is a loop.
  if (/^\/(login|register|signing-in)(\/|\?|$)/.test(path)) return fallback;

  return path;
}

/** What the visitor was about to do, for the sign-in heading. */
export function intentReason(next: string | null | undefined): string | null {
  if (!next) return null;
  try {
    const url = new URL(next, "http://local.invalid");
    const intent = url.searchParams.get("intent") as Intent | null;
    if (intent && REASONS[intent]) return REASONS[intent];
    if (url.pathname.includes("/property/add-property")) return REASONS.post;
    return null;
  } catch {
    return null;
  }
}

/**
 * Replay a pending intent after signing in.
 *
 * `ready` holds it back until the session is actually known — firing while
 * `isLoading` is still true would run the handler for a visitor who is not
 * signed in yet and bounce them straight back to the login page.
 */
export function useResumeIntent(
  handlers: Partial<Record<Intent, () => void>>,
  ready = true,
) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const fired = useRef(false);

  useEffect(() => {
    if (!ready || fired.current) return;

    const intent = params.get("intent") as Intent | null;
    if (!intent) return;

    const run = handlers[intent];
    if (!run) return;

    fired.current = true;

    // Drop ?intent= before running it, so a refresh or the back button does
    // not fire the same action again.
    const rest = new URLSearchParams(params.toString());
    rest.delete("intent");
    const query = rest.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });

    run();
  }, [ready, params, pathname, router, handlers]);
}

/** `0300 1234567` → `0300 ••••••` — enough to show a number exists. */
export function maskPhone(phone?: string | null): string {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.length < 5) return "••••••••";
  return `${digits.slice(0, 4)} ${"•".repeat(Math.max(4, digits.length - 4))}`;
}

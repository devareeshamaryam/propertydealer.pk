"use client";

/**
 * Coming back to where you were, after signing in.
 *
 * Signing in is only about listings now. Phone numbers and WhatsApp are
 * open to every visitor — the listing page hides the number behind one tap
 * instead of behind an account — so the "resume the call you were making"
 * machinery that used to live here is gone, along with the call and whatsapp
 * intents. What is left is the `next` path and a heading that says why the
 * form is in the way.
 */

/** The sign-in URL that comes back here afterwards. */
export function loginUrl(returnTo: string): string {
  return `/login?next=${encodeURIComponent(returnTo)}`;
}

/** The sign-up URL for the same journey. Every account is an agent account. */
export function registerUrl(returnTo: string): string {
  return `/register?next=${encodeURIComponent(returnTo)}`;
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
  return next.includes("/property/add-property")
    ? "Sign in to list your property"
    : null;
}

/** `0300 1234567` → `0300 ••••••` — enough to show a number exists. */
export function maskPhone(phone?: string | null): string {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.length < 5) return "••••••••";
  return `${digits.slice(0, 4)} ${"•".repeat(Math.max(4, digits.length - 4))}`;
}

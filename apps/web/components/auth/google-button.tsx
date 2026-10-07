"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import api, { publicApiBaseUrl } from "@/lib/api";

/** Where the sign-in flow should land, remembered across the Google round trip. */
export const OAUTH_NEXT_KEY = "pd:oauth-next";

/** Google's own mark — four paths, four brand colours, no icon library needed. */
function GoogleMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59A14.5 14.5 0 0 1 9.77 24c0-1.6.28-3.14.76-4.59l-7.98-6.19A23.94 23.94 0 0 0 0 24c0 3.87.92 7.52 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.46-9.91l-7.97 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

interface GoogleButtonProps {
  /** "Continue with Google" reads oddly on a sign-up page. */
  label?: string;
  /** Where to land afterwards, e.g. the page the visitor was trying to reach. */
  next?: string | null;
  disabled?: boolean;
}

/**
 * "Continue with Google".
 *
 * Renders nothing unless the API reports that a Google app is configured, so
 * an install without GOOGLE_CLIENT_ID never shows a button that only leads to
 * an error page.
 *
 * This is a plain link, not an XHR: OAuth needs the browser itself to travel
 * to Google and come back with cookies set, which fetch() cannot do.
 */
export function GoogleButton({
  label = "Continue with Google",
  next,
  disabled,
}: GoogleButtonProps) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let active = true;

    api
      .get("/auth/providers")
      .then((response) => {
        if (active) setEnabled(Boolean(response.data?.google));
      })
      .catch(() => {
        // Older API build without the endpoint — hide the button rather than
        // offering something that may not exist.
        if (active) setEnabled(false);
      });

    return () => {
      active = false;
    };
  }, []);

  if (enabled !== true) return null;

  const start = () => {
    setLeaving(true);

    // Where to land afterwards is remembered here rather than passed through
    // Google and back: it is only ever a path on this site, and keeping it out
    // of the OAuth round trip means no one can aim the redirect from outside.
    try {
      if (next?.startsWith("/")) sessionStorage.setItem(OAUTH_NEXT_KEY, next);
      else sessionStorage.removeItem(OAUTH_NEXT_KEY);
    } catch {
      // Private mode / blocked storage — the default destination is fine.
    }

    window.location.href = `${publicApiBaseUrl()}/auth/google`;
  };

  return (
    <div className="space-y-4">
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full gap-2.5 font-medium"
        onClick={start}
        disabled={disabled || leaving}
      >
        {leaving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <GoogleMark className="h-5 w-5" />
        )}
        {label}
      </Button>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          or
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}

export default GoogleButton;

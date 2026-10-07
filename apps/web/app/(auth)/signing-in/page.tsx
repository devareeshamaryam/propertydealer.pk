"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/context/auth-context";
import { OAUTH_NEXT_KEY } from "@/components/auth/google-button";

/**
 * The landing strip after "Continue with Google".
 *
 * The API has already created or matched the account and set its cookies; all
 * that is left is to swap them for an access token and move on. It exists as a
 * page rather than happening invisibly so that a slow network shows a spinner
 * instead of a dashboard that looks logged out for a second.
 */
export default function SigningInPage() {
  const router = useRouter();
  const { completeSocialSignIn } = useAuth();
  const [failed, setFailed] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    // StrictMode mounts effects twice in development; one refresh is enough.
    if (ran.current) return;
    ran.current = true;

    let next = "/dashboard";
    try {
      const stored = sessionStorage.getItem(OAUTH_NEXT_KEY);
      if (stored?.startsWith("/")) next = stored;
      sessionStorage.removeItem(OAUTH_NEXT_KEY);
    } catch {
      // Blocked storage — the dashboard is the right default anyway.
    }

    completeSocialSignIn()
      .then(() => {
        toast.success("Signed in with Google");
        router.replace(next);
        router.refresh();
      })
      .catch(() => {
        setFailed(true);
      });
  }, [completeSocialSignIn, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-muted/40 px-4 text-center">
      {failed ? (
        <>
          <p className="text-lg font-semibold">We could not finish signing you in</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Your Google account was verified, but the session did not stick.
            Please try again.
          </p>
          <button
            type="button"
            onClick={() => router.replace("/login")}
            className="text-sm font-medium text-primary hover:underline"
          >
            Back to sign in
          </button>
        </>
      ) : (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Signing you in…</p>
        </>
      )}
    </div>
  );
}

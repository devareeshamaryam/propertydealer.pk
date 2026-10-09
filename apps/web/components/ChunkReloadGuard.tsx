"use client";

import { useEffect } from "react";

/**
 * Recover from a stale HTML document instead of showing a white page.
 *
 * The site sits behind Cloudflare, which caches the HTML and hands browsers
 * `max-age=14400`. Every deploy gives the JS chunks new content hashes and
 * deletes the old files, so for up to four hours after a deploy a visitor can
 * be holding an HTML document that asks for `/_next/static/chunks/<old>.js`.
 * That request 404s, React never hydrates, and the page renders blank — which
 * is exactly what happened on 9 Oct 2026: the origin was healthy and
 * `?cachebust=1` rendered perfectly while the plain URL was white.
 *
 * Purging Cloudflare fixes the edge but cannot reach a cache that already sits
 * in somebody's browser. This can: on a chunk failure it refetches the
 * document with `cache: "reload"`, which replaces that browser's cached copy,
 * and then reloads. The URL never changes, so nothing about the page's
 * identity in search moves.
 *
 * The real cure is upstream — Cloudflare should not be handing out a
 * four-hour browser TTL for HTML — but this is the seatbelt for the next time
 * a deploy and a cached document disagree.
 */

const LAST_ATTEMPT_KEY = "pd:chunk-reload-at";

/** Long enough that a reload loop is impossible, short enough to help twice. */
const COOLDOWN_MS = 30_000;

const CHUNK_FAILURE =
  /ChunkLoadError|Loading chunk [\w-]+ failed|Failed to load chunk|Importing a module script failed|error loading dynamically imported module|Failed to fetch dynamically imported module/i;

function looksLikeChunkFailure(value: unknown): boolean {
  if (!value) return false;
  if (value instanceof Error) {
    return CHUNK_FAILURE.test(`${value.name}: ${value.message}`);
  }
  return CHUNK_FAILURE.test(String(value));
}

export default function ChunkReloadGuard() {
  useEffect(() => {
    let recovering = false;

    const recover = () => {
      if (recovering) return;

      /*
       * sessionStorage, not a ref: the point is to survive the reload. A
       * timestamp rather than a flag so a tab that hit this once is not
       * locked out of recovering later in the same session.
       */
      let last = 0;
      try {
        last = Number(window.sessionStorage.getItem(LAST_ATTEMPT_KEY) ?? 0);
      } catch {
        // Private mode, or storage blocked. One attempt is still better than
        // a white page; the `recovering` latch keeps this render honest.
      }

      if (last && Date.now() - last < COOLDOWN_MS) return;

      recovering = true;
      try {
        window.sessionStorage.setItem(LAST_ATTEMPT_KEY, String(Date.now()));
      } catch {
        /* ignore */
      }

      /*
       * Refill this browser's cache entry for the document before reloading.
       * A plain reload() is allowed to be answered from the very copy that
       * just failed, which would reload straight back into the white page.
       */
      void fetch(window.location.href, {
        cache: "reload",
        credentials: "same-origin",
      })
        .catch(() => {
          // Offline or the origin is down — reloading still beats a blank page.
        })
        .finally(() => {
          window.location.reload();
        });
    };

    const onError = (event: ErrorEvent) => {
      if (looksLikeChunkFailure(event.error ?? event.message)) recover();
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      if (looksLikeChunkFailure(event.reason)) recover();
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}

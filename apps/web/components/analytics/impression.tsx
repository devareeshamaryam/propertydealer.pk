"use client";

import { useEffect, useRef } from "react";

import { trackImpression } from "@/lib/analytics";

/**
 * Counts a listing card as seen once it is genuinely on screen.
 *
 * Not on render: a feed renders thirty cards and a visitor sees four of them.
 * An impression that counts cards nobody looked at makes the agent's "views
 * per impression" meaningless, which is the one number that tells them whether
 * their photos and price are doing the work.
 */
export function useImpression<T extends HTMLElement>(id?: string | null) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || !id) return;

    // No IntersectionObserver (old browser, jsdom): count it rather than
    // losing the data entirely.
    if (typeof IntersectionObserver === "undefined") {
      trackImpression(id);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // Half the card, for a moment — a card flying past during a fast
          // scroll is not an impression.
          if (entry.isIntersecting) {
            trackImpression(id);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [id]);

  return ref;
}

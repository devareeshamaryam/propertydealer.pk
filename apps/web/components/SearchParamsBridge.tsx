'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/*
 * Hands the query string to a parent through state.
 *
 * Calling useSearchParams() in a component of a cached (ISR) page makes Next
 * render everything up to the nearest <Suspense> in the browser only — the
 * results pages went out as a spinner, with no heading and no listings in the
 * HTML. Render this inside its own <Suspense fallback={null}>: only this
 * (empty) component waits for the browser, and the page itself is rendered
 * on the server with the listings it was given.
 */
export default function SearchParamsBridge({ onChange }: { onChange: (params: URLSearchParams) => void }) {
  const params = useSearchParams();
  const key = params.toString();
  useEffect(() => {
    onChange(new URLSearchParams(key));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}

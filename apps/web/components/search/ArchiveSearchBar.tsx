'use client';

import { useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { parseSearch } from '@/lib/search';
import SearchPanel from './SearchPanel';

/**
 * The search above results pages — not on a listing's own page
 * (/properties/<slug>). Reads the page's own search from its address; it
 * sits inside a Suspense boundary in the layout because of useSearchParams.
 */
export default function ArchiveSearchBar() {
  const pathname = usePathname() || '';
  const params = useSearchParams();
  const current = useMemo(() => parseSearch(pathname, params), [pathname, params]);
  const parts = pathname.split('/').filter(Boolean);
  const results = parts[0] === 'properties' && (parts.length === 1 || ['sale', 'rent', 'all', 'buy'].includes(parts[1] ?? ''));
  if (!results) return null;
  return <SearchPanel variant="bar" current={current} />;
}

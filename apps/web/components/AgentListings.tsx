'use client';

import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import PropertyCard from '@/components/PropertyCard';
import { propertyApi } from '@/lib/api';
import { mapBackendToFrontendProperty, type BackendProperty } from '@/lib/types/property-utils';
import type { Property } from '@/lib/data';
import { cn } from '@/lib/utils';

/*
 * An agent's listings: All / For sale / For rent, and "Show more" that loads
 * the next page under the ones already shown (the page used to stop at the
 * first 24, so an agent with 386 listings showed 24 and no way to the rest).
 */

const PAGE_SIZE = 24;

type Tab = 'all' | 'sale' | 'rent';

export default function AgentListings({
  agentId,
  initial,
  totals,
}: {
  agentId: string;
  initial: Property[];
  totals: { all: number; sale: number; rent: number };
}) {
  const [tab, setTab] = useState<Tab>('all');
  const [pages, setPages] = useState<Record<Tab, { rows: Property[]; page: number }>>({
    all: { rows: initial, page: 1 },
    sale: { rows: [], page: 0 },
    rent: { rows: [], page: 0 },
  });
  const [loading, setLoading] = useState(false);

  const current = pages[tab];
  const total = totals[tab];
  const rows = current.rows;
  const hasMore = rows.length < total;

  const load = async (which: Tab, page: number) => {
    setLoading(true);
    try {
      const res: any = await propertyApi.getAll({
        ownerId: agentId,
        page,
        limit: PAGE_SIZE,
        ...(which !== 'all' ? { purpose: which === 'sale' ? 'buy' : 'rent' } : {}),
      } as any);
      const raw: BackendProperty[] = Array.isArray(res) ? res : res?.properties ?? [];
      const mapped = raw.map(mapBackendToFrontendProperty);
      setPages((prev) => ({
        ...prev,
        [which]: { rows: page === 1 ? mapped : [...prev[which].rows, ...mapped], page },
      }));
    } finally {
      setLoading(false);
    }
  };

  const tabs = useMemo(
    () =>
      ([
        { key: 'all', label: 'All', count: totals.all },
        { key: 'sale', label: 'For sale', count: totals.sale },
        { key: 'rent', label: 'For rent', count: totals.rent },
      ] as const).filter((t) => t.key === 'all' || t.count > 0),
    [totals],
  );

  const switchTo = (key: Tab) => {
    setTab(key);
    if (pages[key].page === 0) void load(key, 1);
  };

  return (
    <div>
      {tabs.length > 1 && (
        <div className="hide-scrollbar mb-3 flex gap-1.5 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => switchTo(t.key)}
              className={cn(
                'h-9 shrink-0 rounded-full px-4 text-[14px] font-medium transition-colors',
                tab === t.key ? 'bg-primary text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-slate-300',
              )}
            >
              {t.label} <span className={tab === t.key ? 'text-white/75' : 'text-slate-400'}>{t.count.toLocaleString('en-PK')}</span>
            </button>
          ))}
        </div>
      )}

      {loading && rows.length === 0 ? (
        <div className="grid place-items-center py-12 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2 lg:gap-3">
          {rows.map((p) => (
            <PropertyCard key={p.id} property={p} />
          ))}
        </div>
      )}

      {hasMore && rows.length > 0 && (
        <div className="mt-5 flex flex-col items-center gap-1.5">
          <button
            type="button"
            disabled={loading}
            onClick={() => void load(tab, current.page + 1)}
            className="inline-flex h-11 min-w-[220px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-[14.5px] font-semibold text-slate-900 transition-colors hover:border-slate-400 disabled:opacity-60 btn-shape"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Show more
          </button>
          <span className="text-[12.5px] text-slate-500">
            Showing {rows.length.toLocaleString('en-PK')} of {total.toLocaleString('en-PK')}
          </span>
        </div>
      )}
    </div>
  );
}

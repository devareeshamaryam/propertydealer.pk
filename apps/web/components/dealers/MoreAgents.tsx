'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AgentCard } from './DealerCards';
import type { DealerCard, DealerCityData } from '@/lib/dealers';

/** The rest of a city's agents, a page at a time, in the same order. */
export function MoreAgents({ slug, pages, total, shown }: { slug: string; pages: number; total: number; shown: number }) {
  const [rows, setRows] = useState<DealerCard[]>([]);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (pages <= 1) return null;

  const load = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/dealers/city/${encodeURIComponent(slug)}?page=${page + 1}&limit=30`);
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as DealerCityData;
      setRows((r) => [...r, ...data.agents]);
      setPage(page + 1);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const left = total - shown - rows.length;
  return (
    <>
      {rows.length > 0 && (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {rows.map((d) => (
            <AgentCard key={d._id} d={d} />
          ))}
        </div>
      )}
      {page < pages && left > 0 && (
        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => void load()}
            disabled={busy}
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-400 bg-white px-6 text-[15px] font-semibold text-slate-900 hover:border-slate-500 disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Show more agents ({left.toLocaleString('en-PK')} more)
          </button>
          {failed && <p className="mt-2 text-[13px] text-red-700">Could not load more — please try again.</p>}
        </div>
      )}
    </>
  );
}

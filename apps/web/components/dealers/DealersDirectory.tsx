'use client';

import { useEffect, useRef, useState } from 'react';
import { AgencyCard, AgentRow } from './DealerCards';
import type { DealerCard, DealerCityData } from '@/lib/dealers';
import { cn } from '@/lib/utils';

/*
 * A city's dealers: a name search over the whole city (on the API), a switch
 * between agencies and agents, agencies as cards and agents as a ranked list,
 * and more agents a page at a time. The first page is in the HTML for search
 * engines; everything after it is fetched here.
 */

type Tab = 'all' | 'agencies' | 'agents';

function SearchGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <circle cx="8.6" cy="8.6" r="5.6" />
      <path d="M13 13l4.4 4.4" />
    </svg>
  );
}

export function DealersDirectory({ initial }: { initial: DealerCityData }) {
  const slug = initial.city.slug;
  const name = initial.city.name;
  const [tab, setTab] = useState<Tab>('all');
  const [q, setQ] = useState('');
  const [data, setData] = useState({ agencies: initial.agencies, agents: initial.agents, found: initial.found ?? initial.total, pages: initial.pageInfo.pages });
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const first = useRef(true);

  const fetchPage = async (term: string, p: number) => {
    const res = await fetch(`/api/dealers/city/${encodeURIComponent(slug)}?limit=30&page=${p}${term ? `&q=${encodeURIComponent(term)}` : ''}`);
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as DealerCityData;
  };

  // A new search, a moment after typing stops.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const term = q.trim();
    const t = setTimeout(async () => {
      setBusy(true);
      setFailed(false);
      try {
        const d = await fetchPage(term, 1);
        setData({ agencies: d.agencies, agents: d.agents, found: d.found ?? d.total, pages: d.pageInfo.pages });
        setPage(1);
      } catch {
        setFailed(true);
      } finally {
        setBusy(false);
      }
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const more = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const d = await fetchPage(q.trim(), page + 1);
      setData((cur) => ({ ...cur, agents: [...cur.agents, ...d.agents] }));
      setPage(page + 1);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const showAgencies = tab !== 'agents' && data.agencies.length > 0;
  const showAgents = tab !== 'agencies' && data.agents.length > 0;
  const left = data.found.agents - data.agents.length;
  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: data.found.agencies + data.found.agents },
    { key: 'agencies', label: 'Agencies', count: data.found.agencies },
    { key: 'agents', label: 'Agents', count: data.found.agents },
  ];

  return (
    <div>
      {/* Search and switch */}
      <div className="flex flex-col gap-3 rounded-lg border border-slate-300 bg-white p-3 sm:flex-row sm:items-center">
        <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-md border border-slate-400 px-3 focus-within:border-slate-900">
          <SearchGlyph className="h-[18px] w-[18px] shrink-0 text-slate-600" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search an agency or agent in ${name}`}
            className="min-w-0 flex-1 bg-transparent text-[15px] text-slate-900 outline-none placeholder:text-slate-500"
            aria-label="Search by name"
          />
          {busy && <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-slate-800" aria-hidden />}
        </label>
        <div className="grid grid-cols-3 overflow-hidden rounded-md border border-slate-400 sm:flex" role="tablist">
          {tabs.map((t, i) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'h-11 px-4 text-[14px] font-semibold',
                i > 0 && 'border-l border-slate-400',
                tab === t.key ? 'bg-slate-900 text-white' : 'bg-white text-slate-800 hover:bg-slate-100',
              )}
            >
              {t.label} <span className={cn('tabular-nums', tab === t.key ? 'text-white/75' : 'text-slate-500')}>{t.count}</span>
            </button>
          ))}
        </div>
      </div>
      {failed && <p className="mt-2 text-[13.5px] text-red-700">Could not load — please try again.</p>}

      {!showAgencies && !showAgents && (
        <p className="mt-6 rounded-lg border border-slate-300 bg-white px-4 py-8 text-center text-[15px] text-slate-700">
          {q.trim() ? <>No agency or agent named &ldquo;{q.trim()}&rdquo; in {name}.</> : 'Nothing to show here.'}
        </p>
      )}

      {showAgencies && (
        <section className="mt-7" aria-labelledby="agencies-h">
          <div className="flex items-baseline justify-between gap-3 border-b-2 border-slate-900 pb-2">
            <h2 id="agencies-h" className="text-[20px] font-bold tracking-tight text-slate-900 sm:text-[22px]">
              Real estate agencies in {name}
            </h2>
            <span className="shrink-0 text-[13.5px] font-semibold text-slate-600">{data.found.agencies} listed</span>
          </div>
          <p className="mt-2 text-[14px] text-slate-700">Established agencies with a team of agents — the biggest plans first.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.agencies.map((d: DealerCard) => (
              <AgencyCard key={d._id} d={d} />
            ))}
          </div>
        </section>
      )}

      {showAgents && (
        <section className="mt-9" aria-labelledby="agents-h">
          <div className="flex items-baseline justify-between gap-3 border-b-2 border-slate-900 pb-2">
            <h2 id="agents-h" className="text-[20px] font-bold tracking-tight text-slate-900 sm:text-[22px]">
              Property agents in {name}
            </h2>
            <span className="shrink-0 text-[13.5px] font-semibold text-slate-600">{data.found.agents} listed</span>
          </div>
          <p className="mt-2 text-[14px] text-slate-700">The agencies&apos; agents and independent dealers. Call or WhatsApp them directly.</p>
          <ul className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-300 bg-white">
            {data.agents.map((d: DealerCard) => (
              <AgentRow key={d._id} d={d} />
            ))}
          </ul>
          {page < data.pages && left > 0 && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => void more()}
                disabled={busy}
                className="h-11 rounded-md border border-slate-900 bg-white px-6 text-[15px] font-semibold text-slate-900 hover:bg-slate-900 hover:text-white disabled:opacity-60"
              >
                Show {Math.min(30, left)} more agents
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

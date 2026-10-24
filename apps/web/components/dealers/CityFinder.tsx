'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { dealersCityPath, type DealerCity } from '@/lib/dealers';
import { photo } from '@/lib/img';

/** The cities that have dealers, with a filter box — busiest first. */
export function CityFinder({ cities }: { cities: DealerCity[] }) {
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? cities.filter((c) => c.name.toLowerCase().includes(t)) : cities;
  }, [cities, q]);

  return (
    <div>
      <label className="flex h-12 items-center gap-2.5 rounded-md border border-slate-400 bg-white px-3.5 focus-within:border-slate-900">
        <svg viewBox="0 0 20 20" aria-hidden className="h-[18px] w-[18px] shrink-0 text-slate-600" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <circle cx="8.6" cy="8.6" r="5.6" />
          <path d="M13 13l4.4 4.4" />
        </svg>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find your city"
          aria-label="Find your city"
          className="min-w-0 flex-1 bg-transparent text-[15.5px] text-slate-900 outline-none placeholder:text-slate-500"
        />
      </label>

      {shown.length === 0 ? (
        <p className="mt-4 rounded-lg border border-slate-300 bg-white px-4 py-8 text-center text-[15px] text-slate-700">
          No dealers listed in &ldquo;{q.trim()}&rdquo; yet.
        </p>
      ) : (
        <ul className="mt-4 grid overflow-hidden rounded-lg border border-slate-300 bg-white sm:grid-cols-2">
          {shown.map((c) => (
            <li key={c._id} className="border-b border-slate-200 sm:odd:border-r">
              <Link href={dealersCityPath(c.slug)} className="group flex items-center gap-3.5 px-4 py-3.5 hover:bg-slate-50">
                <span className="h-12 w-16 shrink-0 overflow-hidden rounded-md border border-slate-300 bg-slate-200">
                  {c.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo(c.thumbnail, 160)} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <span className="grid h-full w-full place-items-center bg-slate-800 text-[15px] font-bold text-white">{c.name.slice(0, 2).toUpperCase()}</span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-bold text-slate-900 group-hover:underline">Property dealers in {c.name}</span>
                  <span className="block text-[13.5px] text-slate-700">
                    {c.agencies > 0 && `${c.agencies} ${c.agencies === 1 ? 'agency' : 'agencies'}`}
                    {c.agencies > 0 && c.agents > 0 && ' · '}
                    {c.agents > 0 && `${c.agents} ${c.agents === 1 ? 'agent' : 'agents'}`}
                  </span>
                </span>
                <span aria-hidden className="text-[20px] text-slate-400 group-hover:text-slate-900">
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import Link from 'next/link';
import { PlanGlyph } from '@/components/map/MapGlyphs';
import { lookupSocietyMap } from '@/lib/society-map';

/* On an area's listing pages: a way to its society map, when one is published. */
export default async function SocietyMapBanner({ city, area }: { city: string; area?: string | null }) {
  if (!city || !area) return null;
  const hit = await lookupSocietyMap(city, area);
  if (!hit?.url) return null;
  return (
    <div className="container mx-auto px-[var(--gutter)] pt-2 sm:px-4">
      <Link
        href={hit.url}
        className="group flex items-center gap-3 rounded-lg border border-slate-900 bg-white px-3 py-2.5 text-slate-900 transition-colors hover:bg-slate-50"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-slate-900 text-white">
          <PlanGlyph className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold group-hover:underline">{hit.name} map</span>
          <span className="block truncate text-[13px] text-slate-700">Master plan on satellite — blocks, landmarks and these listings</span>
        </span>
        <span aria-hidden className="text-[22px] leading-none text-slate-500">›</span>
      </Link>
    </div>
  );
}

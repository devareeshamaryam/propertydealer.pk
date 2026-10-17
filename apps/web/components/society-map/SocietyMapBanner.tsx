import Link from 'next/link';
import { ChevronRight, Map as MapIcon } from 'lucide-react';
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
        className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-3 py-2.5 text-primary transition-colors hover:bg-primary/10"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-white">
          <MapIcon className="h-[18px] w-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14.5px] font-bold">{hit.name} map</span>
          <span className="block truncate text-[12.5px] text-slate-600">Master plan on satellite — blocks, landmarks and these listings</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0" />
      </Link>
    </div>
  );
}

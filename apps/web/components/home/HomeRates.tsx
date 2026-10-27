import Link from 'next/link';
import Image from 'next/image';
import { TYPE_META, imageSrc, isBuiltIn } from '@/lib/shop';
import type { RateSummary } from '@/lib/server-api';

/*
 * Homepage: today's construction rates as a rates board — one row per
 * material (Cement, Steel… and every material added from the dashboard) with
 * its lowest rate, the range across brands, and how prices moved today. A
 * table from a tablet up, a compact list on a phone.
 */

const unsplash = (id: string) => `https://images.unsplash.com/${id}?w=160&h=120&fit=crop&q=70&auto=format`;

/** A close-up of each material. */
const BUILT_IN_PHOTO: Record<string, string> = {
  cement: unsplash('photo-1773394089934-3e29f2a3d6a9'),
  steel: unsplash('photo-1745909247906-123b53b70e06'),
  bricks: unsplash('photo-1547056961-3c25e9140b05'),
  sand: unsplash('photo-1632199670702-3ea3f70909cb'),
  bajri: unsplash('photo-1557533618-abdc7b3ae7b0'),
  wood: unsplash('photo-1561435354-298941a0d4a2'),
  door: unsplash('photo-1630579083524-e3ac854edb46'),
  tile: unsplash('photo-1771843471340-7387d7d903ce'),
};

/** Added materials: a matching photo by name, for the common ones. */
const NAMED_PHOTO: [RegExp, string][] = [
  [/marble/, unsplash('photo-1558346648-9757f2fa4474')],
  [/granite|stone/, unsplash('photo-1585749864755-f1adb4ec8e29')],
  [/paint|emulsion|enamel/, unsplash('photo-1784887830054-ea5fbe193e7c')],
  [/glass|window/, unsplash('photo-1523477593243-78bbf626fd3b')],
  [/sanitary|bath|tap|faucet|commode/, unsplash('photo-1542855368-ca6ea825bca2')],
  [/wire|cable|electric/, unsplash('photo-1761507320645-b11a00bfcc34')],
  [/pipe|pvc|ppr/, unsplash('photo-1616661317985-aeb2a13016d6')],
  [/ply|mdf|board/, unsplash('photo-1591709990007-25dd40fa4b63')],
  [/tile/, BUILT_IN_PHOTO.tile!],
  [/wood|timber/, BUILT_IN_PHOTO.wood!],
];

/** The admin's photo for the material, else a ready photo, else one of its products. */
function photoFor(r: RateSummary): string {
  if (r.materialImage) return imageSrc(r.materialImage);
  if (BUILT_IN_PHOTO[r.type]) return BUILT_IN_PHOTO[r.type]!;
  const name = `${r.type} ${r.label}`.toLowerCase();
  const named = NAMED_PHOTO.find(([re]) => re.test(name));
  if (named) return named[1];
  return r.image ? imageSrc(r.image) : BUILT_IN_PHOTO.cement!;
}

/** The unit a material is usually sold by — when its products only say "Per Unit". */
const USUAL_UNIT: Record<string, string> = {
  cement: '50 kg bag',
  steel: 'kg',
  bricks: 'brick',
  sand: 'cft',
  bajri: 'cft',
  wood: 'cft',
  door: 'piece',
};

/** "per 50 kg bag"; nothing when the unit says nothing. */
function unitOf(r: RateSummary): string {
  const u = String(r.unit ?? '').trim();
  const vague = !u || /^(per\s+)?(unit|units|item|pc)$/i.test(u);
  const unit = vague ? USUAL_UNIT[r.type] ?? '' : u;
  if (!unit) return '';
  return /^per\b/i.test(unit) ? unit.replace(/^per/i, 'per') : `per ${unit}`;
}

const rs = (n: number) => `Rs ${Math.round(n).toLocaleString('en-PK')}`;
const nameOf = (r: RateSummary) => (isBuiltIn(r.type) ? TYPE_META[r.type].label : r.label);

/** Today's moves: ▲ up in green, ▼ down in red, or steady. */
function Moves({ up, down, compact }: { up: number; down: number; compact?: boolean }) {
  if (up === 0 && down === 0) return <span className="text-[13px] font-medium text-slate-500">Steady</span>;
  return (
    <span className={compact ? 'flex gap-2' : 'flex flex-col gap-0.5'}>
      {up > 0 && (
        <span className="whitespace-nowrap text-[13px] font-bold text-emerald-700">
          <span aria-hidden>▲</span> {up} up
        </span>
      )}
      {down > 0 && (
        <span className="whitespace-nowrap text-[13px] font-bold text-red-700">
          <span aria-hidden>▼</span> {down} down
        </span>
      )}
    </span>
  );
}

function Thumb({ r, className }: { r: RateSummary; className: string }) {
  const src = photoFor(r);
  return (
    <span className={`relative block shrink-0 overflow-hidden rounded-sm border border-slate-300 bg-slate-200 ${className}`}>
      <Image src={src} alt={`${nameOf(r)} rate in Pakistan today`} fill sizes="80px" className="object-cover" unoptimized={!src.startsWith('https://images.unsplash.com/')} />
    </span>
  );
}

export default function HomeRates({ rates }: { rates: RateSummary[] }) {
  if (!rates.length) return null;
  const latest = rates.reduce((t, r) => Math.max(t, r.updatedAt ? Date.parse(r.updatedAt) || 0 : 0), 0);
  const updated = latest ? new Date(latest).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

  return (
    <section className="border-t border-slate-200 bg-[#f4f5f7] py-8 sm:py-12">
      <div className="container mx-auto px-4">
        <div className="mb-4 flex flex-col gap-2 sm:mb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-[22px] font-extrabold tracking-tight text-slate-900 sm:text-[28px]">Today&apos;s construction rates</h2>
            <p className="mt-1 max-w-2xl text-[14.5px] text-slate-700 sm:text-[15.5px]">
              Lowest rates of cement, steel, bricks and more from suppliers across Pakistan — check the rate, then order with cash on delivery.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-4 text-[13.5px]">
            {updated && <span className="text-slate-600">Updated {updated}</span>}
            <Link href="/today-cement-rate-in-pakistan" className="font-bold text-slate-900 underline-offset-4 hover:underline">
              All rates ›
            </Link>
          </div>
        </div>

        {/* Tablet and up: the rates board. */}
        <div className="hidden overflow-hidden rounded-lg border border-slate-300 bg-white sm:block">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-900 text-[11.5px] font-bold uppercase tracking-wider text-white">
                <th scope="col" className="px-4 py-3">Material</th>
                <th scope="col" className="px-4 py-3">Lowest rate</th>
                <th scope="col" className="hidden px-4 py-3 md:table-cell">Range</th>
                <th scope="col" className="px-4 py-3">Today</th>
                <th scope="col" className="px-4 py-3 text-right">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rates.map((r) => {
                const label = nameOf(r);
                const unit = unitOf(r);
                return (
                  <tr key={r.type} className="group relative hover:bg-slate-50">
                    <th scope="row" className="px-4 py-3 font-normal">
                      <Link href={r.path} className="flex items-center gap-3 after:absolute after:inset-0">
                        <Thumb r={r} className="h-11 w-14" />
                        <span className="min-w-0">
                          <span className="block text-[16px] font-bold text-slate-900 group-hover:underline">{label}</span>
                          <span className="block text-[13px] text-slate-600">
                            {r.products} {r.products === 1 ? 'product' : 'brands & sizes'}
                          </span>
                        </span>
                      </Link>
                    </th>
                    <td className="px-4 py-3">
                      <span className="block text-[17px] font-extrabold tabular-nums text-slate-900">{rs(r.from)}</span>
                      {unit && <span className="block text-[12.5px] text-slate-600">{unit}</span>}
                    </td>
                    <td className="hidden px-4 py-3 text-[14px] tabular-nums text-slate-700 md:table-cell">
                      {r.to > r.from ? `${rs(r.from)} – ${Math.round(r.to).toLocaleString('en-PK')}` : 'One price'}
                    </td>
                    <td className="px-4 py-3">
                      <Moves up={r.up} down={r.down} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex h-9 items-center rounded-md border border-slate-400 px-3 text-[13.5px] font-semibold text-slate-900 group-hover:border-slate-900">
                        See rates
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Phone: the same, as a list. */}
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-300 bg-white sm:hidden">
          {rates.map((r) => {
            const unit = unitOf(r);
            return (
              <li key={r.type}>
                <Link href={r.path} className="flex items-center gap-3 px-3 py-3 active:bg-slate-50">
                  <Thumb r={r} className="h-11 w-12" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold text-slate-900">{nameOf(r)}</span>
                    <Moves up={r.up} down={r.down} compact />
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[15.5px] font-extrabold tabular-nums text-slate-900">{rs(r.from)}</span>
                    {unit && <span className="block text-[11.5px] text-slate-600">{unit}</span>}
                  </span>
                  <span aria-hidden className="text-[20px] leading-none text-slate-400">
                    ›
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

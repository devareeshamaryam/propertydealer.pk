import Link from 'next/link';
import Image from 'next/image';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { TYPE_META, imageSrc, isBuiltIn } from '@/lib/shop';
import type { RateSummary } from '@/lib/server-api';
import { SectionHeading } from '@/components/SectionHeading';

/*
 * Homepage: today's construction rates, under the packages. One photo card
 * per material — Cement, Steel… and every material added from the
 * dashboard — with its lowest price, how many brands, and whether prices
 * moved today. A row that scrolls on a phone, a grid on a desktop.
 */

const photo = (id: string) => `https://images.unsplash.com/${id}?w=600&h=450&fit=crop&q=70&auto=format`;

/** A close-up of each material, the way you would picture it. */
const BUILT_IN_PHOTO: Record<string, string> = {
  cement: photo('photo-1773394089934-3e29f2a3d6a9'),
  steel: photo('photo-1745909247906-123b53b70e06'),
  bricks: photo('photo-1547056961-3c25e9140b05'),
  sand: photo('photo-1632199670702-3ea3f70909cb'),
  bajri: photo('photo-1557533618-abdc7b3ae7b0'),
  wood: photo('photo-1561435354-298941a0d4a2'),
  door: photo('photo-1630579083524-e3ac854edb46'),
  tile: photo('photo-1771843471340-7387d7d903ce'),
};

/** Added materials: a matching photo by name, for the common ones. */
const NAMED_PHOTO: [RegExp, string][] = [
  [/marble/, photo('photo-1558346648-9757f2fa4474')],
  [/granite|stone/, photo('photo-1585749864755-f1adb4ec8e29')],
  [/paint|emulsion|enamel/, photo('photo-1784887830054-ea5fbe193e7c')],
  [/glass|window/, photo('photo-1523477593243-78bbf626fd3b')],
  [/sanitary|bath|tap|faucet|commode/, photo('photo-1542855368-ca6ea825bca2')],
  [/wire|cable|electric/, photo('photo-1761507320645-b11a00bfcc34')],
  [/pipe|pvc|ppr/, photo('photo-1616661317985-aeb2a13016d6')],
  [/ply|mdf|board/, photo('photo-1591709990007-25dd40fa4b63')],
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

const rs = (n: number) => `Rs ${Math.round(n).toLocaleString('en-PK')}`;
/** "Per sq ft" → "per sq ft"; "50 kg bag" → "per 50 kg bag". */
const perUnit = (u: string) => (/^per\b/i.test(u) ? u.replace(/^per/i, 'per') : `per ${u}`);

/** Today's moves, on the photo — nothing when prices held. */
function Moves({ up, down }: { up: number; down: number }) {
  if (up === 0 && down === 0) return null;
  return (
    <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-2 rounded-full bg-white/95 px-2 py-1 text-[11.5px] font-bold shadow-sm backdrop-blur">
      {up > 0 && (
        <span className="inline-flex items-center gap-0.5 text-emerald-600">
          <ArrowUpRight className="h-3.5 w-3.5" /> {up} up
        </span>
      )}
      {down > 0 && (
        <span className="inline-flex items-center gap-0.5 text-red-600">
          <ArrowDownRight className="h-3.5 w-3.5" /> {down} down
        </span>
      )}
    </span>
  );
}

export default function HomeRates({ rates }: { rates: RateSummary[] }) {
  if (!rates.length) return null;

  return (
    <section className="border-t border-slate-100 bg-gradient-to-b from-slate-50/80 to-white py-6 sm:py-12">
      <div className="container mx-auto px-4">
        <SectionHeading
          title="Today's construction rates"
          description="Cement, steel, bricks and more from suppliers across Pakistan — check the rate, then order online with cash on delivery."
          action={
            <Link
              href="/today-cement-rate-in-pakistan"
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
            >
              View all
              <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />

        <ul className="hide-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-4 xl:grid-cols-5">
          {rates.map((r) => {
            const label = isBuiltIn(r.type) ? TYPE_META[r.type].label : r.label;
            const src = photoFor(r);
            return (
              <li key={r.type} className="w-[64%] shrink-0 snap-start min-[460px]:w-[44%] sm:w-auto">
                <Link
                  href={r.path}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_12px_30px_-14px_rgba(15,23,42,0.35)]"
                >
                  <span className="relative block aspect-[4/3] overflow-hidden bg-slate-100">
                    <Image
                      src={src}
                      alt={`${label} rate in Pakistan today`}
                      fill
                      sizes="(min-width: 1280px) 240px, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 64vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      unoptimized={!src.startsWith('https://images.unsplash.com/')}
                    />
                    <span className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
                    <Moves up={r.up} down={r.down} />
                    <span className="absolute inset-x-3 bottom-2.5 text-white">
                      <span className="block text-[17px] font-bold leading-tight drop-shadow-sm">{label}</span>
                      <span className="block text-[12px] text-white/85">
                        {r.products} {r.products === 1 ? 'product' : 'brands & sizes'}
                      </span>
                    </span>
                  </span>
                  <span className="flex flex-1 items-end justify-between gap-2 p-3.5">
                    <span className="min-w-0">
                      <span className="block text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">{r.to > r.from ? 'From' : 'Price'}</span>
                      <span className="block text-[18px] font-extrabold tabular-nums leading-tight tracking-tight text-slate-900">{rs(r.from)}</span>
                      <span className="block truncate text-[12px] text-slate-500">{perUnit(r.unit)}</span>
                    </span>
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 transition-colors group-hover:bg-primary group-hover:text-white">
                      <ArrowRight className="h-4 w-4" />
                    </span>
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

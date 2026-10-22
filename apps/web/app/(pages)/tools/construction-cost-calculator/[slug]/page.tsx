import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import ConstructionCalculator from '@/components/tools/ConstructionCalculator';
import CostIndex from '@/components/tools/CostIndex';
import ToolShell from '@/components/tools/ToolShell';
import { ccHref, citySlug, parseCcSlug, sampleHouse } from '@/lib/construction-pages';
import { getConstructionData } from '@/lib/server-api';
import { CONSTRUCTION_FALLBACK, QUALITY, rsShort, rupees, toolBySlug } from '@/lib/tools';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealer.pk';
const tool = toolBySlug('construction-cost-calculator');
const YEAR = new Date().getFullYear();

export const revalidate = 300;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

type Params = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  const parsed = parseCcSlug(slug);
  if (!parsed) return null;
  const data = (await getConstructionData()) ?? CONSTRUCTION_FALLBACK;
  const city = data.config.cities.find((c) => citySlug(c.name) === parsed.city);
  if (!city) return null;
  const { size, kind } = parsed;
  const what = kind === 'grey' ? 'Grey Structure' : 'House Construction';
  const title = `${size.label} ${what} Cost in ${city.name}`;
  const est = sampleHouse(data, size.sqft, kind, city.name);
  return { data, size, kind, city: city.name, title, est, path: ccHref(size, kind, city.name) };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const p = await load((await params).slug);
  if (!p) return {};
  const thing = p.kind === 'grey' ? 'grey structure of a' : 'a';
  return {
    title: `${p.title} ${YEAR} — ${rsShort(p.est.total)}`,
    description: `Building the ${thing} ${p.size.label} double-storey house in ${p.city} costs about ${rsShort(p.est.total)} (${rupees(p.est.perSqft)} per sq ft) on today's cement, steel and brick rates. Full breakdown, material list and cost by quality.`,
    alternates: { canonical: `${BASE_URL}${p.path}` },
  };
}

export default async function Page({ params }: Params) {
  const p = await load((await params).slug);
  if (!p) notFound();
  const { data, size, kind, city, est } = p;
  const grey = kind === 'grey';
  const other = sampleHouse(data, size.sqft, grey ? 'house' : 'grey', city);
  const tiers = QUALITY.map((q) => ({
    q,
    full: sampleHouse(data, size.sqft, kind, city, q.key, 'full'),
    labour: sampleHouse(data, size.sqft, kind, city, q.key, 'labour'),
  }));
  const thing = grey ? `the grey structure of a ${size.label} house` : `a ${size.label} house`;

  const faqs = [
    {
      q: `What is the cost of building ${thing} in ${city}?`,
      a: `About ${rsShort(est.total)} for a double-storey house of ${Math.round(est.area).toLocaleString('en-PK')} sq ft, at standard quality on a full contract and today's rates. Economy quality comes to about ${rsShort(tiers[0]!.full.total)} and premium about ${rsShort(tiers[2]!.full.total)}.`,
    },
    {
      q: `What is the ${grey ? 'grey structure' : 'construction'} rate per square foot in ${city}?`,
      a: `About ${rupees(est.perSqft)} per sq ft of covered area at standard quality — ${rupees(tiers[0]!.full.perSqft)} for economy and ${rupees(tiers[3]!.full.perSqft)} for luxury.`,
    },
    grey
      ? {
          q: 'What is included in the grey structure?',
          a: 'Digging and foundation, columns, beams and roof slabs, brick walls, plaster, waterproofing and termite proofing, and the water, sewerage, gas and electrical pipes inside the walls — with the labour for all of it.',
        }
      : {
          q: `What does finishing cost for a ${size.label} house in ${city}?`,
          a: `The grey structure is about ${rsShort(other.total)}; finishing — tiles, doors and windows, wiring and fittings, paint, woodwork, bathrooms and kitchens — adds about ${rsShort(est.total - other.total)}.`,
        },
    {
      q: 'How much material is needed?',
      a: (() => {
        const m = (k: string) => est.groups[0]?.lines.find((l) => l.key === k)?.qty ?? 0;
        return `Roughly ${m('cement').toLocaleString('en-PK')} bags of cement, ${(m('steel') / 1000).toFixed(1)} tons of steel, ${Math.round(m('bricks') / 1000)} thousand bricks, ${m('sand').toLocaleString('en-PK')} cft of sand and ${m('crush').toLocaleString('en-PK')} cft of crush.`;
      })(),
    },
  ];

  return (
    <ToolShell
      tool={tool}
      page={{ title: p.title, path: p.path }}
      heading={`${p.title} ${YEAR}`}
      intro={`Building ${thing} (double storey, ${Math.round(est.area).toLocaleString('en-PK')} sq ft covered) in ${city} costs about ${rsShort(est.total)} — ${rupees(est.perSqft)} per sq ft — at standard quality on today's rates.`}
      faqs={faqs}
      guide={<CostIndex data={data} city={city} current={{ size, kind }} />}
    >
      <div className="space-y-5">
        {/* The answer at every quality — readable without the calculator. */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-[17px] font-bold text-slate-900">Cost by quality</h2>
          <div className="mt-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {tiers.map(({ q, full, labour }) => (
              <div key={q.key} className={q.key === 'standard' ? 'rounded-xl border-2 border-primary/50 bg-primary/[0.04] p-3.5' : 'rounded-xl border border-slate-200 p-3.5'}>
                <p className="text-[13px] font-bold text-slate-700">{q.label}</p>
                <p className="mt-0.5 text-[21px] font-extrabold leading-tight tabular-nums text-slate-900">{rsShort(full.total)}</p>
                <p className="text-[12.5px] tabular-nums text-slate-500">{rupees(full.perSqft)} per sq ft</p>
                <p className="mt-1.5 text-[12px] text-slate-500">
                  Labour contract: <b className="tabular-nums text-slate-700">{rsShort(labour.total)}</b>
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[13px] text-slate-500">
            {grey ? 'Want it ready to live in? ' : 'Only the grey structure? '}
            <Link href={ccHref(size, grey ? 'house' : 'grey', city)} className="font-semibold text-primary hover:underline">
              {size.label} {grey ? 'complete house' : 'grey structure'} in {city}: {rsShort(other.total)}
            </Link>
          </p>
        </section>

        <div>
          <h2 className="mb-3 text-[17px] font-bold text-slate-900">Make it your own</h2>
          <Suspense fallback={<div className="h-[560px] animate-pulse rounded-2xl bg-white" />}>
            <ConstructionCalculator data={data} start={{ city, size: size.key, kind: grey ? 'grey' : 'complete' }} />
          </Suspense>
        </div>
      </div>
    </ToolShell>
  );
}

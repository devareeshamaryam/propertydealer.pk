import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import ConstructionCalculator from '@/components/tools/ConstructionCalculator';
import ToolShell from '@/components/tools/ToolShell';
import { amountShort } from '@/lib/pk';
import { getConstructionData } from '@/lib/server-api';
import { CONSTRUCTION_FALLBACK, coveredAreas, estimate, rupees, toolBySlug, usualRooms, type ConstructionData } from '@/lib/tools';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealer.pk';
const tool = toolBySlug('construction-cost-calculator');

export const revalidate = 300;

export const metadata: Metadata = {
  title: `Construction Cost Calculator Pakistan ${new Date().getFullYear()} — Grey Structure & Complete House`,
  description: tool.description,
  alternates: { canonical: `${BASE_URL}/tools/${tool.slug}` },
};

const SIZES = [
  { label: '3 Marla', v: 3, u: 'marla', sqft: 675 },
  { label: '5 Marla', v: 5, u: 'marla', sqft: 1125 },
  { label: '7 Marla', v: 7, u: 'marla', sqft: 1575 },
  { label: '10 Marla', v: 10, u: 'marla', sqft: 2250 },
  { label: '1 Kanal', v: 1, u: 'kanal', sqft: 4500 },
  { label: '2 Kanal', v: 2, u: 'kanal', sqft: 9000 },
];

/** A double-storey house of this plot size, standard quality, full contract. */
function sample(data: ConstructionData, plotSqft: number, kind: 'grey' | 'complete') {
  const covered = coveredAreas(plotSqft, { floors: 2, basement: false }).reduce((s, f) => s + f.sqft, 0);
  const rooms = usualRooms(covered, 2);
  const city = data.config.cities[0];
  return estimate(
    {
      covered,
      basement: 0,
      kind,
      quality: 'standard',
      mode: 'full',
      cityFactor: city?.factor ?? 1,
      cityRates: city ? data.cityRates?.[city.name] : undefined,
      bathrooms: rooms.bathrooms,
      kitchens: rooms.kitchens,
    },
    data,
  );
}

export default async function Page() {
  const data = (await getConstructionData()) ?? CONSTRUCTION_FALLBACK;
  const city = data.config.cities[0]?.name ?? 'Lahore';
  const c = data.config;
  const rows = SIZES.map((s) => ({ ...s, grey: sample(data, s.sqft, 'grey'), complete: sample(data, s.sqft, 'complete') }));
  const five = rows[1]!;
  const rate = (m: string) => data.rates.find((r) => r.material === m)?.mid ?? 0;

  const faqs = [
    {
      q: 'What is the cost of grey structure per square foot in Pakistan?',
      a: `On today's rates — cement ${rupees(rate('cement'))} a bag, steel ${rupees(rate('steel'))} a kg, bricks ${rupees(rate('bricks'))} each — a standard grey structure on a full contract comes to about ${rupees(five.grey.perSqft)} per sq ft of covered area in ${city}, and a complete house about ${rupees(five.complete.perSqft)}. Economy builds cost less, premium and luxury more; the calculator works it out for your city, size and quality.`,
    },
    {
      q: 'What is the construction cost of a 5 marla house?',
      a: `A 5 marla double-storey house has about ${Math.round(five.grey.area).toLocaleString('en-PK')} sq ft of covered area. In ${city}, at standard quality, the grey structure costs about ${amountShort(five.grey.total)} and a complete house about ${amountShort(five.complete.total)}.`,
    },
    {
      q: 'How much cement, steel and bricks does a house need?',
      a: `Each square foot of covered area takes about ${c.qty.cement} bags of cement, ${c.qty.steel} kg of steel, ${c.qty.bricks} bricks, ${c.qty.sand} cft of sand and ${c.qty.crush} cft of crush. A 5 marla double storey therefore needs roughly ${Math.round(five.grey.area * c.qty.cement)} bags of cement, ${((five.grey.area * c.qty.steel) / 1000).toFixed(1)} tons of steel and ${Math.round((five.grey.area * c.qty.bricks) / 1000)} thousand bricks.`,
    },
    {
      q: 'What is the difference between grey structure and a complete house?',
      a: 'Grey structure is the foundation, columns, beams, roof slabs, brick walls, plaster, and the water, sewerage, gas and electrical pipes inside the walls. Finishing — tiles, doors and windows, wiring and fittings, paint, wardrobes, bathrooms and kitchens — makes it ready to live in, and usually costs as much as the grey structure or more.',
    },
    {
      q: 'Full contract or labour contract?',
      a: `On a full contract the contractor buys the material and adds his overhead and profit (about ${c.contractorPct}%). On a labour contract you buy the material yourself and pay him for labour only — usually cheaper, but you have to manage the buying. The calculator shows both.`,
    },
    {
      q: 'What is not included?',
      a: 'The plot, the architect and map approval fees, soil testing, boundary walls, electricity, gas and water connections, solar and furniture.',
    },
  ];

  return (
    <ToolShell
      tool={tool}
      heading="Construction Cost Calculator"
      intro="What will it cost to build? Grey structure or a complete house — priced on today's cement, steel, bricks, sand and crush rates, with every quantity shown."
      faqs={faqs}
      guide={
        <>
          <h2 className="text-[21px] font-bold tracking-tight text-slate-900">Construction cost by plot size — {city}</h2>
          <p className="text-[14px] text-slate-500">Double storey, standard quality, full contract, on today&apos;s rates.</p>
          <div className="-mx-[var(--gutter)] overflow-x-auto px-[var(--gutter)] sm:mx-0 sm:px-0">
            <table className="w-full min-w-[520px] overflow-hidden rounded-2xl border border-slate-200 bg-white text-[14px]">
              <thead className="bg-slate-50 text-left text-[12px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Plot</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Covered area</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Grey structure</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Complete house</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {rows.map((r) => (
                  <tr key={r.label} className="border-t border-slate-100">
                    <td className="px-3 py-2.5">
                      <Link href={`/tools/${tool.slug}?size=${r.v}&unit=${r.u}&floors=2`} className="font-semibold text-primary hover:underline">
                        {r.label}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-right">{Math.round(r.grey.area).toLocaleString('en-PK')} ft²</td>
                    <td className="px-3 py-2.5 text-right">
                      {amountShort(r.grey.total)}
                      <span className="block text-[11.5px] text-slate-400">{rupees(r.grey.perSqft)}/ft²</span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold">
                      {amountShort(r.complete.total)}
                      <span className="block text-[11.5px] font-normal text-slate-400">{rupees(r.complete.perSqft)}/ft²</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h2 className="pt-4 text-[21px] font-bold tracking-tight text-slate-900">How the estimate is worked out</h2>
          <p>
            The covered area comes from your plot size and storeys — the share of the plot a floor usually covers after setbacks (about 90% on 5
            marla, 75% on 10 marla, 70% on a kanal) — or from your map. Each square foot needs a known amount of cement, steel, bricks, sand and
            crush, priced at today&apos;s market rates: cheaper products for economy, typical for standard, better ones for premium and luxury.
          </p>
          <p>
            Digging, shuttering, waterproofing and the pipes and conduits inside the walls are added per square foot, then labour. For a complete
            house come tiles, doors and windows, wiring and fittings, paint and woodwork, and each bathroom and kitchen. Labour and finishing follow
            your city, and they move with material prices so the figures stay current.
          </p>
        </>
      }
    >
      <Suspense fallback={<div className="h-[640px] animate-pulse rounded-2xl bg-white" />}>
        <ConstructionCalculator data={data} />
      </Suspense>
    </ToolShell>
  );
}

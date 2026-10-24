import type { Metadata } from 'next';
import { Suspense } from 'react';
import ConstructionCalculator from '@/components/tools/ConstructionCalculator';
import CostIndex from '@/components/tools/CostIndex';
import ToolShell from '@/components/tools/ToolShell';
import { CC_SIZES, sampleHouse } from '@/lib/construction-pages';
import { getConstructionData } from '@/lib/server-api';
import { CONSTRUCTION_FALLBACK, rsShort, rupees, toolBySlug } from '@/lib/tools';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealer.pk';
const tool = toolBySlug('construction-cost-calculator');

export const revalidate = 300;

const TITLE = `House Construction Cost Calculator Pakistan ${new Date().getFullYear()} — Grey & Complete`;
const DESCRIPTION =
  "Free house construction cost calculator for Pakistan: estimate grey structure and complete house cost on today's cement, steel and brick rates — by city, plot size and storeys.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: ['house construction cost calculator', 'house construction cost calculator pakistan', 'construction cost calculator pakistan', 'construction cost calculator', 'grey structure cost', 'construction cost per square foot pakistan'],
  alternates: { canonical: `${BASE_URL}/tools/${tool.slug}` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${BASE_URL}/tools/${tool.slug}`, type: 'website' },
};

export default async function Page() {
  const data = (await getConstructionData()) ?? CONSTRUCTION_FALLBACK;
  const city = data.config.cities[0]?.name ?? 'Lahore';
  const c = data.config;
  const five = CC_SIZES.find((s) => s.key === '5-marla')!;
  const grey = sampleHouse(data, five.sqft, 'grey', city);
  const house = sampleHouse(data, five.sqft, 'house', city);
  const rate = (m: string) => data.rates.find((r) => r.material === m)?.mid ?? 0;

  const faqs = [
    {
      q: 'How does this house construction cost calculator work?',
      a: `Choose your plot size, storeys, city, quality and who buys the material. The construction cost calculator multiplies the covered area by the cement, steel, bricks, sand and crush a house needs, prices them at today's rates in ${city}, and adds labour, finishing, bathrooms, kitchens and the contractor's share — so you see the total and where every rupee goes.`,
    },
    {
      q: 'What is the construction cost per square foot in Pakistan?',
      a: `On today's rates a standard grey structure costs about ${rupees(grey.perSqft)} per sq ft of covered area in ${city}, and a complete house about ${rupees(house.perSqft)}. Economy builds cost less, premium and luxury more.`,
    },
    {
      q: 'What is the construction cost of a 5 marla house?',
      a: `A 5 marla double-storey house has about ${Math.round(house.area).toLocaleString('en-PK')} sq ft of covered area. In ${city}, at standard quality, the grey structure costs about ${rsShort(grey.total)} and a complete house about ${rsShort(house.total)}.`,
    },
    {
      q: 'How much cement, steel and bricks does a house need?',
      a: `About ${c.qty.cement} bags of cement, ${c.qty.steel} kg of steel and ${c.qty.bricks} bricks per sq ft of covered area — for a 5 marla double storey roughly ${Math.round(grey.area * c.qty.cement)} bags of cement, ${((grey.area * c.qty.steel) / 1000).toFixed(1)} tons of steel and ${Math.round((grey.area * c.qty.bricks) / 1000)} thousand bricks, at cement ${rupees(rate('cement'))} a bag and steel ${rupees(rate('steel'))} a kg today.`,
    },
    {
      q: 'What is the difference between grey structure and a complete house?',
      a: 'Grey structure is the foundation, columns, beams, roof slabs, brick walls, plaster, and the water, sewerage, gas and electrical pipes inside the walls. Finishing — tiles, doors and windows, wiring and fittings, paint, woodwork, bathrooms and kitchens — makes it ready to live in.',
    },
    {
      q: 'Full contract or labour contract?',
      a: `On a full contract the contractor buys the material and adds about ${c.contractorPct}% for his overhead and profit. On a labour contract you buy the material and pay him for labour only — cheaper, but you manage the buying.`,
    },
  ];

  return (
    <ToolShell
      tool={tool}
      heading="House Construction Cost Calculator Pakistan"
      intro="A construction cost calculator for Pakistan on live rates: pick your plot, storeys and city — see the grey structure and complete house cost on today's cement, steel and brick prices, and where every rupee goes."
      faqs={faqs}
      guide={<CostIndex data={data} city={city} />}
    >
      <Suspense fallback={<div className="h-[560px] animate-pulse rounded-lg bg-white" />}>
        <ConstructionCalculator data={data} />
      </Suspense>
    </ToolShell>
  );
}

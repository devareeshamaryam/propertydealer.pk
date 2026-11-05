import type { Metadata } from 'next';
import CementCalculator from '@/components/tools/CementCalculator';
import ToolShell from '@/components/tools/ToolShell';
import { getConstructionData } from '@/lib/server-api';
import { concrete, CONSTRUCTION_FALLBACK, plaster, rateOf, rupees, toolBySlug } from '@/lib/tools';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealer.pk';
const tool = toolBySlug('cement-bags-calculator');

export const revalidate = 300;

const TITLE = `Cement Bags Calculator Pakistan ${new Date().getFullYear()} — Concrete, Plaster & Brickwork`;
const DESCRIPTION =
  "Free cement calculator for Pakistan: cement bags, sand and crush (bajri) for a roof slab, beam, column, footing, plaster or brick mortar — any mix — on today's rates.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: ['cement calculator', 'cement bags calculator', 'cement calculator pakistan', 'how many cement bags for slab', 'cement sand crush calculator', '1:2:4 concrete calculator', 'plaster cement calculator'],
  alternates: { canonical: `${BASE_URL}/tools/${tool.slug}` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${BASE_URL}/tools/${tool.slug}`, type: 'website' },
};

export default async function Page() {
  const data = (await getConstructionData()) ?? CONSTRUCTION_FALLBACK;
  const m = data.config.masonry;
  const city = data.config.cities[0]?.name ?? 'Lahore';
  const cubicMetre = concrete(35.315, '1:2:4', m);
  const slab = concrete(1000 * (5 / 12), '1:2:4', m);
  const plaster100 = plaster(100, 0.5, 4, m);
  const cement = rateOf(data, 'cement', city);

  const faqs = [
    { q: 'How many cement bags are in 1 cubic metre of 1:2:4 concrete?', a: `About ${cubicMetre.cementBags.toFixed(1)} bags of 50 kg, with ${Math.round(cubicMetre.sandCft)} cft of sand and ${Math.round(cubicMetre.crushCft)} cft of crush — the dry materials are ${m.concreteDryFactor} times the finished volume.` },
    { q: 'How many cement bags does a 1,000 sq ft roof slab need?', a: `A 5-inch slab of 1,000 sq ft in 1:2:4 needs about ${Math.ceil(slab.cementBags)} bags of cement, ${Math.round(slab.sandCft)} cft of sand and ${Math.round(slab.crushCft)} cft of crush (about ${rupees(Math.ceil(slab.cementBags) * cement)} of cement today).` },
    { q: 'How much cement does plaster need?', a: `About ${plaster100.cementBags.toFixed(2)} bags for 100 sq ft of ½-inch plaster in 1:4, and ${plaster100.sandCft.toFixed(1)} cft of sand. Inside walls are usually 1:6, outside 1:4, ceilings 1:3 and ⅜ inch.` },
    { q: 'What is the volume of a 50 kg cement bag?', a: `${m.cementBagCft} cubic feet (about 0.035 cubic metres).` },
    { q: 'Which concrete mix should I use?', a: '1:2:4 for roof slabs, beams and lintels (the usual); 1:1.5:3 for columns and heavy beams; 1:3:6 for plain concrete under floors; 1:4:8 lean concrete under foundations.' },
    { q: 'What is the cement rate today?', a: `About ${rupees(cement)} a 50 kg bag in ${city} today — see brand-by-brand prices on the cement rate page.` },
  ];

  return (
    <ToolShell
      tool={tool}
      heading="Cement Bags Calculator"
      intro="How many bags of cement — and how much sand, crush and water — for a slab, beam, column, footing, plaster or brick mortar, priced on today's rates."
      faqs={faqs}
      guide={
        <>
          <h2 className="text-[21px] font-bold tracking-tight text-slate-900">How cement is worked out</h2>
          <p>
            <b>Concrete:</b> length × width × thickness gives the finished volume. Cement, sand and crush shrink when mixed, so the dry materials are{' '}
            <b>{m.concreteDryFactor} ×</b> that, split by the mix — 1:2:4 is one part cement, two sand, four crush (7 parts). A 50 kg bag is {m.cementBagCft} cft.
          </p>
          <p>
            <b>Plaster:</b> area × thickness, × {m.plasterDryFactor} for joints, uneven walls and what falls, split by the mix (1:4, 1:6…).
          </p>
          <p>
            <b>Brick mortar:</b> {m.dryMortarPer100Cft} cft of dry mortar per 100 cft of brickwork. We add {m.cementWastagePct}% to the cement for wastage and round up to whole bags.
          </p>
        </>
      }
    >
      <CementCalculator data={data} />
    </ToolShell>
  );
}

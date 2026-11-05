import type { Metadata } from 'next';
import CementCalculator from '@/components/tools/CementCalculator';
import ToolShell from '@/components/tools/ToolShell';
import { getConstructionData } from '@/lib/server-api';
import { concrete, coveredAreas, CONSTRUCTION_FALLBACK, plaster, PLOTS, rateOf, rupees, toolBySlug } from '@/lib/tools';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealer.pk';
const tool = toolBySlug('cement-bags-calculator');

export const revalidate = 300;

const TITLE = `Cement Bags Calculator Pakistan ${new Date().getFullYear()} — Roof, Plaster, Floor & House`;
const DESCRIPTION =
  "Free cement calculator for Pakistan: cement bags, sand and crush (bajri) for a roof (lenter), a room's plaster, a floor, columns and beams, brickwork or a whole house — on today's rates, ready to WhatsApp.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: ['cement calculator', 'cement bags calculator', 'cement calculator pakistan', 'how many cement bags for slab', 'cement sand crush calculator', '1:2:4 concrete calculator', 'plaster cement calculator', 'cement for lenter', 'cement bags for 5 marla house', 'cement for one room'],
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
  const lenter = concrete(12 * 12 * (5 / 12) * 1.12, '1:2:4', m);
  const roomPlaster = plaster(2 * (12 + 10) * 10 - 37 + 12 * 10, 0.5, 6, m);
  const five = PLOTS.find((p) => p.key === '5m')!;
  const houseSqft = coveredAreas(five.marla * 225, { floors: 2, basement: false }).reduce((s, f) => s + f.sqft, 0);
  const houseBags = Math.round((houseSqft * data.config.qty.cement) / 10) * 10;

  const faqs = [
    { q: 'How many cement bags are in 1 cubic metre of 1:2:4 concrete?', a: `About ${cubicMetre.cementBags.toFixed(1)} bags of 50 kg, with ${Math.round(cubicMetre.sandCft)} cft of sand and ${Math.round(cubicMetre.crushCft)} cft of crush — the dry materials are ${m.concreteDryFactor} times the finished volume.` },
    { q: 'How many cement bags does a 1,000 sq ft roof slab need?', a: `A 5-inch slab of 1,000 sq ft in 1:2:4 needs about ${Math.ceil(slab.cementBags)} bags of cement, ${Math.round(slab.sandCft)} cft of sand and ${Math.round(slab.crushCft)} cft of crush (about ${rupees(Math.ceil(slab.cementBags) * cement)} of cement today).` },
    { q: 'How many cement bags for the roof (lenter) of one room?', a: `A 12 ft × 12 ft room with a 5-inch slab and its beams, in 1:2:4, takes about ${Math.ceil(lenter.cementBags)} bags of cement, ${Math.round(lenter.sandCft)} cft of sand and ${Math.round(lenter.crushCft)} cft of crush.` },
    { q: 'How much cement to plaster a room?', a: `A 12 ft × 10 ft room, 10 ft high — four walls less a door and a window, plus the ceiling — in ½-inch 1:6 plaster takes about ${Math.ceil(roomPlaster.cementBags)} bags of cement and ${Math.round(roomPlaster.sandCft)} cft of sand.` },
    { q: 'How many cement bags does a 5 marla house need?', a: `A double-storey 5 marla house (about ${houseSqft.toLocaleString('en-PK')} sq ft covered) takes roughly ${houseBags.toLocaleString('en-PK')} bags, from foundations to plaster — about ${data.config.qty.cement} bags per sq ft of covered area.` },
    { q: 'How much cement does plaster need?', a: `About ${plaster100.cementBags.toFixed(2)} bags for 100 sq ft of ½-inch plaster in 1:4, and ${plaster100.sandCft.toFixed(1)} cft of sand. Inside walls are usually 1:6, outside 1:4, ceilings 1:3 and ⅜ inch.` },
    { q: 'What is the volume of a 50 kg cement bag?', a: `${m.cementBagCft} cubic feet (about 0.035 cubic metres).` },
    { q: 'Which concrete mix should I use?', a: '1:2:4 for roof slabs, beams and lintels (the usual); 1:1.5:3 for columns and heavy beams; 1:3:6 for plain concrete under floors; 1:4:8 lean concrete under foundations.' },
    { q: 'What is the cement rate today?', a: `About ${rupees(cement)} a 50 kg bag in ${city} today — see brand-by-brand prices on the cement rate page.` },
  ];

  return (
    <ToolShell
      tool={tool}
      heading="Cement Bags Calculator"
      intro="Pick the job — a roof (lenter), plaster for a room, a floor, columns and beams, brickwork or a whole house — and see the cement bags, sand and crush it takes on today's rates. Send the list to your supplier on WhatsApp."
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

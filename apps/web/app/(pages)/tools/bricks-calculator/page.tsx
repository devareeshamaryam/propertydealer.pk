import type { Metadata } from 'next';
import BricksCalculator from '@/components/tools/BricksCalculator';
import ToolShell from '@/components/tools/ToolShell';
import { getConstructionData } from '@/lib/server-api';
import { brickwork, CONSTRUCTION_FALLBACK, rateOf, rupees, toolBySlug } from '@/lib/tools';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealer.pk';
const tool = toolBySlug('bricks-calculator');

export const revalidate = 300;

const TITLE = `Bricks Calculator Pakistan ${new Date().getFullYear()} — Bricks, Cement & Sand for a Wall`;
const DESCRIPTION =
  "Free bricks calculator for Pakistan: how many bricks, cement bags and sand your wall needs — 4.5\", 9\" or 13.5\" — with doors and windows taken out, priced on today's rates.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: ['bricks calculator', 'brick calculator pakistan', 'how many bricks in 1 sq ft', 'bricks per square foot', 'bricks in 9 inch wall', 'brick wall calculator', 'bricks cement sand calculator'],
  alternates: { canonical: `${BASE_URL}/tools/${tool.slug}` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${BASE_URL}/tools/${tool.slug}`, type: 'website' },
};

export default async function Page() {
  const data = (await getConstructionData()) ?? CONSTRUCTION_FALLBACK;
  const m = data.config.masonry;
  const city = data.config.cities[0]?.name ?? 'Lahore';
  const nine = brickwork({ lengthFt: 100, heightFt: 10, thicknessIn: 9, openingsSqft: 0, mortar: 6 }, m);
  const half = brickwork({ lengthFt: 100, heightFt: 10, thicknessIn: 4.5, openingsSqft: 0, mortar: 4 }, m);
  const perSqft9 = (nine.bricksNet / nine.faceSqft).toFixed(1);
  const perSqft45 = (half.bricksNet / half.faceSqft).toFixed(1);
  const brick = rateOf(data, 'bricks', city);

  const faqs = [
    { q: 'How many bricks are in 1 sq ft of wall?', a: `About ${perSqft9} bricks in a 9-inch wall and ${perSqft45} in a 4.5-inch wall, counting the mortar joints — then add ${m.brickWastagePct}% for breakage.` },
    { q: 'How many bricks are in 100 cubic feet of brickwork?', a: `${m.bricksPer100Cft.toLocaleString('en-PK')} standard Pakistani bricks (9" × 4.5" × 3"), the figure used in the PWD analysis of rates — ${(m.bricksPer100Cft / 100).toFixed(1)} bricks per cubic foot, with ${m.dryMortarPer100Cft} cft of dry mortar.` },
    { q: 'How many bricks does a 10 ft × 10 ft room need?', a: `Four 9-inch walls 10 ft long and 10 ft high are 400 sq ft; less a door and a window (about 37 sq ft) that is about ${Math.round(363 * Number(perSqft9) * (1 + m.brickWastagePct / 100)).toLocaleString('en-PK')} bricks with wastage.` },
    { q: 'How much cement and sand does brickwork need?', a: `For 1,000 sq ft of 9-inch wall in 1:6 mortar: about ${Math.ceil(nine.cementBags)} bags of cement and ${Math.round(nine.sandCft)} cft of sand. 1:4 mortar (stronger, for 4.5" walls) takes more cement.` },
    { q: 'What is the brick rate today?', a: `About ${rupees(brick)} a brick (${rupees(brick * 1000)} per thousand) in ${city} today. First-class (awwal) bricks cost more than second-class (doum).` },
    { q: 'Which wall thickness should I use?', a: '9-inch (one brick) for outer and load-bearing walls, 4.5-inch (half brick) for partitions inside, 13.5-inch for boundary walls and heavy loads.' },
  ];

  return (
    <ToolShell
      tool={tool}
      heading="Bricks Calculator"
      intro="How many bricks your wall needs — and the cement and sand for the mortar — with doors and windows taken out, priced on today's rates."
      faqs={faqs}
      guide={
        <>
          <h2 className="text-[21px] font-bold tracking-tight text-slate-900">How bricks are counted</h2>
          <p>
            A Pakistani brick is <b>9&quot; × 4.5&quot; × 3&quot;</b>. With the mortar joints, <b>100 cubic feet of brickwork takes {m.bricksPer100Cft.toLocaleString('en-PK')} bricks</b> and{' '}
            {m.dryMortarPer100Cft} cft of dry mortar — the basis engineers and the PWD analysis of rates use.
          </p>
          <p>
            <b>Bricks</b> = wall length × height × thickness (in feet) × {(m.bricksPer100Cft / 100).toFixed(1)}, plus {m.brickWastagePct}% for breakage. A 9-inch wall takes about {perSqft9} bricks per sq ft, a 4.5-inch wall about {perSqft45}.
          </p>
          <p>
            <b>Mortar</b>: {m.dryMortarPer100Cft} cft dry per 100 cft of brickwork, split by the mix — in 1:6, one part cement and six parts sand. A 50 kg bag of cement is {m.cementBagCft} cft.
          </p>
        </>
      }
    >
      <BricksCalculator data={data} />
    </ToolShell>
  );
}

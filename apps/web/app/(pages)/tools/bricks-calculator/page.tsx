import type { Metadata } from 'next';
import BricksCalculator from '@/components/tools/BricksCalculator';
import ToolShell from '@/components/tools/ToolShell';
import { getConstructionData } from '@/lib/server-api';
import { boundaryLength, brickwork, coveredAreas, CONSTRUCTION_FALLBACK, PLOTS, rateRange, roomsWallLength, rupees, toolBySlug } from '@/lib/tools';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealer.pk';
const tool = toolBySlug('bricks-calculator');

export const revalidate = 300;

const TITLE = `Bricks Calculator Pakistan ${new Date().getFullYear()} — Room, Boundary Wall & House`;
const DESCRIPTION =
  "Free bricks calculator for Pakistan: how many bricks, cement bags and sand for a room, a boundary wall round your plot, a whole house or any wall — priced on today's rates, ready to WhatsApp to your supplier.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: ['bricks calculator', 'brick calculator pakistan', 'how many bricks in 1 sq ft', 'bricks per square foot', 'bricks in 9 inch wall', 'brick wall calculator', 'bricks cement sand calculator', 'bricks for boundary wall', 'bricks for 5 marla house', 'bricks for one room'],
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
  const brick = rateRange(data, 'bricks', city);
  const room = brickwork({ lengthFt: roomsWallLength(12, 10, 1, false), heightFt: 10, thicknessIn: 9, openingsSqft: 37, mortar: 6 }, m);
  const five = PLOTS.find((p) => p.key === '5m')!;
  const bLen = boundaryLength(five.front, five.depth, 4, 10);
  const boundary = brickwork({ lengthFt: bLen, heightFt: 7, thicknessIn: 9, openingsSqft: 0, mortar: 6 }, m).bricks + brickwork({ lengthFt: bLen, heightFt: 2, thicknessIn: 13.5, openingsSqft: 0, mortar: 6 }, m).bricks;
  const houseSqft = coveredAreas(five.marla * 225, { floors: 2, basement: false }).reduce((s, f) => s + f.sqft, 0);
  const house = Math.ceil(houseSqft * data.config.qty.bricks);
  const k = (n: number) => (Math.round(n / 100) * 100).toLocaleString('en-PK');

  const faqs = [
    { q: 'How many bricks are in 1 sq ft of wall?', a: `About ${perSqft9} bricks in a 9-inch wall and ${perSqft45} in a 4.5-inch wall, counting the mortar joints — then add ${m.brickWastagePct}% for breakage.` },
    { q: 'How many bricks are in 100 cubic feet of brickwork?', a: `${m.bricksPer100Cft.toLocaleString('en-PK')} standard Pakistani bricks (9" × 4.5" × 3"), the figure used in the PWD analysis of rates — ${(m.bricksPer100Cft / 100).toFixed(1)} bricks per cubic foot, with ${m.dryMortarPer100Cft} cft of dry mortar.` },
    { q: 'How many bricks does one room need?', a: `A 12 ft × 10 ft room with 9-inch walls 10 ft high, less a door and a window, takes about ${k(room.bricks)} bricks, ${Math.ceil(room.cementBags)} bags of cement and ${Math.round(room.sandCft)} cft of sand. Rooms built side by side share a wall, so each extra room takes fewer.` },
    { q: 'How many bricks for the boundary wall of a 5 marla plot?', a: `A 5 marla plot (${five.front}' × ${five.depth}') walled on all four sides, 7 ft high and 9 inches thick with a 10 ft gate, takes about ${k(boundary)} bricks including a 2 ft foundation. If the neighbours' walls are already up, you only build the front — far fewer.` },
    { q: 'How many bricks does a 5 marla house need?', a: `A double-storey 5 marla house (about ${houseSqft.toLocaleString('en-PK')} sq ft covered) takes roughly ${k(house)} bricks — about ${data.config.qty.bricks} per sq ft of covered area, including foundations and the boundary wall.` },
    { q: 'How much cement and sand does brickwork need?', a: `For 1,000 sq ft of 9-inch wall in 1:6 mortar: about ${Math.ceil(nine.cementBags)} bags of cement and ${Math.round(nine.sandCft)} cft of sand. 1:4 mortar (stronger, for 4.5" walls) takes more cement.` },
    { q: 'What is the brick rate today?', a: `First-class (awwal) bricks are about ${rupees(brick.high * 1000)} per thousand in ${city} today, second-class (doum) about ${rupees(brick.low * 1000)}.` },
    { q: 'Which wall thickness should I use?', a: '9-inch (one brick) for outer and load-bearing walls, 4.5-inch (half brick) for partitions inside, 13.5-inch for boundary walls and heavy loads.' },
  ];

  return (
    <ToolShell
      tool={tool}
      heading="Bricks Calculator"
      intro="Pick what you're building — a room, a boundary wall, a whole house or one wall — and see the bricks, cement and sand it takes, priced on today's rates. Send the list to your supplier on WhatsApp."
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

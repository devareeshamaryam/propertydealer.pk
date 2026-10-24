import type { Metadata } from 'next';
import AreaConverter from '@/components/tools/AreaConverter';
import ToolShell from '@/components/tools/ToolShell';
import { toolBySlug } from '@/lib/tools';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealer.pk';
const tool = toolBySlug('area-unit-converter');

const TITLE = 'Area Converter Online — Square Feet to Marla, Kanal & Acres';
const DESCRIPTION =
  'Free online area converter: convert square feet to marla, kanal, square yards and acres, or any area to square feet. Area size converter for Pakistani plots.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: ['area converter', 'online area converter', 'area converter square feet to marla', 'convert area to acres', 'convert area to square feet', 'area size converter', 'marla to square feet', 'kanal to marla'],
  alternates: { canonical: `${BASE_URL}/tools/${tool.slug}` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${BASE_URL}/tools/${tool.slug}`, type: 'website' },
};

const FAQS = [
  {
    q: 'How do I convert square feet to marla?',
    a: 'Divide the square feet by the size of one marla: by 225 on the standard society marla (1,125 sq ft ÷ 225 = 5 marla), or by 272.25 on the revenue marla. Type the square feet into the area converter above and it shows marla, kanal, square yards and acres at once.',
  },
  {
    q: 'How do I convert an area to acres?',
    a: 'Convert the area to square feet first, then divide by 43,560 — the square feet in one acre. 1 kanal (4,500 sq ft) is 0.103 acre, and 1 acre is 8 kanal on the revenue marla. The converter does both steps for you.',
  },
  {
    q: 'How many square feet are in 1 marla?',
    a: 'On the standard used by housing societies, DHA, Bahria Town, LDA and CDA schemes and every property portal, 1 marla is 225 sq ft. Some areas use 250 sq ft, and the old revenue (patwari) marla still used in land records and old city areas is 272.25 sq ft.',
  },
  {
    q: 'How many marla are in 1 kanal?',
    a: 'A kanal is always 20 marla. On the 225 sq ft marla that is 4,500 sq ft (500 sq yd); on the 272.25 sq ft marla it is 5,445 sq ft.',
  },
  {
    q: 'How many square yards are in 1 marla?',
    a: '1 marla of 225 sq ft is 25 square yards, so a 120 sq yd plot in Karachi is 4.8 marla and a 240 sq yd plot is 9.6 marla.',
  },
  {
    q: 'How many marla are in an acre?',
    a: 'An acre is 43,560 sq ft: 160 marla (8 kanal) on the 272.25 sq ft revenue marla, or 193.6 marla on the 225 sq ft marla. A killa is one acre, and a murabba is 25 acres.',
  },
  {
    q: 'What size is a 5 marla plot?',
    a: 'A 5 marla plot is 1,125 sq ft on the 225 sq ft marla — usually 25 × 45 ft. On the 272.25 sq ft marla it is 1,361 sq ft.',
  },
  {
    q: 'What is a sarsai?',
    a: 'A sarsai is one ninth of a marla — 30.25 sq ft on the revenue marla, the same as one square karam (5.5 ft × 5.5 ft).',
  },
];

export default function Page() {
  return (
    <ToolShell
      tool={tool}
      heading="Area Converter — Square Feet to Marla, Kanal & Acres"
      intro="A free online area size converter: convert square feet to marla, marla to kanal, any area to acres or to square feet — on the marla your area actually uses."
      faqs={FAQS}
      guide={
        <>
          <h2 className="text-[21px] font-bold tracking-tight text-slate-900">Why a marla is not always the same size</h2>
          <p>
            Square feet, yards and metres never change, but the marla does. Housing societies, development authorities and portals use a 225 sq ft
            marla, so a kanal is 4,500 sq ft. Land records and many old city areas still use the revenue marla of 272.25 sq ft (9 sarsai of 30.25
            sq ft), and some areas quote 250 sq ft. Kanal and sarsai follow whichever marla is used — pick it above and every result follows.
          </p>
          <p>
            When you compare plots, compare square feet: a &ldquo;5 marla&rdquo; plot in an old area can be 20% bigger than a 5 marla plot in a
            society.
          </p>
          <h2 className="pt-2 text-[19px] font-bold tracking-tight text-slate-900">Square feet to marla</h2>
          <p>
            Marla = square feet ÷ 225 (or ÷ 272.25 on the revenue marla). A 25 × 45 ft plot is 1,125 sq ft, which is 5 marla; 2,250 sq ft is 10
            marla, and 4,500 sq ft is 1 kanal.
          </p>
          <h2 className="pt-2 text-[19px] font-bold tracking-tight text-slate-900">Convert area to square feet</h2>
          <p>
            Square feet = marla × 225, kanal × 4,500, square yards × 9, square metres × 10.764, or acres × 43,560. The area converter above takes
            any of these units and gives the rest.
          </p>
          <h2 className="pt-2 text-[19px] font-bold tracking-tight text-slate-900">Convert area to acres</h2>
          <p>
            Acres = square feet ÷ 43,560. On the 272.25 sq ft revenue marla an acre is exactly 8 kanal (160 marla); on the 225 sq ft marla it is
            about 9.7 kanal.
          </p>
        </>
      }
    >
      <AreaConverter />
    </ToolShell>
  );
}

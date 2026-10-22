import type { Metadata } from 'next';
import AreaConverter from '@/components/tools/AreaConverter';
import ToolShell from '@/components/tools/ToolShell';
import { toolBySlug } from '@/lib/tools';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealer.pk';
const tool = toolBySlug('area-unit-converter');

export const metadata: Metadata = {
  title: 'Area Unit Converter — Marla, Kanal, Sq Ft, Sq Yard, Acre',
  description: tool.description,
  alternates: { canonical: `${BASE_URL}/tools/${tool.slug}` },
};

const FAQS = [
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
      heading="Area Unit Converter"
      intro="Marla, kanal, square feet, square yards, square metres, acres and the land-record units — on the marla your area actually uses."
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
        </>
      }
    >
      <AreaConverter />
    </ToolShell>
  );
}

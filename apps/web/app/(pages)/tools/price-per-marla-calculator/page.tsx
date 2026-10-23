import type { Metadata } from 'next';
import PriceCompare from '@/components/tools/PriceCompare';
import ToolShell from '@/components/tools/ToolShell';
import { toolBySlug } from '@/lib/tools';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealer.pk';
const tool = toolBySlug('price-per-marla-calculator');

export const metadata: Metadata = {
  title: 'Price per Marla Calculator — Compare Plot Rates per Marla, Sq Ft & Sq Yd',
  description: tool.description,
  alternates: { canonical: `${BASE_URL}/tools/${tool.slug}` },
};

const FAQS = [
  {
    q: 'How do I work out the price per marla?',
    a: 'Divide the price by the size in marla. A 10 marla plot for Rs 1.5 crore is Rs 15 lakh per marla. If the size is in square feet, divide it by 225 first (or by the marla used in that area) to get the marla.',
  },
  {
    q: 'Why compare plots per marla?',
    a: 'Plots of different sizes cannot be compared by their price alone. The price per marla — or per square foot — shows which one is the better rate, and how far each is from the going rate in the area.',
  },
  {
    q: 'Why is a corner plot more per marla?',
    a: 'Corner, park-facing and main-boulevard plots usually sell at 10–25% more per marla than an ordinary plot in the same block, so compare them with plots like them.',
  },
  {
    q: 'What is the price per square yard (gaz)?',
    a: 'The price divided by the size in square yards. Karachi plots are usually quoted in gaz: a 120 sq yd plot for Rs 1.2 crore is Rs 1 lakh per sq yd.',
  },
];

export default function Page() {
  return (
    <ToolShell
      tool={tool}
      heading="Price per Marla Calculator"
      intro="See any plot's real rate — per marla, square foot and square yard — and compare up to three to find the better buy."
      faqs={FAQS}
    >
      <PriceCompare />
    </ToolShell>
  );
}

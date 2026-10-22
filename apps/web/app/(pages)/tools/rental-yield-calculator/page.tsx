import type { Metadata } from 'next';
import YieldCalculator from '@/components/tools/YieldCalculator';
import ToolShell from '@/components/tools/ToolShell';
import { toolBySlug } from '@/lib/tools';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealer.pk';
const tool = toolBySlug('rental-yield-calculator');

export const metadata: Metadata = {
  title: `Rental Yield & ROI Calculator Pakistan — Is the Rent Worth the Price?`,
  description: tool.description,
  alternates: { canonical: `${BASE_URL}/tools/${tool.slug}` },
};

const FAQS = [
  { q: `What is a good rental yield in Pakistan?`, a: `Homes usually rent for about 3–6% of their price a year. Commercial property — shops and offices — often earns 6–9%. Below 3% the price is high for the rent, and the return depends on price growth.` },
  { q: `What is the difference between gross and net yield?`, a: `Gross yield is a year's rent divided by the price. Net yield takes off the months it stands empty and the yearly costs, and divides by everything you spent buying it, including transfer costs and taxes.` },
  { q: `Should I count price growth?`, a: `Price growth can be most of the return, but it is not certain and only counts when you sell. Try a lower growth rate to see how much the deal depends on it.` },
];

export default function Page() {
  return (
    <ToolShell tool={tool} heading="Rental Yield & ROI Calculator" intro="See what a property really earns: gross and net rental yield, how many years the rent takes to pay for it, and the total return with price growth — compared with a bank deposit." faqs={FAQS}>
      <YieldCalculator />
    </ToolShell>
  );
}

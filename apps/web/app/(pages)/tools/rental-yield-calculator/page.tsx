import type { Metadata } from 'next';
import YieldCalculator from '@/components/tools/YieldCalculator';
import ToolShell from '@/components/tools/ToolShell';
import { toolBySlug } from '@/lib/tools';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealer.pk';
const tool = toolBySlug('rental-yield-calculator');

const TITLE = 'Rental Yield Calculator — Annual Rental Yield & Rental Income Yield';
const DESCRIPTION =
  'Free rental yield calculator for Pakistan: work out annual rental yield, gross and net rental income yield and ROI — and see how to calculate rental yield step by step.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: ['rental yield calculator', 'how to calculate rental yield', 'annual rental yield', 'rental income yield', 'net rental yield', 'gross rental yield', 'rental yield pakistan'],
  alternates: { canonical: `${BASE_URL}/tools/${tool.slug}` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${BASE_URL}/tools/${tool.slug}`, type: 'website' },
};

const FAQS = [
  { q: `How do I calculate rental yield?`, a: `Rental yield = a year's rent ÷ the property's price × 100. A house bought for Rs 2 crore that rents for Rs 80,000 a month earns Rs 9.6 lakh a year — a 4.8% gross rental yield. For net yield, take off the empty months and the yearly costs first, and divide by everything you spent buying it.` },
  { q: `What is annual rental yield?`, a: `Annual rental yield is the rent a property earns in one year as a percentage of what it cost. It lets you compare a flat, a house and a shop on the same footing, whatever their price.` },
  { q: `What is rental income yield?`, a: `Rental income yield is the return from rent alone, without any rise in the property's price. Add expected price growth to it and you get the total return the calculator shows.` },
  { q: `What is a good rental yield in Pakistan?`, a: `Homes usually rent for about 3–6% of their price a year. Commercial property — shops and offices — often earns 6–9%. Below 3% the price is high for the rent, and the return depends on price growth.` },
  { q: `What is the difference between gross and net yield?`, a: `Gross yield is a year's rent divided by the price. Net yield takes off the months it stands empty and the yearly costs, and divides by everything you spent buying it, including transfer costs and taxes.` },
  { q: `Should I count price growth?`, a: `Price growth can be most of the return, but it is not certain and only counts when you sell. Try a lower growth rate to see how much the deal depends on it.` },
];

export default function Page() {
  return (
    <ToolShell
      tool={tool}
      heading="Rental Yield Calculator"
      intro="See what a property really earns: annual rental yield, gross and net rental income yield, how many years the rent takes to pay for it, and the total return with price growth — compared with a bank deposit."
      faqs={FAQS}
      guide={
        <>
          <h2 className="text-[21px] font-bold tracking-tight text-slate-900">How to calculate rental yield</h2>
          <p>
            <b>Gross rental yield</b> = annual rent ÷ purchase price × 100. <b>Net rental yield</b> = (annual rent − empty months − yearly costs such
            as maintenance, property tax and the agent&apos;s fee) ÷ (price + transfer costs and taxes) × 100.
          </p>
          <p>
            Example: a Rs 1.5 crore flat rents for Rs 60,000 a month. The annual rent is Rs 7.2 lakh, so the gross yield is 4.8%. With one empty month
            and Rs 60,000 of yearly costs the net rent is Rs 6 lakh; with Rs 6 lakh of buying costs the net yield is about 3.8%.
          </p>
          <h2 className="pt-2 text-[19px] font-bold tracking-tight text-slate-900">Annual rental yield or total return?</h2>
          <p>
            The annual rental yield is your rental income yield — what the rent alone pays you each year. The total return adds the rise in the
            property&apos;s price, which you only collect when you sell. Compare the yield with a bank deposit to see whether renting out beats saving.
          </p>
        </>
      }
    >
      <YieldCalculator />
    </ToolShell>
  );
}

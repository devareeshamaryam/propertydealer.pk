import type { Metadata } from 'next';
import LoanCalculator from '@/components/tools/LoanCalculator';
import ToolShell from '@/components/tools/ToolShell';
import { toolBySlug } from '@/lib/tools';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealer.pk';
const tool = toolBySlug('home-loan-calculator');

export const metadata: Metadata = {
  title: `Home Loan Calculator Pakistan — Monthly Instalment & Interest`,
  description: tool.description,
  alternates: { canonical: `${BASE_URL}/tools/${tool.slug}` },
};

const FAQS = [
  { q: `How is the monthly instalment worked out?`, a: `Home loans in Pakistan are reducing-balance loans: each month you pay interest only on what you still owe, and the rest of the instalment pays the loan down. The instalment stays the same while the rate stays the same.` },
  { q: `What rate should I use?`, a: `Most bank home loans float at KIBOR plus a margin of about 2.5–4%, reset once a year, so the instalment can go up or down. Ask your bank for today's rate and try a rate 2–3% higher to see what you could afford if rates rise.` },
  { q: `How much income do I need for a home loan?`, a: `Banks usually keep the instalment under about 40% of your take-home income, so the calculator shows the instalment divided by 0.4. Banks also look at your age, job or business history and other loans.` },
  { q: `How much down payment is needed?`, a: `Banks commonly finance 70–85% of the price, so you pay 15–30% yourself, plus transfer costs and taxes.` },
];

export default function Page() {
  return (
    <ToolShell tool={tool} heading="Home Loan Calculator" intro="Your monthly instalment, the interest you pay over the loan and the income a bank will expect — for any price, down payment, rate and term." faqs={FAQS}>
      <LoanCalculator />
    </ToolShell>
  );
}

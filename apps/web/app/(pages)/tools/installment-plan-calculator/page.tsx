import type { Metadata } from 'next';
import InstallmentPlanner from '@/components/tools/InstallmentPlanner';
import ToolShell from '@/components/tools/ToolShell';
import { toolBySlug } from '@/lib/tools';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://propertydealer.pk';
const tool = toolBySlug('installment-plan-calculator');

export const metadata: Metadata = {
  title: `Plot Installment Plan Calculator — Down Payment, Balloon & Possession`,
  description: tool.description,
  alternates: { canonical: `${BASE_URL}/tools/${tool.slug}` },
};

const FAQS = [
  { q: `What is a balloon payment?`, a: `A larger lump sum due at set points of an instalment plan, on top of the regular instalments — often every six months or once a year. More balloons mean smaller regular instalments.` },
  { q: `What is paid on possession?`, a: `Many society plans keep a share of the price — often 10–20% — until you are handed the plot or house. It is due at the end, whenever possession is given.` },
  { q: `Are instalment plans more expensive than paying in one go?`, a: `Usually yes: the instalment price is often higher than the cash price. Compare the total with the cash price, and check the developer's approval and the society's NOC before you pay.` },
];

export default function Page() {
  return (
    <ToolShell tool={tool} heading="Plot Installment Plan Calculator" intro="Lay out a society plot or house instalment plan: down payment, monthly, quarterly or half-yearly instalments, balloon payments and the amount due on possession." faqs={FAQS}>
      <InstallmentPlanner />
    </ToolShell>
  );
}

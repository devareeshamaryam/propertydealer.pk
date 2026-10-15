import { BadgeCheck, Calculator, MessageCircle, Ruler } from 'lucide-react';
import { SectionHeading } from '@/components/SectionHeading';

/*
 * Four things the site actually does, said plainly.
 *
 * The block this replaces promised "24/7 expert support", "licensed dealers"
 * giving valuation advice and "encrypted data and transparent transaction
 * processes" — none of which exist here — in four oversized cards with
 * hover-scaling icons in four different pastel colours. Generic claims a
 * visitor cannot check are exactly what makes a page read as generated, and
 * the false ones are worse than saying nothing.
 *
 * Each point below is true of the product as it stands: listings are reviewed
 * before they go live, contact is direct, units are the local ones, and the
 * material rates are published every day.
 */

const POINTS = [
  {
    icon: BadgeCheck,
    title: 'Every listing reviewed',
    text: 'Listings are checked before they go live, and buyers can report one that looks wrong.',
  },
  {
    icon: MessageCircle,
    title: 'Talk to the dealer directly',
    text: 'Call or WhatsApp straight from the listing. No sign-up, no middleman.',
  },
  {
    icon: Ruler,
    title: 'Marla, Kanal, Lakh, Crore',
    text: 'Sizes and prices the way they are spoken in Pakistan, not converted.',
  },
  {
    icon: Calculator,
    title: 'Daily construction rates',
    text: 'Cement, steel, bricks, sand and tiles — today’s prices by city.',
  },
];

const WhyChooseUs = () => {
  return (
    <section className="border-t border-slate-100 bg-slate-50 py-10 sm:py-12">
      <div className="container mx-auto px-4">
        <SectionHeading title="Why PropertyDealer" />

        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
          {POINTS.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex gap-3 bg-white p-4 sm:p-5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <div>
                <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-500">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyChooseUs;

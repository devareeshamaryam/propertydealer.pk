import Link from 'next/link';
import { ArrowRight, BookOpen, Calculator, ListPlus, Map, Package2, Search } from 'lucide-react';
import { SectionHeading } from '@/components/SectionHeading';

/*
 * The site's real tools, as links.
 *
 * This section was six cards that went nowhere — none of them was a link —
 * describing features in the abstract ("Agent Connect", "Trusted Platform")
 * and one that does not exist at all ("Schedule visits and inspections"). It
 * also carried every decorative effect at once: blurred colour blobs behind
 * it, a shimmer sweep, a glowing border, cards that lifted 8px, icons that
 * rotated and a pulsing dot.
 *
 * Zameen's equivalent is "Explore more on Zameen": a grid of the tools it
 * actually has, each one a link. These are ours.
 */

const TOOLS = [
  {
    icon: Search,
    title: 'Search properties',
    text: 'Houses, plots, flats and shops by city, area, size and price.',
    href: '/properties',
  },
  {
    icon: Map,
    title: 'Search on the map',
    text: 'See listings where they actually are, society by society.',
    href: '/emap',
  },
  {
    icon: Calculator,
    title: 'Construction rates',
    text: 'Today’s cement, steel, bricks, sand and tile prices.',
    href: '/today-cement-rate-in-pakistan',
  },
  {
    icon: ListPlus,
    title: 'List your property',
    text: 'Post a house or plot for sale or rent. The first one is free.',
    href: '/register?next=/dashboard/property/add-property',
  },
  {
    icon: Package2,
    title: 'Agent packages',
    text: 'More listings and featured placement for dealers.',
    href: '/packages',
  },
  {
    icon: BookOpen,
    title: 'Property guides',
    text: 'Buying, renting and building in Pakistan, explained.',
    href: '/blog',
  },
];

const ExploreTools = () => {
  return (
    <section className="border-t border-slate-100 bg-white py-10 sm:py-12">
      <div className="container mx-auto px-4">
        <SectionHeading title="Explore more" />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map(({ icon: Icon, title, text, href }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-start gap-3 rounded-lg border border-slate-200 p-4 transition-colors hover:border-primary/40 hover:bg-slate-50"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 text-[15px] font-semibold text-slate-900 group-hover:text-primary">
                  {title}
                  <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                </span>
                <span className="mt-0.5 block text-[13px] leading-relaxed text-slate-500">{text}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ExploreTools;

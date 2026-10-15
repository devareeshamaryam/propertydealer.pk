import Link from 'next/link';
import { ArrowRight, Mail, Phone } from 'lucide-react';

/*
 * About, as a plain page of text.
 *
 * The old one was a client component that rendered nothing until it had
 * mounted, so the HTML search engines received for /about was empty. What it
 * showed once it did was a developer's brochure — "Ownership Verification",
 * "Legal Approvals", "Timely Delivery" of projects — none of which is what
 * this site does, under glowing orbs, rotating icons and pulsing dots, with
 * "5000+ properties" and "2000+ happy customers" counters nobody could check.
 *
 * This says what the site is and how it works, and it is in the HTML.
 */

const LINKS = [
  { href: '/properties/sale', label: 'Property for sale' },
  { href: '/properties/rent', label: 'Property for rent' },
  { href: '/emap', label: 'Search on the map' },
  { href: '/today-cement-rate-in-pakistan', label: 'Today’s construction rates' },
  { href: '/packages', label: 'Packages for agents' },
  { href: '/blog', label: 'Property guides' },
];

export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-8 sm:py-10">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-12">
        <article className="max-w-2xl">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            About PropertyDealer
          </h1>
          <p className="mt-3 text-[17px] leading-relaxed text-slate-600">
            PropertyDealer is a Pakistani property portal. Owners and dealers list houses, flats,
            plots and shops for sale or rent, and buyers and tenants contact them directly — by
            phone or WhatsApp, without signing up.
          </p>

          <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-slate-700">
            <section>
              <h2 className="text-lg font-bold text-slate-900">What you will find here</h2>
              <p className="mt-2">
                Listings across Lahore, Islamabad, Rawalpindi, Karachi, Multan, Faisalabad,
                Gujranwala, Sahiwal and other cities, searchable by city, area, property type, size
                and price. Sizes are in marla and kanal and prices in lakh and crore, the way
                property is bought and sold here.
              </p>
              <p className="mt-3">
                Alongside the listings we publish the day’s construction material rates — cement,
                steel, bricks, sand, bajri, tiles, wood and doors — for anyone building or
                renovating.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900">How listings work</h2>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 marker:text-slate-400">
                <li>Every listing is reviewed before it goes live.</li>
                <li>
                  Each listing shows who posted it, with a link to their profile and their other
                  properties.
                </li>
                <li>
                  When a property is sold or rented out it is marked as such and its contact
                  details are hidden.
                </li>
                <li>
                  Anything that looks wrong can be reported from the listing page, and we look at
                  every report.
                </li>
              </ul>
              <p className="mt-3 text-slate-600">
                We are a listings platform, not a party to any deal. Always see the property and
                its papers before paying anything.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900">For owners and agents</h2>
              <p className="mt-2">
                Anyone can create an account and post a property; the first listing is free.
                Dealers who list more can choose a{' '}
                <Link href="/packages" className="font-medium text-primary hover:underline">
                  monthly package
                </Link>{' '}
                for more listings and featured placement.
              </p>
            </section>
          </div>
        </article>

        <aside className="space-y-4 lg:pt-1">
          <div className="rounded-lg border border-slate-200 p-4">
            <h2 className="text-[15px] font-semibold text-slate-900">Contact us</h2>
            <ul className="mt-3 space-y-2 text-[14px]">
              <li>
                <a href="tel:+923030119992" className="inline-flex items-center gap-2 text-slate-700 hover:text-primary">
                  <Phone className="h-4 w-4 text-slate-400" />
                  +92 303 011 9992
                </a>
              </li>
              <li>
                <a
                  href="mailto:propertydealer.pk01@gmail.com"
                  className="inline-flex items-center gap-2 break-all text-slate-700 hover:text-primary"
                >
                  <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                  propertydealer.pk01@gmail.com
                </a>
              </li>
            </ul>
          </div>

          <nav aria-label="Explore" className="rounded-lg border border-slate-200">
            <h2 className="border-b border-slate-200 px-4 py-3 text-[15px] font-semibold text-slate-900">
              Explore
            </h2>
            <ul className="divide-y divide-slate-100">
              {LINKS.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="flex items-center justify-between px-4 py-2.5 text-[14px] text-slate-700 hover:bg-slate-50 hover:text-primary"
                  >
                    {label}
                    <ArrowRight className="h-3.5 w-3.5 text-slate-300" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
      </div>
    </div>
  );
}

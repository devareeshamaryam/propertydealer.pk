import Link from 'next/link';
import StaticPageView from '@/components/StaticPageView';
import { getSiteName } from '@/lib/site-settings.server';

/*
 * About. The text is edited in Dashboard → Static Pages (slug "about"); the
 * copy below is shown only until that page exists, so /about is never empty.
 */

export default async function AboutPage() {
  const site = await getSiteName();
  return (
    <StaticPageView
      slug="about"
      title={`About ${site}`}
      fallback={
        <>
          <p className="mt-3 text-[17px] leading-relaxed text-slate-600">
            {site} is a Pakistani property portal. Owners and dealers list houses, flats,
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
        </>
      }
    />
  );
}

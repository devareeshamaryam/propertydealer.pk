import Link from 'next/link';
import { Facebook, Linkedin, Mail, Phone, Youtube } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { getSiteSettings } from '@/lib/site-settings.server';

/*
 * A footer that is a directory, like every listing portal's.
 *
 * The old one was a near-black block with a gradient stripe across the top,
 * social icons that grew on hover, a pulsing green "Trusted since 2007" dot
 * and arrows that slid in beside each link. On phones it hid every link and
 * showed only the name and the social buttons.
 *
 * Zameen's footer is the useful kind: four or five plain columns of links to
 * the pages people actually look for — cities, rent and sale, the tools — on
 * the brand's dark colour, with a thin copyright bar under it. It is also the
 * one place every page links to the city and rate pages, which is worth
 * having on phones as much as desktops, so the columns stay on mobile too.
 *
 * Only pages that exist are linked. /terms, /privacy and /contact all 404 on
 * the live site; linking them here would put a broken link on every page and
 * have Next prefetch three 404s per visit.
 */

const EXPLORE = [
  { name: 'Properties for Sale', href: '/properties/sale' },
  { name: 'Properties for Rent', href: '/properties/rent' },
  { name: 'Search on Map', href: '/emap' },
  { name: 'Agent Packages', href: '/packages' },
  { name: 'Blog', href: '/blog' },
  { name: 'About Us', href: '/about' },
];

const CITIES = [
  { name: 'Lahore', href: '/properties/all/lahore' },
  { name: 'Islamabad', href: '/properties/all/islamabad' },
  { name: 'Karachi', href: '/properties/all/karachi' },
  { name: 'Rawalpindi', href: '/properties/all/rawalpindi' },
  { name: 'Multan', href: '/properties/all/multan' },
  { name: 'Faisalabad', href: '/properties/all/faisalabad' },
  { name: 'Gujranwala', href: '/properties/all/gujranwala' },
  { name: 'Sahiwal', href: '/properties/all/sahiwal' },
];

const RATES = [
  { name: 'Cement Rates', href: '/today-cement-rate-in-pakistan' },
  { name: 'Steel (Sarya) Rates', href: '/today-steel-rate-in-pakistan' },
  { name: 'Bricks Rates', href: '/today-bricks-rate-in-pakistan' },
  { name: 'Sand Rates', href: '/today-sand-rate-in-pakistan' },
  { name: 'Bajri Rates', href: '/today-bajri-rate-in-pakistan' },
  { name: 'Tile Rates', href: '/today-tile-rate-in-pakistan' },
  { name: 'Wood Rates', href: '/today-wood-rate-in-pakistan' },
  { name: 'Door Rates', href: '/today-door-rate-in-pakistan' },
];

const SOCIALS = [
  { icon: Facebook, href: 'https://www.facebook.com/pkpropertydealer', label: 'Facebook' },
  { icon: Youtube, href: 'https://www.youtube.com/@Propertydealer-y9r', label: 'YouTube' },
  { icon: Linkedin, href: 'https://www.linkedin.com/company/propertydealer-pk/about/', label: 'LinkedIn' },
];

function Column({
  title,
  links,
}: {
  title: string;
  links: { name: string; href: string }[];
}) {
  return (
    <div>
      <h3 className="mb-3 text-[13px] font-semibold text-white">{title}</h3>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-[13px] text-slate-300 transition-colors hover:text-white"
            >
              {link.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

const Footer = async () => {
  // Settings → Appearance: the footer logo, else the header logo, else the mark.
  const { footerLogoUrl, logoUrl, logoHeight } = await getSiteSettings();
  const footerLogo = footerLogoUrl || logoUrl;

  return (
    <footer className="bg-navy text-white">
      <div className="container mx-auto px-4 py-10 md:py-12">
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="col-span-2 md:col-span-4 lg:col-span-1">
            <Link href="/" aria-label="PropertyDealer home" className="inline-block">
              {footerLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={footerLogo} alt="PropertyDealer" style={{ height: logoHeight }} className="w-auto max-w-[220px] object-contain" />
              ) : (
                <BrandLogo
                  markClassName="text-white"
                  textClassName="text-white [&>span]:text-white/70"
                />
              )}
            </Link>

            <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-slate-300">
              Buy, sell and rent houses, plots, flats and commercial property
              across Pakistan — with today&apos;s construction material rates
              alongside.
            </p>

            <ul className="mt-4 space-y-1.5 text-[13px]">
              <li>
                <a
                  href="tel:+923030119992"
                  className="inline-flex items-center gap-2 text-slate-300 hover:text-white"
                >
                  <Phone className="h-3.5 w-3.5" />
                  +92 303 011 9992
                </a>
              </li>
              <li>
                <a
                  href="mailto:propertydealer.pk01@gmail.com"
                  className="inline-flex items-center gap-2 break-all text-slate-300 hover:text-white"
                >
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  propertydealer.pk01@gmail.com
                </a>
              </li>
            </ul>

            <div className="mt-4 flex gap-2">
              {SOCIALS.map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="grid h-8 w-8 place-items-center rounded-md border border-white/15 text-slate-300 transition-colors hover:border-white/40 hover:text-white"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <Column title="Explore" links={EXPLORE} />
          <Column title="Popular Cities" links={CITIES} />
          <div className="col-span-2 md:col-span-1">
            <Column title="Construction Rates" links={RATES} />
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container mx-auto flex flex-col gap-1 px-4 py-4 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} PropertyDealer. All rights reserved.</p>
          <p>Serving buyers, renters and dealers across Pakistan since 2007.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

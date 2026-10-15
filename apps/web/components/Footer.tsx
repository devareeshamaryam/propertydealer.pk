import Link from 'next/link';
import { Clock, Facebook, Instagram, Linkedin, Mail, MapPin, MessageCircle, Phone, Youtube } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { getSiteSettings } from '@/lib/site-settings.server';
import { resolved, waDigits } from '@/lib/site-settings';

/*
 * A footer that is a directory, like every listing portal's — on a dark
 * panel with rounded top corners, the way current product sites finish a
 * page, instead of a flat slab butting into the content.
 *
 * Every detail in it — logo, about text, phone, WhatsApp, email, address,
 * office hours, social links, copyright line — comes from Settings → General
 * and Settings → Appearance, with the old hard-coded values as defaults.
 *
 * Only pages that exist are linked. /terms, /privacy and /contact all 404 on
 * the live site; linking them here would put a broken link on every page.
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

/** Used until the admin enters their own in Settings → General. */
const DEFAULT_SOCIALS: [string, string][] = [
  ['Facebook', 'https://www.facebook.com/pkpropertydealer'],
  ['YouTube', 'https://www.youtube.com/@Propertydealer-y9r'],
  ['LinkedIn', 'https://www.linkedin.com/company/propertydealer-pk/about/'],
];

function SocialIcon({ name }: { name: string }) {
  const cls = 'h-4 w-4';
  switch (name) {
    case 'Facebook':
      return <Facebook className={cls} />;
    case 'Instagram':
      return <Instagram className={cls} />;
    case 'YouTube':
      return <Youtube className={cls} />;
    case 'LinkedIn':
      return <Linkedin className={cls} />;
    case 'TikTok':
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="currentColor" aria-hidden>
          <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.59 2.59 0 0 1 0-5.18c.27 0 .53.04.77.12V9.66a5.73 5.73 0 0 0-.77-.05 5.68 5.68 0 1 0 5.68 5.68V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.3 4.3 0 0 1-3.24-1.48z" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="currentColor" aria-hidden>
          <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.67l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64z" />
        </svg>
      );
  }
}

function Column({ title, links }: { title: string; links: { name: string; href: string }[] }) {
  return (
    <div>
      <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-white/90">{title}</h3>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-[13.5px] text-white/65 transition-colors hover:text-white">
              {link.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

const Footer = async () => {
  const settings = await getSiteSettings();
  const r = resolved(settings);
  const footerLogo = settings.footerLogoUrl || settings.logoUrl;
  const socials = r.socials.length ? r.socials : DEFAULT_SOCIALS;
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-10 overflow-hidden rounded-t-[28px] bg-navy text-white md:mt-14 md:rounded-t-[44px]">
      {/* A soft highlight along the top edge, so the curve reads on any colour. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

      <div className="container container-flush mx-auto px-5 pb-8 pt-10 md:px-6 md:pt-14">
        <div className="grid grid-cols-2 gap-x-6 gap-y-9 md:grid-cols-4 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="col-span-2 md:col-span-4 lg:col-span-1">
            <Link href="/" aria-label={`${r.siteName} home`} className="inline-block">
              {footerLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={footerLogo}
                  alt={r.siteName}
                  className="h-[var(--logo-h)] w-auto max-w-[220px] object-contain md:h-[var(--logo-h-lg)]"
                />
              ) : (
                <BrandLogo markClassName="text-white" textClassName="text-white [&>span]:text-white/70" />
              )}
            </Link>

            <p className="mt-3 max-w-sm text-[13.5px] leading-relaxed text-white/65">{r.footerAbout}</p>

            <ul className="mt-5 space-y-2 text-[13.5px]">
              <li>
                <a href={r.phoneHref} className="inline-flex items-center gap-2.5 text-white/75 hover:text-white">
                  <Phone className="h-4 w-4 text-white/50" />
                  {r.phone}
                </a>
              </li>
              <li>
                <a
                  href={`https://wa.me/${waDigits(r.whatsapp)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2.5 text-white/75 hover:text-white"
                >
                  <MessageCircle className="h-4 w-4 text-white/50" />
                  WhatsApp us
                </a>
              </li>
              <li>
                <a href={`mailto:${r.email}`} className="inline-flex items-center gap-2.5 break-all text-white/75 hover:text-white">
                  <Mail className="h-4 w-4 shrink-0 text-white/50" />
                  {r.email}
                </a>
              </li>
              {settings.address && (
                <li className="flex items-start gap-2.5 text-white/75">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-white/50" />
                  {settings.address}
                </li>
              )}
              {settings.officeHours && (
                <li className="flex items-center gap-2.5 text-white/75">
                  <Clock className="h-4 w-4 shrink-0 text-white/50" />
                  {settings.officeHours}
                </li>
              )}
            </ul>

            <div className="mt-5 flex flex-wrap gap-2">
              {socials.map(([name, href]) => (
                <a
                  key={name}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={name}
                  className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white hover:text-navy"
                >
                  <SocialIcon name={name} />
                </a>
              ))}
            </div>
          </div>

          <Column title="Explore" links={EXPLORE} />
          <Column title="Popular cities" links={CITIES} />
          <div className="col-span-2 md:col-span-1">
            <Column title="Construction rates" links={RATES} />
          </div>
        </div>
      </div>

      <div className="mx-5 border-t border-white/10 md:mx-6">
        <div className="container container-flush mx-auto flex flex-col gap-1 py-5 text-[12.5px] text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>{settings.copyrightText ? settings.copyrightText.replace('{year}', String(year)) : `© ${year} ${r.siteName}. All rights reserved.`}</p>
          <p>{settings.tagline || 'Serving buyers, renters and dealers across Pakistan since 2007.'}</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

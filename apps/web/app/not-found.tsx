import Link from 'next/link';
import { Building2, Calculator, Home, Search } from 'lucide-react';

/*
 * The 404 page. It was two lines of unstyled text; a visitor who followed an
 * old link now gets the way back into the site — home, the listings, the
 * rates — instead of a dead end.
 */

const LINKS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/properties/sale', label: 'Property for sale', icon: Building2 },
  { href: '/properties/rent', label: 'Property for rent', icon: Search },
  { href: '/today-cement-rate-in-pakistan', label: 'Construction rates', icon: Calculator },
];

export default function NotFound() {
  return (
    <div className="container mx-auto px-4 py-16 sm:py-24">
      <div className="mx-auto max-w-lg text-center">
        <p className="text-[64px] font-black leading-none tracking-tight text-primary/20 sm:text-[96px]">404</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">This page could not be found</h1>
        <p className="mt-2 text-slate-600">
          The link may be old, or the listing may have been removed. Try one of these instead:
        </p>
        <div className="mt-6 grid grid-cols-2 gap-2.5">
          {LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left text-[14px] font-medium text-slate-800 transition-colors hover:border-primary hover:text-primary"
            >
              <Icon className="h-4 w-4 shrink-0 text-primary" />
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

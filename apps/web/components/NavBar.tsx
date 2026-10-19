'use client'
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, ChevronDown, LayoutDashboard, LogOut, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { DialogTitle } from '@/components/ui/dialog';
import SearchBar from '@/components/SearchBar';
import { BrandLogo } from '@/components/BrandLogo';
import { useSiteSettings } from '@/components/SiteSettingsProvider';
import { useAuth } from '@/context/auth-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { resolved } from '@/lib/site-settings';
import { CartButton } from '@/components/shop/CartSheet';
import { isPropertyDetail } from '@/lib/routes';

/*
 * The header, kept to what a visitor actually uses.
 *
 * Logo, three words (Buy, Rent, Rates), and on the right a quiet "Sign in"
 * next to the one button the business wants pressed. Blog and About live in
 * the footer; search lives on the homepage and the results bar, where it has
 * room — a cramped third search box in the header was one more thing to read.
 *
 * On a phone it is just the logo and the menu (the tab bar at the bottom does
 * the rest), and on a listing page it steps aside entirely so the photos run
 * to the top of the screen; the gallery carries its own back button.
 *
 * It is `sticky`, not `fixed`, so pages start where the header ends without
 * each guessing its height.
 */

const NAV_LINKS = [
  { name: 'Buy', path: '/properties/sale' },
  { name: 'Rent', path: '/properties/rent' },
];

/** The construction-rate pages — the site's other half, and well ranked. */
const RATE_LINKS = [
  { name: 'Cement', path: '/today-cement-rate-in-pakistan' },
  { name: 'Steel (Sarya)', path: '/today-steel-rate-in-pakistan' },
  { name: 'Bricks', path: '/today-bricks-rate-in-pakistan' },
  { name: 'Sand', path: '/today-sand-rate-in-pakistan' },
  { name: 'Bajri (Crush)', path: '/today-bajri-rate-in-pakistan' },
  { name: 'Tiles', path: '/today-tile-rate-in-pakistan' },
  { name: 'Wood', path: '/today-wood-rate-in-pakistan' },
  { name: 'Doors', path: '/today-door-rate-in-pakistan' },
];

const MORE_LINKS = [
  { name: 'Search on map', path: '/emap' },
  { name: 'Agent packages', path: '/packages' },
  { name: 'Blog', path: '/blog' },
  { name: 'About', path: '/about' },
];

const ADD_PROPERTY = '/dashboard/property/add-property';

function isActive(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(`${path}/`);
}

/**
 * The admin's logo if one is set (Settings → Appearance), else the built-in
 * mark. Its height follows the two logo-size settings — one for phones, one
 * for desktop — through the --logo-h / --logo-h-lg variables on <html>.
 */
export function SiteLogo() {
  const settings = useSiteSettings();
  const { siteName } = resolved(settings);
  if (settings.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={settings.logoUrl}
        alt={siteName}
        className="h-[var(--logo-h)] w-auto max-w-[220px] object-contain md:h-[var(--logo-h-lg)]"
      />
    );
  }
  return (
    <BrandLogo
      name={siteName}
      markClassName="h-[var(--logo-h)] w-[var(--logo-h)] md:h-[var(--logo-h-lg)] md:w-[var(--logo-h-lg)]"
      textClassName="text-[calc(var(--logo-h)*0.64)] md:text-[calc(var(--logo-h-lg)*0.6)]"
    />
  );
}

const linkClass = (active: boolean) =>
  cn(
    'px-2.5 py-1.5 text-[14px] transition-colors',
    active ? 'font-medium text-slate-900' : 'text-slate-600 hover:text-slate-900',
  );

const Navbar = () => {
  const pathname = usePathname() || '';
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();

  // Auth state only exists in the browser; rendering the signed-in controls
  // on the server would flash the wrong ones before hydration.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const addPropertyHref = isAuthenticated ? ADD_PROPERTY : `/register?next=${ADD_PROPERTY}`;
  const ratesActive = pathname.startsWith('/today-');
  const initial = (user?.name?.[0] || user?.email?.[0] || 'U').toUpperCase();
  const immersive = isPropertyDetail(pathname);
  const settings = useSiteSettings();
  const showAnnouncement = settings.announcementEnabled && settings.announcementText;

  return (
    <>
      {/* Settings → General → Announcement bar. Scrolls away with the page. */}
      {showAnnouncement && (
        <div className={cn('bg-navy text-white', immersive && 'max-md:hidden')}>
          <div className="container mx-auto flex min-h-9 items-center justify-center gap-2 px-4 py-1.5 text-center text-[13px]">
            {settings.announcementLink ? (
              <Link href={settings.announcementLink} className="inline-flex items-center gap-1.5 hover:underline">
                {settings.announcementText}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <span>{settings.announcementText}</span>
            )}
          </div>
        </div>
      )}

    {/*
      Solid white, full width, 64px tall — the sticky bars below it line up
      on that height (top-16).
    */}
    <header
      className={cn(
        'sticky top-0 z-50 border-b border-slate-200 bg-white',
        immersive && 'max-md:hidden',
      )}
    >
      <div className="container container-flush mx-auto flex h-16 items-center gap-4 px-3 sm:px-4">
        <Link href="/" aria-label="Home" className="shrink-0">
          <SiteLogo />
        </Link>

        {/* Desktop links */}
        <nav className="ml-4 hidden items-center md:flex" aria-label="Main">
          {NAV_LINKS.map((link) => (
            <Link key={link.path} href={link.path} className={linkClass(isActive(pathname, link.path))}>
              {link.name}
            </Link>
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger className={cn(linkClass(ratesActive), 'inline-flex items-center gap-1 outline-none')}>
              Rates
              <ChevronDown className="h-3.5 w-3.5 opacity-50" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              {RATE_LINKS.map((rate) => (
                <DropdownMenuItem key={rate.path} asChild>
                  <Link href={rate.path} className="cursor-pointer">
                    {rate.name}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        {/* Desktop actions */}
        <div className="ml-auto hidden items-center gap-1 md:flex">
          <CartButton />
          {mounted &&
            (isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="mr-1 grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-[13px] font-semibold text-slate-700 outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Account menu"
                >
                  {initial}
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end">
                  <DropdownMenuLabel className="font-normal">
                    <p className="truncate text-sm font-semibold">{user?.name || 'Your account'}</p>
                    <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard" className="cursor-pointer">
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link href="/login" className="px-3 py-1.5 text-[14px] text-slate-600 hover:text-slate-900">
                Sign in
              </Link>
            ))}
          <Button asChild size="sm" className="btn-shape h-9 gap-1 rounded-lg px-3.5 text-[13px] font-semibold">
            <Link href={addPropertyHref}>
              <Plus className="h-3.5 w-3.5" />
              Add Property
            </Link>
          </Button>
        </div>

        {/* Mobile: the cart (once something is in it) and the menu. */}
        <div className="ml-auto flex items-center gap-0.5 md:hidden">
        <CartButton />
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild className="md:hidden">
            <button
              type="button"
              aria-label="Open menu"
              className="-mr-1.5 grid h-10 w-10 place-items-center rounded-xl text-slate-950 transition-colors hover:bg-slate-100"
            >
              {/* Two lines, the lower one shorter — the modern app menu mark. */}
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
                <path d="M4 8.5h16" />
                <path d="M10 15.5h10" />
              </svg>
            </button>
          </SheetTrigger>

          <SheetContent side="right" className="flex w-80 flex-col gap-0 p-0">
            <DialogTitle className="sr-only">Menu</DialogTitle>

            <div className="border-b border-slate-200 px-4 py-3.5">
              <SiteLogo />
            </div>

            <div className="border-b border-slate-200 p-4">
              <SearchBar />
            </div>

            <nav className="flex-1 overflow-y-auto py-2" aria-label="Mobile">
              {[...NAV_LINKS, ...MORE_LINKS].map((link) => (
                <Link
                  key={link.path}
                  href={link.path}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'block px-4 py-2.5 text-[15px]',
                    isActive(pathname, link.path) ? 'font-medium text-primary' : 'text-slate-800 hover:bg-slate-50',
                  )}
                >
                  {link.name}
                </Link>
              ))}

              <p className="mt-3 px-4 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Construction rates
              </p>
              {RATE_LINKS.map((rate) => (
                <Link
                  key={rate.path}
                  href={rate.path}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'block px-4 py-2 text-[14px]',
                    pathname === rate.path ? 'text-primary' : 'text-slate-600 hover:bg-slate-50',
                  )}
                >
                  {rate.name}
                </Link>
              ))}
            </nav>

            <div className="space-y-2 border-t border-slate-200 p-4">
              <Button asChild className="w-full gap-1.5 font-semibold">
                <Link href={addPropertyHref} onClick={() => setMobileOpen(false)}>
                  <Plus className="h-4 w-4" />
                  Add Property
                </Link>
              </Button>

              {mounted &&
                (isAuthenticated ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Button asChild variant="outline">
                      <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
                        Dashboard
                      </Link>
                    </Button>
                    <Button variant="outline" onClick={logout}>
                      Sign out
                    </Button>
                  </div>
                ) : (
                  <Button asChild variant="outline" className="w-full">
                    <Link href="/login" onClick={() => setMobileOpen(false)}>
                      Sign in
                    </Link>
                  </Button>
                ))}
            </div>
          </SheetContent>
        </Sheet>
        </div>
      </div>
    </header>
    </>
  );
};

export default Navbar;

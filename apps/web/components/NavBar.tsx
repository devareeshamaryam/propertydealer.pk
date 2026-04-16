 'use client'
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, Plus, User, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { DialogTitle } from '@/components/ui/dialog';
import SearchBar from '@/components/SearchBar';
import { useAuth } from '@/context/auth-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const navLinks = [
  { name: 'Home', path: '/' },
  { name: 'Properties', path: '/properties' },
  { name: 'About', path: '/about' },
  { name: 'Blog', path: '/blog' },
];

// ─── Animated Logo ────────────────────────────────────────────────────────────
const AnimatedLogo = () => {
  const text = 'Property Dealer';

  return (
    <div className="flex items-center gap-2 select-none">
      <style>{`
        @keyframes roofShimmer {
          0%   { stroke-dashoffset: 300; opacity: 0.5; }
          50%  { stroke-dashoffset: 0;   opacity: 1;   }
          100% { stroke-dashoffset: -300; opacity: 0.5; }
        }
        @keyframes pinPulse {
          0%, 100% { transform: scale(1);    }
          45%, 55% { transform: scale(1.13); }
        }
        @keyframes dotBreath {
          0%, 100% { transform: scale(1);   opacity: 1;   }
          50%       { transform: scale(0.6); opacity: 0.4; }
        }
        @keyframes charWave {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-4px); }
        }
        .logo-roof {
          stroke-dasharray: 300;
          animation: roofShimmer 3s ease-in-out infinite;
        }
        .logo-pin {
          transform-box: fill-box;
          transform-origin: center;
          animation: pinPulse 2.5s ease-in-out infinite;
        }
        .logo-dot {
          transform-box: fill-box;
          transform-origin: center;
          animation: dotBreath 2.5s ease-in-out infinite;
        }
        .logo-char {
          display: inline-block;
          animation: charWave 2.4s ease-in-out infinite;
        }
      `}</style>

      <svg
        width="58"
        height="56"
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        overflow="visible"
        aria-hidden="true"
        className="shrink-0 text-foreground"
      >
        {/* Outer roof — sharp miter corners, animated shimmer */}
        <polyline
          className="logo-roof"
          points="4,50 50,8 96,50"
          stroke="currentColor" strokeWidth="5"
          strokeLinejoin="miter" strokeLinecap="square" fill="none"
        />
        {/* Inner roof — static */}
        <polyline
          points="14,50 50,18 86,50"
          stroke="currentColor" strokeWidth="3"
          strokeLinejoin="miter" strokeLinecap="square" fill="none"
        />
        {/* Left wall — perfectly straight */}
        <line x1="14" y1="50" x2="14" y2="92"
          stroke="currentColor" strokeWidth="3" strokeLinecap="square" />
        {/* Right wall */}
        <line x1="86" y1="50" x2="86" y2="92"
          stroke="currentColor" strokeWidth="3" strokeLinecap="square" />
        {/* Bottom */}
        <line x1="14" y1="92" x2="86" y2="92"
          stroke="currentColor" strokeWidth="3" strokeLinecap="square" />

        {/* Location pin — pulsing */}
        <g className="logo-pin">
          <path
            d="M36,59 A14,14 0 1,1 64,59 Q64,73 50,82 Q36,73 36,59 Z"
            stroke="currentColor" strokeWidth="3"
            fill="none" strokeLinejoin="round"
          />
        </g>
        {/* Inner dot — breathing */}
        <g className="logo-dot">
          <circle cx="50" cy="57" r="6.5"
            stroke="currentColor" strokeWidth="2.8" fill="none" />
        </g>
      </svg>

      <span
        className="text-xl font-bold tracking-tight text-foreground whitespace-nowrap"
        aria-label="Property Dealer"
      >
        {text.split('').map((char, i) => (
          <span
            key={i}
            className="logo-char"
            style={{ animationDelay: `${i * 0.07}s` }}
          >
            {char === ' ' ? '\u00A0' : char}
          </span>
        ))}
      </span>
    </div>
  );
};
// ─────────────────────────────────────────────────────────────────────────────

const Navbar = () => {
  const pathname = usePathname() || '';
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-lg shadow-black/5">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16 md:h-20">

            {/* Logo — left on desktop, centered on mobile */}
            <Link href="/" className="flex items-center group md:static absolute left-1/2 md:left-auto md:transform-none -translate-x-1/2 md:translate-x-0">
              <AnimatedLogo />
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-4 flex-1 justify-center max-w-3xl">
              <div className="flex-1 max-w-md">
                <SearchBar />
              </div>

              <div className="flex items-center gap-1 bg-secondary/50 rounded-full px-2 py-2 backdrop-blur-sm shrink-0">
                {navLinks.map((link) => (
                  <Link
                    key={link.path}
                    href={link.path}
                    className="relative group px-5 py-2 rounded-full transition-all duration-300"
                  >
                    <div className={`absolute inset-0 rounded-full transition-all duration-300 ${
                      pathname === link.path
                        ? 'bg-primary shadow-lg shadow-primary/25'
                        : 'bg-transparent group-hover:bg-primary/10'
                    }`}>
                      <div className="absolute inset-0 rounded-full overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                      </div>
                    </div>
                    <span className={`relative z-10 text-sm font-medium transition-all duration-300 ${
                      pathname === link.path
                        ? 'text-primary-foreground'
                        : 'text-foreground group-hover:text-primary'
                    }`}>
                      {link.name}
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Desktop Auth */}
            <div className="hidden md:flex items-center gap-2">
              {mounted && (
                <>
                  {!isAuthenticated ? (
                    <Link href="/login">
                      <Button
                        size="icon"
                        className="ml-2 relative overflow-hidden bg-gradient-to-br from-primary to-primary/90 transition-all duration-300 hover:scale-110 hover:shadow-xl hover:shadow-primary/40 group"
                      >
                        <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12" />
                        <User className="w-5 h-5 relative z-10 transition-transform duration-300 group-hover:scale-110" />
                      </Button>
                    </Link>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="relative h-8 w-8 rounded-full ml-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src="" alt={user?.name || 'User'} />
                            <AvatarFallback>{user?.name?.[0] || user?.email?.[0] || 'U'}</AvatarFallback>
                          </Avatar>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-56" align="end" forceMount>
                        <DropdownMenuLabel className="font-normal">
                          <div className="flex flex-col space-y-1">
                            <p className="text-sm font-medium leading-none">{user?.name || user?.email}</p>
                            <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                          </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link href="/dashboard" className="cursor-pointer">
                            <User className="mr-2 h-4 w-4" />
                            <span>Dashboard</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={logout} className="cursor-pointer">
                          <LogOut className="mr-2 h-4 w-4" />
                          <span>Log out</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </>
              )}
            </div>

            {/* Mobile Menu */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative overflow-hidden transition-all duration-300 hover:scale-110 group"
                >
                  <div className="absolute inset-0 rounded-lg bg-primary/0 group-hover:bg-primary/10 transition-all duration-300" />
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
                  <Menu className="w-6 h-6 relative z-10 transition-all duration-500 group-hover:rotate-180" />
                </Button>
              </SheetTrigger>

              <SheetContent side="right" className="w-80 bg-background/95 backdrop-blur-xl border-l border-border/50">
                <DialogTitle className="sr-only">Navigation Menu</DialogTitle>

                <div className="flex flex-col gap-6 mt-12">
                  <div className="px-2">
                    <SearchBar />
                  </div>

                  <div className="space-y-2">
                    {navLinks.map((link, index) => (
                      <Link
                        key={link.path}
                        href={link.path}
                        onClick={() => setMobileOpen(false)}
                        className="block group"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <div className={`relative px-4 py-3 rounded-xl transition-all duration-300 ${
                          pathname === link.path
                            ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                            : 'hover:bg-secondary/80 group-hover:translate-x-2'
                        }`}>
                          <div className="absolute inset-0 rounded-xl overflow-hidden opacity-0 group-hover:opacity-100">
                            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
                          </div>
                          <span className="relative z-10 text-base font-medium">{link.name}</span>
                        </div>
                      </Link>
                    ))}
                  </div>

                  <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

                  <div className="space-y-3">
                    <Button
                      className="w-full gap-2 relative overflow-hidden bg-gradient-to-r from-primary to-primary/90 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/30 group"
                      onClick={() => { setMobileOpen(false); setShowAddProperty(true); }}
                    >
                      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                      <Plus className="w-4 h-4 relative z-10 transition-transform duration-500 group-hover:rotate-180" />
                      <span className="relative z-10">Add Property</span>
                    </Button>

                    {mounted && (
                      <>
                        {!isAuthenticated ? (
                          <>
                            <Link href="/register" onClick={() => setMobileOpen(false)}>
                              <Button variant="outline" className="w-full relative overflow-hidden border-primary/30 hover:border-primary transition-all duration-300 hover:scale-[1.02] group mb-2">
                                <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/10 to-primary/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                                <span className="relative z-10 font-medium">Sign Up</span>
                              </Button>
                            </Link>
                            <Link href="/login" onClick={() => setMobileOpen(false)}>
                              <Button variant="default" className="w-full relative overflow-hidden bg-gradient-to-r from-primary to-primary/90 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl group">
                                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                                <span className="relative z-10 font-medium">Sign In</span>
                              </Button>
                            </Link>
                          </>
                        ) : (
                          <div className="flex flex-col gap-2">
                            <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
                              <Button variant="outline" className="w-full">
                                <User className="mr-2 h-4 w-4" />
                                Dashboard
                              </Button>
                            </Link>
                            <Button variant="ghost" className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={logout}>
                              <LogOut className="mr-2 h-4 w-4" />
                              Log out
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>

          </div>
        </div>
      </nav>
    </>
  );
};

export default Navbar;
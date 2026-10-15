"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Plus, Layers, User, type LucideIcon } from "lucide-react";

import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";
import { isPropertyDetail } from "@/lib/routes";

/**
 * The tab bar on phones — the pattern every Pakistani property app
 * uses (Zameen, OLX, Graana): Home, Search, a raised "+" to post, a section
 * tab, and Account.
 *
 * Most of this site's traffic arrives on a phone from search, and the only way
 * to get anywhere was the hamburger in the top bar — two taps and a sheet for
 * every move. This is one tap, always on screen.
 */

interface Tab {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
}

/** Cement is the most-read rate page, and the tab lights up on all of them. */
const RATES_HREF = "/today-cement-rate-in-pakistan";

const RATE_PATH = /^\/today-[a-z]+-rate-in-pakistan/;

export default function MobileNav() {
  const pathname = usePathname() || "/";
  const { isAuthenticated } = useAuth();

  /*
   * A listing page has its own sticky "Call / WhatsApp" bar pinned to the
   * bottom on mobile (PropertyDetail), and two stacked bars is one too many —
   * the contact buttons are what matter on that screen.
   */
  if (isPropertyDetail(pathname)) return null;

  const tabs: Tab[] = [
    { key: "home", label: "Home", href: "/", icon: Home },
    { key: "search", label: "Properties", href: "/properties", icon: Search },
    {
      key: "post",
      label: "Add",
      // Signed out, the dashboard would bounce to login and lose the intent.
      href: isAuthenticated
        ? "/dashboard/property/add-property"
        // Sign-up makes an agent account either way now, so there is
        // nothing to pass but the destination.
        : "/register?next=/dashboard/property/add-property",
      icon: Plus,
    },
    { key: "rates", label: "Rates", href: RATES_HREF, icon: Layers },
    {
      key: "account",
      label: "Account",
      href: isAuthenticated ? "/dashboard" : "/login",
      icon: User,
    },
  ];

  // One tab is always lit, so the bar never looks switched off mid-journey.
  const active = (() => {
    if (pathname === "/") return "home";
    if (pathname.startsWith("/dashboard/property/add-property")) return "post";
    if (RATE_PATH.test(pathname)) return "rates";
    if (
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/register")
    ) {
      return "account";
    }
    if (pathname.startsWith("/properties")) return "search";
    return "";
  })();

  /*
   * A floating glass bar with rounded ends, lifted off the bottom edge.
   * Labels and icons are near-black so they read on anything that scrolls
   * beneath; the current tab and the "+" carry the theme colour.
   */
  return (
    <nav
      aria-label="Main"
      className={cn(
        "fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex h-16 items-stretch md:hidden",
        "rounded-[22px] border border-white/60 bg-white/75 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.28),0_2px_6px_rgba(15,23,42,0.06)] backdrop-blur-xl backdrop-saturate-150",
      )}
    >
      {tabs.map((tab) => {
        const on = active === tab.key;
        const Icon = tab.icon;
        const isPost = tab.key === "post";

        if (isPost) {
          return (
            <Link
              key={tab.key}
              href={tab.href}
              prefetch={false}
              aria-label="Add a property"
              className="flex flex-1 flex-col items-center justify-center"
            >
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-white shadow-[0_6px_16px_-4px_var(--primary)] transition-transform active:scale-95">
                <Plus className="h-6 w-6" strokeWidth={2.6} />
              </span>
            </Link>
          );
        }

        return (
          <Link
            key={tab.key}
            href={tab.href}
            prefetch={false}
            aria-current={on ? "page" : undefined}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 transition-colors",
              on ? "text-primary" : "text-slate-950",
            )}
          >
            <Icon className="h-[22px] w-[22px]" strokeWidth={on ? 2.4 : 1.9} />
            <span className={cn("max-w-full truncate text-[10.5px] leading-none", on ? "font-bold" : "font-medium")}>
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

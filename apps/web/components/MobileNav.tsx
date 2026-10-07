"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Plus, Layers, User, type LucideIcon } from "lucide-react";

import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";

/**
 * The floating tab bar on phones — the pattern every Pakistani property app
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

/**
 * A single-segment path under /properties is a listing (/properties/5-marla-
 * house-dha-lahore); /properties/all, /rent and /sale are the search pages.
 */
function isPropertyDetail(pathname: string): boolean {
  if (pathname.startsWith("/p/") || pathname.startsWith("/listing-detail")) {
    return true;
  }
  const match = /^\/properties\/([^/]+)\/?$/.exec(pathname);
  return Boolean(match && !["all", "rent", "sale"].includes(match[1] ?? ""));
}

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
        // as=agent: someone tapping "Add" wants to list, so the sign-up form
        // opens on the agent side rather than the buyer side.
        : "/register?as=agent&next=/dashboard/property/add-property",
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

  return (
    <nav
      aria-label="Main"
      className={cn(
        "fixed inset-x-3 bottom-2 z-40 flex items-stretch justify-around md:hidden",
        "rounded-[28px] border border-border/40 bg-background/80 backdrop-blur-xl backdrop-saturate-150",
        "shadow-[0_10px_30px_rgba(15,23,42,0.14),0_2px_8px_rgba(15,23,42,0.05)]",
        // Clears the home-area gesture bar on iPhones.
        "pb-[max(0.375rem,env(safe-area-inset-bottom))]",
      )}
    >
      {tabs.map((tab) => {
        const on = active === tab.key;
        const Icon = tab.icon;

        if (tab.key === "post") {
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-label="Add a property"
              className="relative -mt-4 flex shrink-0 flex-col items-center justify-center px-1 transition-transform active:scale-90"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-background bg-primary text-primary-foreground shadow-lg shadow-primary/30">
                <Plus className="h-5 w-5" strokeWidth={2.8} />
              </span>
              <span className="-mt-1 text-[10px] font-semibold leading-none text-primary">
                {tab.label}
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
              "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-[3px] px-1 pb-1 pt-1.5",
              "transition-colors active:scale-90",
              on ? "text-primary" : "text-muted-foreground",
            )}
          >
            {/* The pill that marks the current tab. */}
            {on && (
              <span
                aria-hidden
                className="absolute left-1/2 top-0 h-[3px] w-6 -translate-x-1/2 rounded-b-[3px] bg-primary"
              />
            )}
            <Icon className="h-[21px] w-[21px]" strokeWidth={on ? 2.2 : 1.9} />
            <span
              className={cn(
                "max-w-full truncate text-[10px] leading-tight",
                on ? "font-extrabold" : "font-semibold",
              )}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

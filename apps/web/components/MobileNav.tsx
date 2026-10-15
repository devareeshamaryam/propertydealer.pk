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

  return (
    <nav
      aria-label="Main"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 flex h-14 items-stretch border-t border-slate-200 bg-white md:hidden",
        // Clears the home-area gesture bar on iPhones.
        "box-content pb-[env(safe-area-inset-bottom)]",
      )}
    >
      {tabs.map((tab) => {
        const on = active === tab.key;
        const Icon = tab.icon;
        const isPost = tab.key === "post";

        return (
          <Link
            key={tab.key}
            href={tab.href}
            prefetch={false}
            aria-current={on ? "page" : undefined}
            aria-label={isPost ? "Add a property" : undefined}
            className={cn(
              "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1",
              isPost || on ? "text-primary" : "text-slate-500",
            )}
          >
            {on && !isPost && (
              <span aria-hidden className="absolute inset-x-4 top-0 h-0.5 bg-primary" />
            )}
            {isPost ? (
              <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-white">
                <Plus className="h-4 w-4" strokeWidth={2.6} />
              </span>
            ) : (
              <Icon className="h-5 w-5" strokeWidth={on ? 2.2 : 1.8} />
            )}
            <span className={cn("max-w-full truncate text-[10px] leading-tight", on || isPost ? "font-semibold" : "font-medium")}>
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

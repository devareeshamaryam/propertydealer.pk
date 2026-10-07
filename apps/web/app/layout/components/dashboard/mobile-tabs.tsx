"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  Images,
  LayoutDashboard,
  Plus,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The dashboard's own tab bar, on phones.
 *
 * The sidebar collapses into a sheet below md, so every move an agent makes —
 * list a property, check views, open the media library — cost a tap on the
 * hamburger, a wait for the sheet, then the real tap. These are the five
 * things an agent does, one tap each, always on screen.
 *
 * Admin-only sections are deliberately absent: they stay in the sidebar, which
 * is still there. This bar is the agent's path through the dashboard.
 */

interface Tab {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Extra prefixes that should light this tab up. */
  also?: string[];
}

const TABS: Tab[] = [
  { key: "home", label: "Home", href: "/dashboard", icon: LayoutDashboard },
  {
    key: "listings",
    label: "Listings",
    href: "/dashboard/property",
    icon: Building2,
  },
  {
    key: "add",
    label: "Add",
    href: "/dashboard/property/add-property",
    icon: Plus,
  },
  { key: "insights", label: "Insights", href: "/dashboard/insights", icon: BarChart3 },
  {
    key: "media",
    label: "Media",
    href: "/dashboard/images-gallery",
    icon: Images,
  },
];

export default function DashboardMobileTabs() {
  const pathname = usePathname() || "";

  const active = (() => {
    if (pathname.startsWith("/dashboard/property/add-property")) return "add";
    if (pathname.startsWith("/dashboard/property")) return "listings";
    if (pathname.startsWith("/dashboard/insights")) return "insights";
    if (pathname.startsWith("/dashboard/images-gallery")) return "media";
    if (pathname === "/dashboard") return "home";
    return "";
  })();

  return (
    <nav
      aria-label="Dashboard"
      className={cn(
        "sticky bottom-0 z-20 flex items-stretch justify-around border-t md:hidden",
        "bg-background/90 backdrop-blur-lg",
        // Clears the home-area gesture bar on iPhones.
        "pb-[max(0.25rem,env(safe-area-inset-bottom))]",
      )}
    >
      {TABS.map((tab) => {
        const on = active === tab.key;
        const Icon = tab.icon;

        if (tab.key === "add") {
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
              <span className="-mt-1 pb-1 text-[10px] font-semibold leading-none text-primary">
                {tab.label}
              </span>
            </Link>
          );
        }

        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 pb-1 pt-2",
              "transition-colors active:scale-90",
              on ? "text-primary" : "text-muted-foreground",
            )}
          >
            {on && (
              <span
                aria-hidden
                className="absolute left-1/2 top-0 h-[3px] w-6 -translate-x-1/2 rounded-b-[3px] bg-primary"
              />
            )}
            <Icon className="h-[19px] w-[19px]" strokeWidth={on ? 2.2 : 1.9} />
            <span
              className={cn(
                "max-w-full truncate text-[10px] leading-tight",
                on ? "font-extrabold" : "font-medium",
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

"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/context/auth-context";
import DashboardSidebar from "../layout/components/dashboard/sidebar";
import {
  collectAdminRoutes,
  SEGMENT_LABELS,
} from "../layout/components/dashboard/nav-config";

/**
 * Derived from the nav tree rather than hand-listed. The old hard-coded array
 * covered cement-rate but not the other eight rate sections, so agents could
 * open /dashboard/steel-rate and friends directly.
 */
const ADMIN_ONLY_ROUTES = collectAdminRoutes();

/** MongoDB ObjectId - shown as a shortened id in breadcrumbs. */
const OBJECT_ID = /^[a-f\d]{24}$/i;

interface Crumb {
  label: string;
  href: string;
}

function buildCrumbs(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: Crumb[] = [];
  let href = "";

  for (const segment of segments) {
    href += `/${segment}`;
    const label = OBJECT_ID.test(segment)
      ? `#${segment.slice(-6)}`
      : (SEGMENT_LABELS[segment] ??
        segment
          .replace(/-/g, " ")
          .replace(/\b\w/g, (char) => char.toUpperCase()));
    crumbs.push({ label, href });
  }

  return crumbs;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuth();

  const isAdminRoute = useMemo(
    () =>
      ADMIN_ONLY_ROUTES.some(
        (route) => pathname === route || pathname.startsWith(`${route}/`),
      ),
    [pathname],
  );

  const accessDenied = Boolean(user && isAdminRoute && user.role !== "ADMIN");

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    if (!user) return;

    if (user.isActive === false) {
      router.push("/pending-activation");
      return;
    }

    if (isAdminRoute && user.role !== "ADMIN") {
      toast.error("Access denied", {
        description: "You do not have permission to open this page.",
      });
      router.push("/dashboard");
    }
  }, [isLoading, isAuthenticated, user, isAdminRoute, router]);

  if (isLoading) {
    return (
      <div className="flex h-dvh w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="sr-only">Loading dashboard</span>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const crumbs = buildCrumbs(pathname);

  return (
    <TooltipProvider delayDuration={200}>
      <SidebarProvider defaultOpen>
        <DashboardSidebar />

        <SidebarInset className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-1 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                {crumbs.map((crumb, index) => {
                  const isLast = index === crumbs.length - 1;
                  return (
                    <BreadcrumbItem key={crumb.href}>
                      {isLast ? (
                        <BreadcrumbPage className="font-medium">
                          {crumb.label}
                        </BreadcrumbPage>
                      ) : (
                        <>
                          <BreadcrumbLink
                            asChild
                            className="hidden sm:inline-flex"
                          >
                            <Link href={crumb.href}>{crumb.label}</Link>
                          </BreadcrumbLink>
                          <BreadcrumbSeparator className="hidden sm:block" />
                        </>
                      )}
                    </BreadcrumbItem>
                  );
                })}
              </BreadcrumbList>
            </Breadcrumb>
          </header>

          <main className="min-w-0 flex-1 bg-muted/30 p-4 sm:p-6">
            {/*
              Render nothing on a route this role cannot open. The guard above
              redirects in an effect, so without this the restricted page would
              still mount and fire its admin API calls first.
            */}
            {accessDenied ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              children
            )}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

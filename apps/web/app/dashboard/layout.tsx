"use client";

import { ChevronDown, Home, LayoutDashboard, MapPin, PlusCircle, Building, User, Building2Icon, House, Book, Loader2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { toast } from "sonner";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardSidebar from "../layout/components/dashboard/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  const ADMIN_ONLY_ROUTES = [
    '/dashboard/subscriptions',
    '/dashboard/packages',
    '/dashboard/users',
    '/dashboard/import',
    '/dashboard/pages',
    '/dashboard/blog-category',
    '/dashboard/images-gallery',
    '/dashboard/cement-rate',
    // '/dashboard/city',
    // '/dashboard/area',
  ];

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.push('/login');
        return;
      }

      if (user) {
        // 1. Check Activation
        if (user.isActive === false) {
          router.push('/pending-activation');
          return;
        }

        // 2. Check RBAC
        const isAdminRoute = ADMIN_ONLY_ROUTES.some(route => pathname.startsWith(route));
        if (isAdminRoute && user.role !== 'ADMIN') {
          toast.error("Access Denied", {
            description: "You do not have permission to access this page."
          });
          router.push('/dashboard');
        }
      }
    }
  }, [isLoading, isAuthenticated, user, pathname, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const isActive = (path: string) =>
    pathname === path || pathname.startsWith(`${path}/`);

  // Helper: check if any child route is active → keep parent expanded/highlighted
  const isSectionActive = (basePath: string) => pathname.startsWith(basePath);

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={true}>
        <div className="group flex h-dvh w-full">
          <DashboardSidebar />

          {/* Main Content */}
          <SidebarInset className="flex flex-1 flex-col overflow-hidden">
            <header className="flex h-14 shrink-0 items-center gap-4 border-b bg-background px-6">
              <SidebarTrigger />
              {/* Add breadcrumb, search, user menu here later */}
            </header>

            <main className="flex-1 overflow-y-auto overflow-x-hidden p-6">{children}</main>

          </SidebarInset>
        </div>
      </SidebarProvider>

    </TooltipProvider>
  );
}
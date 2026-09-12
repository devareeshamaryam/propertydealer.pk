"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building,
  ChevronRight,
  CircleDot,
  ExternalLink,
  LogOut,
  Search,
  SearchX,
  Settings,
  UserCircle,
  X,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";
import {
  isGroup,
  LEAF_ICONS,
  NAV_SECTIONS,
  type NavGroup,
  type NavLeaf,
  type NavSection,
} from "./nav-config";

/** Exact for index routes, prefix-match otherwise. */
function useIsActive() {
  const pathname = usePathname();
  return (item: NavLeaf) =>
    item.exact
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function matchesFilter(item: NavLeaf, term: string) {
  if (!term) return true;
  const haystack = [item.title, ...(item.keywords ?? [])]
    .join(" ")
    .toLowerCase();
  return haystack.includes(term);
}

function groupMatchesFilter(group: NavGroup, term: string) {
  if (!term) return true;
  if (group.title.toLowerCase().includes(term)) return true;
  return group.items.some((item) => matchesFilter(item, term));
}

export default function DashboardSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { state, isMobile, setOpen, setOpenMobile } = useSidebar();
  const isActive = useIsActive();
  const isAdmin = user?.role === "ADMIN";
  const collapsed = state === "collapsed" && !isMobile;

  const [filter, setFilter] = useState("");
  const term = filter.trim().toLowerCase();

  /**
   * Which groups are expanded. Previously each section used an uncontrolled
   * `defaultOpen`, so navigating between sibling pages left the wrong group
   * open and the destination group shut. This keeps the group containing the
   * current route open, while still honouring manual toggles.
   */
  const activeGroupId = useMemo(() => {
    for (const section of NAV_SECTIONS) {
      for (const entry of section.entries) {
        if (!isGroup(entry)) continue;
        // matches[] is ordered longest-first where prefixes overlap.
        if (
          entry.matches.some(
            (base) => pathname === base || pathname.startsWith(`${base}/`),
          )
        ) {
          return entry.id;
        }
      }
    }
    return null;
  }, [pathname]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    activeGroupId ? { [activeGroupId]: true } : {},
  );

  useEffect(() => {
    if (activeGroupId) {
      setOpenGroups((previous) => ({ ...previous, [activeGroupId]: true }));
    }
  }, [activeGroupId]);

  // Close the mobile drawer after a navigation so the page is visible.
  useEffect(() => {
    if (isMobile) setOpenMobile(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, isMobile]);

  const visibleSections = useMemo(() => {
    const sections: NavSection[] = [];
    for (const section of NAV_SECTIONS) {
      const entries = section.entries
        .filter((entry) => isAdmin || !entry.adminOnly)
        .map((entry) => {
          if (!isGroup(entry)) return entry;
          const items = entry.items
            .filter((item) => isAdmin || !item.adminOnly)
            .filter((item) =>
              term
                ? matchesFilter(item, term) ||
                  entry.title.toLowerCase().includes(term)
                : true,
            );
          return { ...entry, items };
        })
        .filter((entry) => {
          if (isGroup(entry))
            return entry.items.length > 0 && groupMatchesFilter(entry, term);
          return matchesFilter(entry, term);
        });

      if (entries.length > 0) sections.push({ label: section.label, entries });
    }
    return sections;
  }, [isAdmin, term]);

  const initials =
    (user?.name ?? user?.email ?? "?")
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?";

  const renderLeaf = (item: NavLeaf) => {
    const Icon = LEAF_ICONS[item.href] ?? CircleDot;
    return (
      <SidebarMenuItem key={item.href}>
        <SidebarMenuButton
          asChild
          isActive={isActive(item)}
          tooltip={item.title}
        >
          <Link href={item.href}>
            <Icon className="h-4 w-4" />
            <span>{item.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  const renderGroup = (group: NavGroup) => {
    const groupActive = group.id === activeGroupId;
    // While filtering, show every surviving group expanded so matches are visible.
    const isOpen = term ? true : (openGroups[group.id] ?? false);

    return (
      <Collapsible
        key={group.id}
        open={isOpen}
        onOpenChange={(open) => {
          // In icon mode the submenu is hidden by design; expand the rail first
          // so the click does something instead of silently toggling nothing.
          if (collapsed) {
            setOpen(true);
            setOpenGroups((previous) => ({ ...previous, [group.id]: true }));
            return;
          }
          setOpenGroups((previous) => ({ ...previous, [group.id]: open }));
        }}
        className="group/collapsible"
      >
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton
              tooltip={group.title}
              isActive={groupActive && !isOpen}
              className="font-medium"
            >
              <group.icon className="h-4 w-4" />
              <span>{group.title}</span>
              <ChevronRight className="ml-auto h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              {group.items.map((item) => (
                <SidebarMenuSubItem key={item.href}>
                  <SidebarMenuSubButton asChild isActive={isActive(item)}>
                    <Link href={item.href}>
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-b p-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 rounded-md px-1 py-1.5 transition-colors hover:bg-sidebar-accent"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Building className="h-4.5 w-4.5" />
          </div>
          <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-semibold tracking-tight">
              Property Dealer
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {isAdmin ? "Admin Panel" : "Agent Panel"}
            </span>
          </div>
        </Link>

        {/* Nav filter - with six sections this beats scanning the whole list. */}
        <div className="relative mt-1 group-data-[collapsible=icon]:hidden">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Jump to…"
            aria-label="Filter navigation"
            className="h-8 bg-background pl-8 pr-8 text-sm"
          />
          {filter && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0.5 top-1/2 h-7 w-7 -translate-y-1/2"
              onClick={() => setFilter("")}
              aria-label="Clear navigation filter"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        {visibleSections.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center group-data-[collapsible=icon]:hidden">
            <SearchX className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nothing matches “{filter}”
            </p>
          </div>
        )}

        {visibleSections.map((section, index) => (
          <SidebarGroup key={section.label ?? `root-${index}`} className="py-1">
            {section.label && (
              <SidebarGroupLabel className="px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {section.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {section.entries.map((entry) =>
                  isGroup(entry) ? renderGroup(entry) : renderLeaf(entry),
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* Account + sign out. The dashboard previously had no way to log out. */}
      <SidebarFooter className="border-t p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  tooltip={user?.name ?? user?.email ?? "Account"}
                  className="data-[state=open]:bg-sidebar-accent"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarFallback className="rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-1 flex-col text-left leading-tight">
                    <span className="truncate text-sm font-medium">
                      {user?.name ?? "Account"}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user?.email}
                    </span>
                  </div>
                  <Settings className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side={collapsed ? "right" : "top"}
                align="start"
                className="w-56"
              >
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col">
                    <span className="truncate text-sm font-medium">
                      {user?.name ?? "Account"}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user?.email}
                    </span>
                    <span
                      className={cn(
                        "mt-1.5 w-fit rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        isAdmin
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {user?.role ?? "USER"}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  {/* The old link pointed at /dashboard/user-account, which had no route. */}
                  <Link href="/dashboard/account">
                    <UserCircle className="mr-2 h-4 w-4" />
                    My Account
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View Website
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => void logout()}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

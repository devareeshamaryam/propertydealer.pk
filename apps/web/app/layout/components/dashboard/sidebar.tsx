 import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  BookOpen,
  PlusCircle,
  Building,
  MapPin,
  User,
  ChevronDown,
  Image,
  FileTextIcon,
  Package2,
  CreditCard,
  Wallet,
  Layers,
  Hammer,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
// import { cn } from "@/lib/utils";

export default function DashboardSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const isActive = (path: string) =>
    pathname === path || pathname.startsWith(`${path}/`);

  const isSectionActive = (base: string) => pathname.startsWith(base);

  const navItems = [
    {
      title: "Dashboard",
      icon: LayoutDashboard,
      href: "/dashboard",
      exact: true,
    },
    {
      title: "My Subscription",
      icon: Wallet,
      href: "/dashboard/my-subscription",
      exact: true,
    },
  ];

  const blogSection = {
    title: "Blog",
    icon: BookOpen,
    basePath: "/dashboard/blog",
    items: [{ title: "All Posts", href: "/dashboard/blog" }],
  };

  const propertiesSection = {
    title: "Properties",
    icon: PlusCircle,
    basePath: "/dashboard/property",
    items: [
      { title: isAdmin ? "All Properties" : "My Listings", href: "/dashboard/property" },
      { title: "Add New Property", href: "/dashboard/property/add-property" },
      ...(isAdmin ? [{ title: "Import Properties", href: "/dashboard/import" }] : []),
    ],
  };

  const packagesSection = {
    title: "Packages",
    icon: Package2,
    basePath: "/dashboard/packages",
    items: [
      { title: "All Packages", href: "/dashboard/packages" },
      { title: "Add New Package", href: "/dashboard/packages/add" },
    ],
  };

  const cementRateSection = {
    title: "Cement Rate",
    icon: Layers,
    basePath: "/dashboard/cement-rate",
    items: [
      { title: "All Cement Rates", href: "/dashboard/cement-rate" },
      { title: "Add Cement Rate", href: "/dashboard/cement-rate/add" },
      { title: "Cement Orders", href: "/dashboard/cement-order" },
    ],
  };

  const doorRateSection = {
    title: "Door Rate",
    icon: Hammer,
    basePath: "/dashboard/door-rate",
    items: [
      { title: "All Door Rates", href: "/dashboard/door-rate" },
      { title: "Add Door Rate", href: "/dashboard/door-rate/add" },
    ],
  };

  const woodRateSection = {
    title: "Wood Rate",
    icon: Hammer,
    basePath: "/dashboard/wood-rate",
    items: [
      { title: "All Wood Rates", href: "/dashboard/wood-rate" },
      { title: "Add Wood Rate", href: "/dashboard/wood-rate/add" },
    ],
  };

  const sandRateSection = {
    title: "Sand Rate",
    icon: Hammer,
    basePath: "/dashboard/sand-rate",
    items: [
      { title: "All Sand Rates", href: "/dashboard/sand-rate" },
      { title: "Add Sand Rate", href: "/dashboard/sand-rate/add" },
    ],
  };

  const tileRateSection = {
    title: "Tile Rate",
    icon: Hammer,
    basePath: "/dashboard/tile-rate",
    items: [
      { title: "All Tile Rates", href: "/dashboard/tile-rate" },
      { title: "Add Tile Rate", href: "/dashboard/tile-rate/add" },
    ],
  };

  const bajriRateSection = {
    title: "Bajri Rate",
    icon: Hammer,
    basePath: "/dashboard/bajri-rate",
    items: [
      { title: "All Bajri Rates", href: "/dashboard/bajri-rate" },
      { title: "Add Bajri Rate", href: "/dashboard/bajri-rate/add" },
    ],
  };

  const steelRateSection = {
    title: "Steel Rate",
    icon: Hammer,
    basePath: "/dashboard/steel-rate",
    items: [
      { title: "All Steel Rates", href: "/dashboard/steel-rate" },
      { title: "Add Steel Rate", href: "/dashboard/steel-rate/add" },
    ],
  };

  const bricksRateSection = {
    title: "Bricks Rate",
    icon: Hammer,
    basePath: "/dashboard/bricks-rate",
    items: [
      { title: "All Bricks Rates", href: "/dashboard/bricks-rate" },
      { title: "Add Bricks Rate", href: "/dashboard/bricks-rate/add" },
    ],
  };

  const subscriptionsSection = {
    title: "Subscriptions",
    icon: CreditCard,
    basePath: "/dashboard/subscriptions",
    items: [
      { title: "All Subscriptions", href: "/dashboard/subscriptions" },
    ],
  };

  const citiesSection = {
    title: "Cities",
    icon: Building,
    basePath: "/dashboard/city",
    items: [
      { title: "All Cities", href: "/dashboard/city" },
      { title: "Add New City", href: "/dashboard/city/add-city" },
    ],
  };

  const areasSection = {
    title: "Areas",
    icon: MapPin,
    basePath: "/dashboard/area",
    items: [
      { title: "All Areas", href: "/dashboard/area" },
      { title: "Add New Area", href: "/dashboard/area/add-area" },
    ],
  };

  const imagesGallerySection = {
    title: "Images Gallery",
    icon: Image,
    basePath: "/dashboard/images-gallery",
  }

  const accountSection = {
    title: "Account",
    icon: User,
    href: "/dashboard/user-account",
  };

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-b px-4 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Building className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-semibold tracking-tight">Property Dealer</span>
            <span className="text-xs text-muted-foreground font-medium">
              {isAdmin ? 'Admin Panel' : 'Agent Panel'}
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Overview */}
        <SidebarGroup>

          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isActive(item.href)}>
                    <Link href={item.href}>
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
          {/* <SidebarGroupLabel>Overview</SidebarGroupLabel> */}
        </SidebarGroup>

        {/* Blog Section - Admin Only */}
        {isAdmin && (
          <>
            {/* Blog Category */}
            <Collapsible defaultOpen={isSectionActive("/dashboard/blog/category")}>
              <SidebarGroup>
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className="flex cursor-pointer items-center justify-between px-3 py-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md transition-colors">
                    <div className="flex items-center gap-3">
                      <BookOpen className="h-5 w-5" />
                      <span>Blog Category</span>
                    </div>
                    <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
                  </SidebarGroupLabel>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu className="pl-3">
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={isActive("/dashboard/blog-category")}>
                          <Link href="/dashboard/blog-category">
                            <span>All Categories</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>

            {/* Blog */}
            <Collapsible defaultOpen={isSectionActive(blogSection.basePath)}>
              <SidebarGroup>
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className="flex cursor-pointer items-center justify-between px-3 py-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md transition-colors">
                    <div className="flex items-center gap-3">
                      <blogSection.icon className="h-5 w-5" />
                      <span>{blogSection.title}</span>
                    </div>
                    <ChevronDown className="h-4 w-4 transition-transform duration-200 data-\[state=open\]:rotate-180" />
                  </SidebarGroupLabel>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu className="pl-3">
                      {blogSection.items.map((item) => (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton asChild isActive={isActive(item.href)}>
                            <Link href={item.href}>
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          </>
        )}

        {/* Properties */}
        <Collapsible defaultOpen={isSectionActive(propertiesSection.basePath)}>
          <SidebarGroup>
            <CollapsibleTrigger asChild>
              <SidebarGroupLabel className="flex cursor-pointer items-center justify-between px-3 py-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md transition-colors">
                <div className="flex items-center gap-3">
                  <propertiesSection.icon className="h-5 w-5" />
                  <span>{propertiesSection.title}</span>
                </div>
                <ChevronDown className="h-4 w-4 transition-transform duration-200 data-\[state=open\]:rotate-180" />
              </SidebarGroupLabel>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu className="pl-3">
                  {propertiesSection.items.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={isActive(item.href)}>
                        <Link href={item.href}>
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Locations */}
        <Collapsible
          defaultOpen={
            isSectionActive(citiesSection.basePath) ||
            isSectionActive(areasSection.basePath)
          }
        >
          <SidebarGroup>
            <CollapsibleTrigger asChild>
              <SidebarGroupLabel className="flex cursor-pointer items-center justify-between px-3 py-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md transition-colors">
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5" />
                  <span>Locations</span>
                </div>
                <ChevronDown className="h-4 w-4 transition-transform duration-200 data-\[state=open\]:rotate-180" />
              </SidebarGroupLabel>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <SidebarGroupContent>
                {/* Cities */}
                <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                  Cities
                </div>
                <SidebarMenu className="pl-3 mb-2">
                  {citiesSection.items.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={isActive(item.href)}>
                        <Link href={item.href}>
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>

                {/* Areas */}
                <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                  Areas
                </div>
                <SidebarMenu className="pl-3">
                  {areasSection.items.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={isActive(item.href)}>
                        <Link href={item.href}>
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Packages & Subscriptions - Admin Only */}
        {isAdmin && (
          <>
            {/* Packages */}
            <Collapsible defaultOpen={isSectionActive(packagesSection.basePath)}>
              <SidebarGroup>
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className="flex cursor-pointer items-center justify-between px-3 py-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md transition-colors">
                    <div className="flex items-center gap-3">
                      <packagesSection.icon className="h-5 w-5" />
                      <span>{packagesSection.title}</span>
                    </div>
                    <ChevronDown className="h-4 w-4 transition-transform duration-200 data-\[state=open\]:rotate-180" />
                  </SidebarGroupLabel>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu className="pl-3">
                      {packagesSection.items.map((item) => (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton asChild isActive={isActive(item.href)}>
                            <Link href={item.href}>
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>

            {/* Subscriptions */}
            <Collapsible defaultOpen={isSectionActive(subscriptionsSection.basePath)}>
              <SidebarGroup>
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className="flex cursor-pointer items-center justify-between px-3 py-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md transition-colors">
                    <div className="flex items-center gap-3">
                      <subscriptionsSection.icon className="h-5 w-5" />
                      <span>{subscriptionsSection.title}</span>
                    </div>
                    <ChevronDown className="h-4 w-4 transition-transform duration-200 data-\[state=open\]:rotate-180" />
                  </SidebarGroupLabel>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu className="pl-3">
                      {subscriptionsSection.items.map((item) => (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton asChild isActive={isActive(item.href)}>
                            <Link href={item.href}>
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
            {/* Cement Rate */}
            <Collapsible defaultOpen={isSectionActive(cementRateSection.basePath)}>
              <SidebarGroup>
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className="flex cursor-pointer items-center justify-between px-3 py-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md transition-colors">
                    <div className="flex items-center gap-3">
                      <cementRateSection.icon className="h-5 w-5" />
                      <span>{cementRateSection.title}</span>
                    </div>
                    <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
        
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu className="pl-3">
                      {cementRateSection.items.map((item) => (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton asChild isActive={isActive(item.href)}>
                            <Link href={item.href}>
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
        
            {/* Door Rate */}
            <Collapsible defaultOpen={isSectionActive(doorRateSection.basePath)}>
              <SidebarGroup>
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className="flex cursor-pointer items-center justify-between px-3 py-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md transition-colors">
                    <div className="flex items-center gap-3">
                      <doorRateSection.icon className="h-5 w-5" />
                      <span>{doorRateSection.title}</span>
                    </div>
                    <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
        
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu className="pl-3">
                      {doorRateSection.items.map((item) => (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton asChild isActive={isActive(item.href)}>
                            <Link href={item.href}>
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>

            {/* Wood Rate */}
            <Collapsible defaultOpen={isSectionActive(woodRateSection.basePath)}>
              <SidebarGroup>
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className="flex cursor-pointer items-center justify-between px-3 py-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md transition-colors">
                    <div className="flex items-center gap-3">
                      <woodRateSection.icon className="h-5 w-5" />
                      <span>{woodRateSection.title}</span>
                    </div>
                    <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
        
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu className="pl-3">
                      {woodRateSection.items.map((item) => (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton asChild isActive={isActive(item.href)}>
                            <Link href={item.href}>
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>

            {/* Sand Rate */}
            <Collapsible defaultOpen={isSectionActive(sandRateSection.basePath)}>
              <SidebarGroup>
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className="flex cursor-pointer items-center justify-between px-3 py-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md transition-colors">
                    <div className="flex items-center gap-3">
                      <sandRateSection.icon className="h-5 w-5" />
                      <span>{sandRateSection.title}</span>
                    </div>
                    <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
        
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu className="pl-3">
                      {sandRateSection.items.map((item) => (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton asChild isActive={isActive(item.href)}>
                            <Link href={item.href}>
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>

            {/* Tile Rate */}
            <Collapsible defaultOpen={isSectionActive(tileRateSection.basePath)}>
              <SidebarGroup>
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className="flex cursor-pointer items-center justify-between px-3 py-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md transition-colors">
                    <div className="flex items-center gap-3">
                      <tileRateSection.icon className="h-5 w-5" />
                      <span>{tileRateSection.title}</span>
                    </div>
                    <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
        
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu className="pl-3">
                      {tileRateSection.items.map((item) => (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton asChild isActive={isActive(item.href)}>
                            <Link href={item.href}>
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>

            {/* Bajri Rate */}
            <Collapsible defaultOpen={isSectionActive(bajriRateSection.basePath)}>
              <SidebarGroup>
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className="flex cursor-pointer items-center justify-between px-3 py-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md transition-colors">
                    <div className="flex items-center gap-3">
                      <bajriRateSection.icon className="h-5 w-5" />
                      <span>{bajriRateSection.title}</span>
                    </div>
                    <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
        
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu className="pl-3">
                      {bajriRateSection.items.map((item) => (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton asChild isActive={isActive(item.href)}>
                            <Link href={item.href}>
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>

            {/* Steel Rate */}
            <Collapsible defaultOpen={isSectionActive(steelRateSection.basePath)}>
              <SidebarGroup>
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className="flex cursor-pointer items-center justify-between px-3 py-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md transition-colors">
                    <div className="flex items-center gap-3">
                      <steelRateSection.icon className="h-5 w-5" />
                      <span>{steelRateSection.title}</span>
                    </div>
                    <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
        
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu className="pl-3">
                      {steelRateSection.items.map((item) => (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton asChild isActive={isActive(item.href)}>
                            <Link href={item.href}>
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>

            {/* Bricks Rate */}
            <Collapsible defaultOpen={isSectionActive(bricksRateSection.basePath)}>
              <SidebarGroup>
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className="flex cursor-pointer items-center justify-between px-3 py-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md transition-colors">
                    <div className="flex items-center gap-3">
                      <bricksRateSection.icon className="h-5 w-5" />
                      <span>{bricksRateSection.title}</span>
                    </div>
                    <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
        
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu className="pl-3">
                      {bricksRateSection.items.map((item) => (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton asChild isActive={isActive(item.href)}>
                            <Link href={item.href}>
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          </>
        )}

        {/* Admin Management Sections */}
        {isAdmin && (
          <>

            {/* Images Gallery */}
            <Collapsible defaultOpen={isSectionActive(imagesGallerySection.basePath)}>
              <SidebarGroup>
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className="flex cursor-pointer items-center justify-between px-3 py-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md transition-colors">
                    <div className="flex items-center gap-3">
                      <imagesGallerySection.icon className="h-5 w-5" />
                      <span>{imagesGallerySection.title}</span>
                    </div>
                    <ChevronDown className="h-4 w-4 transition-transform duration-200 data-\[state=open\]:rotate-180" />
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu className="pl-3">
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={isActive("/dashboard/images-gallery")}>
                          <Link href="/dashboard/images-gallery">
                            <span>All Images</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>

            {/* Pages Section */}
            <Collapsible defaultOpen={isSectionActive("/dashboard/pages")}>
              <SidebarGroup>
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className="flex cursor-pointer items-center justify-between px-3 py-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md transition-colors">
                    <div className="flex items-center gap-3">
                      <FileTextIcon className="h-5 w-5" />
                      <span>Pages</span>
                    </div>
                    <ChevronDown className="h-4 w-4 transition-transform duration-200 data-\[state=open\]:rotate-180" />
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu className="pl-3">
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={isActive("/dashboard/pages")}>
                          <Link href="/dashboard/pages">
                            <span>All Pages</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>

            {/* Users Section */}
            <Collapsible defaultOpen={isSectionActive("/dashboard/users")}>
              <SidebarGroup>
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className="flex cursor-pointer items-center justify-between px-3 py-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md transition-colors">
                    <div className="flex items-center gap-3">
                      <User className="h-5 w-5" />
                      <span>Users</span>
                    </div>
                    <ChevronDown className="h-4 w-4 transition-transform duration-200 data-\[state=open\]:rotate-180" />
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu className="pl-3">
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={isActive("/dashboard/users")}>
                          <Link href="/dashboard/users">
                            <span>Manage Users</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          </>
        )}


        {/* Account (bottom) */}
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive(accountSection.href)}>
                  <Link href={accountSection.href}>
                    <accountSection.icon className="h-5 w-5" />
                    <span>{accountSection.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}

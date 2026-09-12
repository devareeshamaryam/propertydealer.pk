import {
  BookOpen,
  Building2,
  CreditCard,
  FileText,
  FolderTree,
  Image as ImageIcon,
  LayoutDashboard,
  Layers,
  MapPin,
  Package2,
  Users,
  Wallet,
} from "lucide-react";
import type { ComponentType } from "react";

export interface NavLeaf {
  title: string;
  href: string;
  /** Match the href exactly. Use for index routes whose children are separate entries. */
  exact?: boolean;
  adminOnly?: boolean;
  /** Extra words the sidebar filter should match against. */
  keywords?: string[];
}

export interface NavGroup {
  /** Stable id used as the collapsible key. */
  id: string;
  title: string;
  icon: ComponentType<{ className?: string }>;
  /** Path prefixes that belong to this group, used for active and auto-open state. */
  matches: string[];
  items: NavLeaf[];
  adminOnly?: boolean;
}

export interface NavSection {
  /** Section heading, or null for the ungrouped top block. */
  label: string | null;
  entries: (NavGroup | NavLeaf)[];
}

export function isGroup(entry: NavGroup | NavLeaf): entry is NavGroup {
  return "items" in entry;
}

/**
 * The nine material rates used to be nine top-level sidebar sections with two
 * links each - eighteen entries for one concern. They are one group now; the
 * add and edit actions live on each list page, where the context already is.
 */
const MATERIAL_RATE_ITEMS: NavLeaf[] = [
  {
    title: "Cement",
    href: "/dashboard/cement-rate",
    exact: true,
    keywords: ["opc", "bag"],
  },
  {
    title: "Bricks",
    href: "/dashboard/bricks-rate",
    exact: true,
    keywords: ["awal", "khingar"],
  },
  {
    title: "Sand",
    href: "/dashboard/sand-rate",
    exact: true,
    keywords: ["ravi", "chenab", "reta"],
  },
  {
    title: "Bajri (Crush)",
    href: "/dashboard/bajri-rate",
    exact: true,
    keywords: ["crush", "gravel"],
  },
  {
    title: "Steel",
    href: "/dashboard/steel-rate",
    exact: true,
    keywords: ["sarya", "iron", "rebar"],
  },
  {
    title: "Wood",
    href: "/dashboard/wood-rate",
    exact: true,
    keywords: ["lakri", "timber"],
  },
  {
    title: "Doors",
    href: "/dashboard/door-rate",
    exact: true,
    keywords: ["darwaza"],
  },
  {
    title: "Tiles",
    href: "/dashboard/tile-rate",
    exact: true,
    keywords: ["marble", "flooring"],
  },
];

export const NAV_SECTIONS: NavSection[] = [
  {
    label: null,
    entries: [
      {
        title: "Overview",
        href: "/dashboard",
        exact: true,
        keywords: ["home", "stats", "dashboard"],
      },
    ],
  },
  {
    label: "Real Estate",
    entries: [
      {
        id: "properties",
        title: "Properties",
        icon: Building2,
        matches: [
          "/dashboard/property",
          "/dashboard/import",
          "/dashboard/listed-properties",
        ],
        items: [
          {
            title: "All Properties",
            href: "/dashboard/property",
            exact: true,
            keywords: ["listings"],
          },
          {
            title: "Add Property",
            href: "/dashboard/property/add-property",
            keywords: ["new", "create"],
          },
          {
            title: "Bulk Import",
            href: "/dashboard/import",
            adminOnly: true,
            keywords: ["csv", "excel", "upload"],
          },
        ],
      },
      {
        id: "locations",
        title: "Locations",
        icon: MapPin,
        matches: ["/dashboard/city", "/dashboard/area"],
        items: [
          { title: "Cities", href: "/dashboard/city", exact: true },
          { title: "Add City", href: "/dashboard/city/add-city" },
          {
            title: "Areas",
            href: "/dashboard/area",
            exact: true,
            keywords: ["society", "sector", "phase"],
          },
          { title: "Add Area", href: "/dashboard/area/add-area" },
        ],
      },
    ],
  },
  {
    label: "Content",
    entries: [
      {
        id: "blog",
        title: "Blog",
        icon: BookOpen,
        adminOnly: true,
        // Ordered longest-first so /dashboard/blog-category never resolves as
        // a child of /dashboard/blog.
        matches: ["/dashboard/blog-category", "/dashboard/blog"],
        items: [
          {
            title: "All Posts",
            href: "/dashboard/blog",
            exact: true,
            keywords: ["articles"],
          },
          {
            title: "Write New Post",
            href: "/dashboard/blog/add-blog",
            keywords: ["create", "draft"],
          },
          {
            title: "Categories",
            href: "/dashboard/blog-category",
            exact: true,
            keywords: ["taxonomy", "tags"],
          },
          {
            title: "Add Category",
            href: "/dashboard/blog-category/add-category",
          },
        ],
      },
      {
        id: "pages",
        title: "Static Pages",
        icon: FileText,
        adminOnly: true,
        matches: ["/dashboard/pages"],
        items: [
          {
            title: "All Pages",
            href: "/dashboard/pages",
            exact: true,
            keywords: ["seo", "cms", "landing"],
          },
          { title: "Add Page", href: "/dashboard/pages/add-page" },
        ],
      },
      {
        title: "Media Library",
        href: "/dashboard/images-gallery",
        adminOnly: true,
        keywords: ["images", "gallery", "photos", "uploads"],
      },
    ],
  },
  {
    label: "Construction Rates",
    entries: [
      {
        id: "material-rates",
        title: "Material Rates",
        icon: Layers,
        adminOnly: true,
        matches: MATERIAL_RATE_ITEMS.map((item) => item.href).concat(
          "/dashboard/material-rate",
        ),
        items: MATERIAL_RATE_ITEMS,
      },
      {
        id: "rate-taxonomy",
        title: "Rate Settings",
        icon: FolderTree,
        adminOnly: true,
        matches: ["/dashboard/tile-category", "/dashboard/cement-order"],
        items: [
          {
            title: "Tile Categories",
            href: "/dashboard/tile-category",
            exact: true,
          },
          { title: "Add Tile Category", href: "/dashboard/tile-category/add" },
          {
            title: "Cement Orders",
            href: "/dashboard/cement-order",
            keywords: ["leads", "enquiries"],
          },
        ],
      },
    ],
  },
  {
    label: "Billing",
    entries: [
      {
        id: "packages",
        title: "Packages",
        icon: Package2,
        adminOnly: true,
        matches: ["/dashboard/packages"],
        items: [
          {
            title: "All Packages",
            href: "/dashboard/packages",
            exact: true,
            keywords: ["plans", "pricing"],
          },
          { title: "Add Package", href: "/dashboard/packages/add" },
        ],
      },
      {
        title: "Subscriptions",
        href: "/dashboard/subscriptions",
        adminOnly: true,
        keywords: ["billing", "payments", "plans"],
      },
      {
        title: "My Subscription",
        href: "/dashboard/my-subscription",
        keywords: ["plan", "billing", "upgrade"],
      },
    ],
  },
  {
    label: "Administration",
    entries: [
      {
        title: "Users",
        href: "/dashboard/users",
        exact: true,
        adminOnly: true,
        keywords: ["accounts", "agents", "roles", "permissions"],
      },
    ],
  },
];

/** Icons for the flat (non-group) leaves, keyed by href. */
export const LEAF_ICONS: Record<
  string,
  ComponentType<{ className?: string }>
> = {
  "/dashboard": LayoutDashboard,
  "/dashboard/images-gallery": ImageIcon,
  "/dashboard/subscriptions": CreditCard,
  "/dashboard/my-subscription": Wallet,
  "/dashboard/users": Users,
};

/**
 * Every dashboard route that requires ADMIN, derived from the nav tree so the
 * layout guard and the sidebar can never disagree about who may see what.
 */
export function collectAdminRoutes(): string[] {
  const routes = new Set<string>();
  for (const section of NAV_SECTIONS) {
    for (const entry of section.entries) {
      if (isGroup(entry)) {
        if (entry.adminOnly) {
          for (const match of entry.matches) routes.add(match);
          for (const item of entry.items) routes.add(item.href);
        } else {
          for (const item of entry.items) {
            if (item.adminOnly) routes.add(item.href);
          }
        }
      } else if (entry.adminOnly) {
        routes.add(entry.href);
      }
    }
  }
  return [...routes];
}

/** Human labels for breadcrumbs, keyed by path segment. */
export const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  property: "Properties",
  "add-property": "Add Property",
  "listed-properties": "Listed Properties",
  import: "Bulk Import",
  city: "Cities",
  "add-city": "Add City",
  area: "Areas",
  "add-area": "Add Area",
  blog: "Blog",
  "add-blog": "New Post",
  "blog-category": "Blog Categories",
  "add-category": "Add Category",
  pages: "Static Pages",
  "add-page": "Add Page",
  "images-gallery": "Media Library",
  "cement-rate": "Cement Rates",
  "cement-order": "Cement Orders",
  "bricks-rate": "Bricks Rates",
  "sand-rate": "Sand Rates",
  "bajri-rate": "Bajri Rates",
  "steel-rate": "Steel Rates",
  "wood-rate": "Wood Rates",
  "door-rate": "Door Rates",
  "tile-rate": "Tile Rates",
  "material-rate": "Material Rates",
  "tile-category": "Tile Categories",
  packages: "Packages",
  subscriptions: "Subscriptions",
  "my-subscription": "My Subscription",
  "purchase-package": "Purchase Package",
  users: "Users",
  account: "My Account",
  add: "Add",
  edit: "Edit",
};

import {
  Banknote,
  Megaphone,
  BellRing,
  BarChart3,
  BookOpen,
  Flag,
  Building2,
  CreditCard,
  FileText,
  FolderTree,
  Image as ImageIcon,
  LayoutDashboard,
  Layers,
  MapPin,
  Map as MapIcon,
  Package2,
  Palette,
  ShoppingBag,
  Store,
  Tags,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import type { ComponentType } from "react";

export interface NavLeaf {
  title: string;
  /** Shown instead of title to non-admins, where the admin wording would mislead. */
  agentTitle?: string;
  href: string;
  /** Match the href exactly. Use for index routes whose children are separate entries. */
  exact?: boolean;
  adminOnly?: boolean;
  /** Hidden from admins — for agent-side screens. */
  agentOnly?: boolean;
  /** Hidden from an agency's own agents — the plan and the team are the agency owner's. */
  notForTeamAgents?: boolean;
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
      {
        // An agent's second-most-visited screen after their listings: "is
        // anybody looking at them?". Not admin-only — the numbers are scoped
        // to whoever is asking.
        title: "Insights",
        href: "/dashboard/insights",
        keywords: ["analytics", "views", "performance", "stats", "enquiries"],
      },
      {
        // An agency owner's agent accounts (the agency plans); explains the plans to everyone else.
        title: "My Team",
        href: "/dashboard/team",
        agentOnly: true,
        notForTeamAgents: true,
        keywords: ["agents", "team", "agency", "staff"],
      },
      {
        // Top level, the way WordPress puts Media — and deliberately NOT
        // admin-only: agents upload property photos, and the API scopes the
        // library so each one only ever sees their own uploads.
        title: "Media Library",
        href: "/dashboard/images-gallery",
        keywords: ["images", "gallery", "photos", "uploads", "media"],
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
            // An agent only ever sees their own rows here (the API scopes the
            // list by owner), so "All" would be a lie.
            agentTitle: "My Properties",
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
        // Cities and areas are ADMIN-only on the API (city.controller.ts /
        // area.controller.ts guard every write with AdminGuard). Agents used to
        // see these four links and get a 403 on save.
        adminOnly: true,
        matches: ["/dashboard/societies", "/dashboard/city", "/dashboard/area"],
        items: [
          { title: "Cities", href: "/dashboard/city", exact: true },
          { title: "Add City", href: "/dashboard/city/add-city" },
          {
            title: "Areas",
            href: "/dashboard/area",
            exact: true,
            keywords: ["mohalla", "sector", "locality"],
          },
          { title: "Add Area", href: "/dashboard/area/add-area" },
          // A society: its guide page, its phases (areas under it), its map.
          { title: "Societies", href: "/dashboard/societies", keywords: ["society", "housing scheme", "phase", "guide", "dha", "bahria"] },
        ],
      },
      {
        // Society master plans on the map: /emap/<city>/<society>.
        id: "society-maps",
        title: "Society Maps",
        icon: MapIcon,
        adminOnly: true,
        matches: ["/dashboard/society-maps"],
        items: [
          {
            title: "All Maps",
            href: "/dashboard/society-maps",
            exact: true,
            keywords: ["emap", "master plan", "blocks", "society", "phase"],
          },
          { title: "Add Map", href: "/dashboard/society-maps/new", keywords: ["upload", "master plan"] },
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
    ],
  },
  {
    label: "Shop",
    entries: [
      {
        title: "Orders",
        href: "/dashboard/cement-order",
        adminOnly: true,
        keywords: ["orders", "cement orders", "shop", "delivery", "customers"],
      },
      {
        title: "Rates Board",
        href: "/dashboard/shop-products",
        adminOnly: true,
        keywords: ["prices", "rates", "products", "update rate", "today rate"],
      },
      {
        title: "Shop Settings",
        href: "/dashboard/shop-settings",
        adminOnly: true,
        keywords: ["delivery", "cod", "minimum order", "checkout"],
      },
      {
        id: "material-rates",
        title: "Material Rates",
        icon: Layers,
        adminOnly: true,
        matches: MATERIAL_RATE_ITEMS.map((item) => item.href).concat(
          "/dashboard/material-rate",
          "/dashboard/materials",
        ),
        items: [
          ...MATERIAL_RATE_ITEMS,
          // New materials (Marble, Glass…) without code: each gets its page, menu and shop place.
          { title: "+ Add a new material", href: "/dashboard/materials", exact: true, keywords: ["new material", "material type", "marble", "glass", "paint"] },
          { title: "All added products", href: "/dashboard/material-rate", keywords: ["custom", "other materials", "added materials' rates"] },
        ],
      },
      {
        id: "rate-taxonomy",
        title: "Tile Categories",
        icon: FolderTree,
        adminOnly: true,
        matches: ["/dashboard/tile-category"],
        items: [
          {
            title: "All Tile Categories",
            href: "/dashboard/tile-category",
            exact: true,
          },
          { title: "Add Tile Category", href: "/dashboard/tile-category/add" },
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
        keywords: ["billing", "payments", "plans", "invoices", "verify"],
      },
      {
        title: "Payment Methods",
        href: "/dashboard/payment-methods",
        adminOnly: true,
        keywords: ["jazzcash", "easypaisa", "bank", "account", "checkout"],
      },
      {
        title: "My Subscription",
        href: "/dashboard/my-subscription",
        keywords: ["plan", "billing", "upgrade"],
      },
      {
        /*
         * The one billing entry an agent can see.
         *
         * Packages, Subscriptions and Payment Methods are all adminOnly, so
         * the only way to buy anything was a "View Packages" button on the My
         * Subscription page — one click deeper than anyone looks. An agent
         * who wants to pay should never have to hunt for where.
         */
        title: "Buy a Plan",
        href: "/dashboard/purchase-package",
        notForTeamAgents: true,
        keywords: ["package", "packages", "upgrade", "subscribe", "checkout", "pay"],
      },
    ],
  },
  {
    label: "Administration",
    entries: [
      {
        title: "Reports",
        href: "/dashboard/reports",
        adminOnly: true,
        keywords: ["flag", "scam", "fraud", "complaints", "abuse"],
      },
      {
        title: "Users",
        href: "/dashboard/users",
        exact: true,
        adminOnly: true,
        keywords: ["accounts", "agents", "roles", "permissions"],
      },
      {
        title: "General Settings",
        href: "/dashboard/settings",
        adminOnly: true,
        keywords: ["settings", "contact", "phone", "whatsapp", "email", "social", "footer", "seo", "analytics", "announcement", "homepage"],
      },
      {
        title: "Appearance",
        href: "/dashboard/appearance",
        adminOnly: true,
        keywords: ["theme", "colour", "color", "brand", "logo", "font", "favicon", "design", "hero", "background"],
      },
      {
        title: "Notifications",
        href: "/dashboard/notifications",
        adminOnly: true,
        keywords: ["discord", "alerts", "notify", "daily report", "digest"],
      },
      {
        title: "Ads",
        href: "/dashboard/ads",
        adminOnly: true,
        keywords: ["adsense", "google ads", "advertisement", "monetize", "ad slot", "publisher"],
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
  "/dashboard/insights": BarChart3,
  "/dashboard/reports": Flag,
  "/dashboard/payment-methods": Banknote,
  "/dashboard/images-gallery": ImageIcon,
  "/dashboard/subscriptions": CreditCard,
  "/dashboard/my-subscription": Wallet,
  "/dashboard/purchase-package": Package2,
  "/dashboard/users": Users,
  "/dashboard/appearance": Palette,
  "/dashboard/cement-order": ShoppingBag,
  "/dashboard/shop-products": Tags,
  "/dashboard/shop-settings": Store,
  "/dashboard/settings": Settings,
  "/dashboard/ads": Megaphone,
  "/dashboard/notifications": BellRing,
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
  insights: "Insights",
  reports: "Reports",
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
  "cement-order": "Orders",
  "shop-products": "Rates Board",
  "shop-settings": "Shop Settings",
  "bricks-rate": "Bricks Rates",
  "sand-rate": "Sand Rates",
  "bajri-rate": "Bajri Rates",
  "steel-rate": "Steel Rates",
  "wood-rate": "Wood Rates",
  "door-rate": "Door Rates",
  "tile-rate": "Tile Rates",
  "material-rate": "Material Rates",
  materials: "Materials",
  "tile-category": "Tile Categories",
  packages: "Packages",
  subscriptions: "Subscriptions",
  "payment-methods": "Payment Methods",
  "my-subscription": "My Subscription",
  "purchase-package": "Purchase Package",
  users: "Users",
  appearance: "Appearance",
  settings: "General Settings",
  account: "My Account",
  add: "Add",
  edit: "Edit",
};

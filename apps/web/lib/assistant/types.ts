/**
 * What the assistant can show besides text — shared by the server (tools,
 * routes) and the chat window. Each kind is drawn as its own visual card.
 */

export type ListingCard = {
  id: string;
  title: string;
  url: string;
  priceText: string;
  size: string;
  beds: number;
  baths: number;
  place: string;
  photo: string | null;
  verified: boolean;
  featured: boolean;
  purpose: string;
};

export type SearchPrefill = {
  purpose?: "sale" | "rent";
  city?: string;
  location?: string;
  placeId?: string;
  type?: string;
  marla?: number;
  maxPrice?: number;
  beds?: number;
};

export type ConstructionPrefill = { marla?: number; floors?: number; city?: string };

/** Every card keeps the lookup behind it (`q`), so follow-up suggestions can name the exact place, size and item. */
export type Visual = { q?: Record<string, any> } & (
  | { kind: "listings"; total: number; items: ListingCard[]; moreUrl?: string; moreExact?: boolean; label?: string; priceRange?: { min: string; max: string } | null }
  | {
      kind: "rates";
      focus?: string;
      rows: { material: string; unit: string; rate: string; url: string }[];
      brands: { brand: string; product: string; price: string; unit: string; city: string; url: string }[];
    }
  | {
      kind: "construction";
      city: string;
      plot: string;
      floors: string;
      covered: string;
      perSqft: string;
      months: number;
      selected: string;
      options: { key: string; label: string; total: string }[];
      stages: { stage: string; cost: string; amount: number }[];
      link: string;
      input: { marla: number; floors: number; city: string };
    }
  | {
      kind: "market";
      place: string;
      url?: string;
      market: {
        purpose: "sale" | "rent";
        listings: number;
        median?: string;
        typicalRange?: string;
        cheapest?: string;
        highest?: string;
        perMarla?: string | null;
        bySize?: { size: string; listings: number; median: string }[];
      }[];
    }
  | {
      kind: "agents";
      city: string;
      total: number;
      items: { name: string; url: string; avatar: string; verified: boolean; listings: number; years: number; isAgency: boolean; agency: string; plan: string }[];
      moreUrl: string;
    }
  | {
      kind: "society";
      name: string;
      city: string;
      image?: string;
      tagline?: string;
      overview?: string;
      facts: { k: string; v: string }[];
      amenities: string[];
      listings: number;
      links: { page?: string; map?: string; listings: string };
    }
  | { kind: "guides"; items: { title: string; url: string; excerpt: string; image: string }[] }
  | { kind: "form"; form: "search"; prefill?: SearchPrefill }
  | { kind: "form"; form: "construction"; prefill?: ConstructionPrefill }
  | { kind: "form"; form: "market"; prefill?: { city?: string; location?: string } }
  | { kind: "form"; form: "society"; prefill?: { city?: string; location?: string } }
);

/** A request the chat window can run directly, with no model involved. */
export type QuickRequest = { tool: "search_listings" | "market_prices" | "material_rates" | "construction_cost" | "find_agents" | "society_info"; args: Record<string, unknown> };

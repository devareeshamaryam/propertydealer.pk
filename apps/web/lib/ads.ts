/*
 * Google AdSense — where ads may go, and which settings switch each on.
 * The publisher id, the ad unit and every placement are set in the
 * dashboard (Settings → Ads); nothing here is tied to one account.
 */

export const AD_PLACEMENTS = [
  { key: 'HomeTop', page: 'Homepage', label: 'Below the search', hint: 'Under the city shortcuts', on: false },
  { key: 'HomeMiddle', page: 'Homepage', label: 'After the latest listings', hint: 'Between the listings and the agencies', on: true },
  { key: 'HomeBottom', page: 'Homepage', label: 'Above the footer', hint: 'After the blog and FAQs', on: false },
  { key: 'ArchiveTop', page: 'Results pages', label: 'Above the results', hint: 'City, area, society and type pages', on: false },
  { key: 'ArchiveFeed', page: 'Results pages', label: 'Inside the results', hint: 'Between listings — every few listings (set below)', on: true },
  { key: 'ArchiveSidebar', page: 'Results pages', label: 'Sidebar', hint: 'Beside the results, on a desktop', on: true },
  { key: 'ArchiveBottom', page: 'Results pages', label: 'Below the results', hint: 'After the last listing', on: false },
  { key: 'ListingTop', page: 'Listing page', label: 'Below the photos', hint: 'Under the title and quick facts', on: false },
  { key: 'ListingContent', page: 'Listing page', label: 'After the description', hint: 'Between the description and the features', on: true },
  { key: 'ListingSidebar', page: 'Listing page', label: 'Sidebar', hint: 'Under the contact box, on a desktop', on: true },
  { key: 'ListingBottom', page: 'Listing page', label: 'Above similar listings', hint: 'At the end of the listing', on: false },
  { key: 'SocietyContent', page: 'Society guide', label: 'After the prices', hint: 'In the society guide pages', on: true },
  { key: 'BlogContent', page: 'Blog post', label: 'After the article', hint: 'At the end of each post', on: true },
] as const;

export type AdPlacement = (typeof AD_PLACEMENTS)[number]['key'];

/** The settings an ad placement reads. */
export type AdSettings = {
  adsEnabled: boolean;
  adsClient: string;
  adsSlot: string;
  adsArchiveEvery: number;
  /** JSON list of AdItem: where each ad sits. Empty: the on/off placements. */
  adsLayout: string;
} & { [K in AdPlacement as `ads${K}`]: boolean } & { [K in AdPlacement as `ads${K}Slot`]: string };

export const DEFAULT_AD_SETTINGS: AdSettings = {
  adsEnabled: false,
  adsClient: '',
  adsSlot: '',
  adsArchiveEvery: 6,
  adsLayout: '',
  ...(Object.fromEntries(AD_PLACEMENTS.flatMap((p) => [[`ads${p.key}`, p.on], [`ads${p.key}Slot`, '']])) as Omit<
    AdSettings,
    'adsEnabled' | 'adsClient' | 'adsSlot' | 'adsArchiveEvery' | 'adsLayout'
  >),
};

/** The ad unit for a placement, or null when it should not show. */
export function adUnit(s: Partial<AdSettings>, placement: AdPlacement): { client: string; slot: string } | null {
  if (!s.adsEnabled || !s.adsClient) return null;
  if (!s[`ads${placement}` as const]) return null;
  const slot = (s[`ads${placement}Slot` as const] as string) || s.adsSlot || '';
  return slot ? { client: s.adsClient, slot } : null;
}

/** ads.txt's line for a publisher id: "google.com, pub-…, DIRECT, f08c47fec0942fa0". */
export function adsTxtLine(client: string): string {
  const pub = client.replace(/^ca-/, '');
  return `google.com, ${pub}, DIRECT, f08c47fec0942fa0`;
}

/* ───────────── Ad layout: the real sections of each page ───────────── */

export type AdPage = 'home' | 'archive' | 'listing' | 'society' | 'blog';
export type AdSize = 'auto' | 'banner' | 'box';

/** One ad: on which page, in which gap, with which ad unit and shape. */
export interface AdItem {
  id: string;
  page: AdPage;
  at: string;
  slot?: string;
  size?: AdSize;
}

export type LayoutPart =
  | { type: 'section'; key: string; label: string; hint?: string; show?: string; tall?: boolean }
  | { type: 'zone'; at: string; label: string; feed?: boolean };

export interface PageLayout {
  key: AdPage;
  label: string;
  main: LayoutPart[];
  side?: LayoutPart[];
  below?: LayoutPart[];
}

const sec = (key: string, label: string, extra: { hint?: string; show?: string; tall?: boolean } = {}): LayoutPart => ({ type: 'section', key, label, ...extra });
const gap = (at: string, label: string, feed = false): LayoutPart => ({ type: 'zone', at, label, ...(feed ? { feed } : {}) });

/**
 * Every page that can carry ads, drawn as it really is: its sections in
 * order, with a gap between each where an ad can go. `show` names the
 * homepage switch that hides a section (an ad beside a hidden section still
 * shows, in that same place).
 */
export const AD_PAGES: PageLayout[] = [
  {
    key: 'home',
    label: 'Homepage',
    main: [
      sec('hero', 'Search & hero', { tall: true }),
      gap('after:hero', 'Under the search'),
      sec('cities', 'City shortcuts', { show: 'homeShowCities' }),
      gap('after:cities', 'After the cities'),
      sec('latest', 'Latest listings', { show: 'homeShowLatest', tall: true }),
      gap('after:latest', 'After the listings'),
      sec('agencies', 'Verified agencies', { show: 'homeShowAgencies' }),
      gap('after:agencies', 'After the agencies'),
      sec('agentBand', 'Agent sign-up band', { show: 'homeShowAgentBand' }),
      gap('after:agentBand', 'After the sign-up band'),
      sec('plans', 'Packages', { show: 'homeShowPlans' }),
      gap('after:plans', 'After the packages'),
      sec('rates', 'Construction rates', { show: 'homeShowRates' }),
      gap('after:rates', 'After the rates'),
      sec('explore', 'Explore tools', { show: 'homeShowExplore' }),
      gap('after:explore', 'After explore'),
      sec('blog', 'Blog', { show: 'homeShowBlog' }),
      gap('after:blog', 'After the blog'),
      sec('faq', 'FAQs', { show: 'homeShowFaq' }),
      gap('after:faq', 'Above the footer'),
    ],
  },
  {
    key: 'archive',
    label: 'Results pages',
    main: [
      sec('header', 'Title, search & filters'),
      gap('top', 'Above the results'),
      sec('results', 'Listings', { tall: true, hint: 'City, area, society and type pages' }),
      gap('feed', 'Inside the listings', true),
      gap('bottom', 'Below the results'),
    ],
    side: [sec('side', 'Sidebar'), gap('sidebar', 'In the sidebar (desktop)')],
    below: [
      sec('extras', 'Societies, agencies & map'),
      gap('after:extras', 'After societies & agencies'),
      sec('text', 'Page text'),
      gap('end', 'At the very end'),
    ],
  },
  {
    key: 'listing',
    label: 'Listing page',
    main: [
      sec('photos', 'Photos', { tall: true }),
      sec('summary', 'Title, price & quick facts'),
      gap('after:summary', 'Under the quick facts'),
      sec('overview', 'Overview'),
      gap('after:overview', 'After the overview'),
      sec('description', 'Description'),
      gap('after:description', 'After the description'),
      sec('features', 'Features'),
      gap('after:features', 'After the features'),
      sec('location', 'Location map'),
      gap('after:location', 'After the map'),
    ],
    side: [sec('contact', 'Contact box'), gap('sidebar', 'Under the contact box (desktop)')],
    below: [gap('before:similar', 'Above similar listings'), sec('similar', 'Similar listings')],
  },
  {
    key: 'society',
    label: 'Society guide',
    main: [
      sec('overview', 'Society overview'),
      sec('prices', 'Prices by size'),
      gap('after:prices', 'After the prices'),
      sec('more', 'Map, phases & listings', { tall: true }),
    ],
  },
  {
    key: 'blog',
    label: 'Blog post',
    main: [sec('article', 'Article', { tall: true }), gap('after:article', 'After the article'), sec('related', 'More posts')],
  },
];

/** The on/off placements of before, as layout items — so nothing moves until a layout is saved. */
const LEGACY: Record<AdPlacement, { page: AdPage; at: string; size: AdSize }> = {
  HomeTop: { page: 'home', at: 'after:cities', size: 'banner' },
  HomeMiddle: { page: 'home', at: 'after:latest', size: 'auto' },
  HomeBottom: { page: 'home', at: 'after:faq', size: 'banner' },
  ArchiveTop: { page: 'archive', at: 'top', size: 'banner' },
  ArchiveFeed: { page: 'archive', at: 'feed', size: 'auto' },
  ArchiveSidebar: { page: 'archive', at: 'sidebar', size: 'box' },
  ArchiveBottom: { page: 'archive', at: 'bottom', size: 'banner' },
  ListingTop: { page: 'listing', at: 'after:summary', size: 'banner' },
  ListingContent: { page: 'listing', at: 'after:description', size: 'auto' },
  ListingSidebar: { page: 'listing', at: 'sidebar', size: 'box' },
  ListingBottom: { page: 'listing', at: 'before:similar', size: 'banner' },
  SocietyContent: { page: 'society', at: 'after:prices', size: 'auto' },
  BlogContent: { page: 'blog', at: 'after:article', size: 'auto' },
};

/** The ads, wherever they are. */
export function adLayout(s: Partial<AdSettings>): AdItem[] {
  if (s.adsLayout) {
    try {
      const list = JSON.parse(s.adsLayout) as AdItem[];
      if (Array.isArray(list)) return list.filter((a) => a && a.id && a.page && a.at);
    } catch {
      // Unreadable: fall back to the placements.
    }
  }
  return AD_PLACEMENTS.filter((p) => s[`ads${p.key}` as const]).map((p) => {
    const slot = s[`ads${p.key}Slot` as const] as string | undefined;
    return { id: p.key.toLowerCase(), ...LEGACY[p.key], ...(slot ? { slot } : {}) };
  });
}

export interface AdUnit {
  id: string;
  client: string;
  slot: string;
  size: AdSize;
}

/** The ads to show in one gap of one page — none when ads are off or not set up. */
export function adsAt(s: Partial<AdSettings>, page: AdPage, at: string, layout = adLayout(s)): AdUnit[] {
  if (!s.adsEnabled || !s.adsClient) return [];
  return layout
    .filter((a) => a.page === page && a.at === at)
    .map((a) => ({ id: a.id, client: s.adsClient!, slot: a.slot || s.adsSlot || '', size: a.size ?? 'auto' }))
    .filter((a) => a.slot);
}

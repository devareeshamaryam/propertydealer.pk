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
} & { [K in AdPlacement as `ads${K}`]: boolean } & { [K in AdPlacement as `ads${K}Slot`]: string };

export const DEFAULT_AD_SETTINGS: AdSettings = {
  adsEnabled: false,
  adsClient: '',
  adsSlot: '',
  adsArchiveEvery: 6,
  ...(Object.fromEntries(AD_PLACEMENTS.flatMap((p) => [[`ads${p.key}`, p.on], [`ads${p.key}Slot`, '']])) as Omit<
    AdSettings,
    'adsEnabled' | 'adsClient' | 'adsSlot' | 'adsArchiveEvery'
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

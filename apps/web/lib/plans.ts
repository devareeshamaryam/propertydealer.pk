/*
 * Agent plans — one shape for every place they appear: the homepage, the
 * /packages page, the dashboard's "Buy a Plan", and the admin's package form.
 * The numbers and switches are what the API enforces; `features` is the
 * admin's wording for the card.
 */

export interface Plan {
  _id: string;
  name: string;
  description?: string;
  price: number;
  duration: number;
  propertyLimit: number;
  featuredListings: number;
  photosPerProperty?: number;
  features: string[];
  isActive?: boolean;
  verifiedBadge?: boolean;
  teamMembers?: number;
  socialLinks?: boolean;
  brandedProfile?: boolean;
  autoPublish?: boolean;
  spotlight?: boolean;
  highlight?: boolean;
  /** A public profile page with a share link (older packages: on). */
  profilePage?: boolean;
}

/** "Rs 5,000 / month", "Free". */
export function planPrice(p: Pick<Plan, 'price' | 'duration'>): { amount: string; per: string } {
  if (!p.price) return { amount: 'Free', per: '' };
  const per = p.duration === 30 || p.duration === 31 ? 'month' : p.duration === 365 ? 'year' : `${p.duration} days`;
  return { amount: `Rs ${p.price.toLocaleString('en-PK')}`, per };
}

/** The switches a plan turns on, as short labels for badges and comparison rows. */
export const PERK_LABELS: { key: keyof Plan; label: string; hint: string }[] = [
  { key: 'verifiedBadge', label: 'Verified badge', hint: 'On your profile, every listing and every listing card' },
  { key: 'autoPublish', label: 'Instant publishing', hint: 'Listings go live without waiting for review' },
  { key: 'spotlight', label: 'Homepage spotlight', hint: 'In "Verified agencies" on the homepage and agents page' },
  { key: 'teamMembers', label: 'Agent accounts', hint: 'Your agents manage their own listings under your plan' },
  { key: 'brandedProfile', label: 'Branded profile', hint: 'Cover photo and logo on your profile' },
  { key: 'socialLinks', label: 'Social links', hint: 'Facebook, Instagram, YouTube, TikTok and website on your profile' },
];

/** "1 month", "1 year", "45 days" — the free plan's is per listing (renewed for free). */
export function planDuration(p: Pick<Plan, 'price' | 'duration'>): string {
  if (!p.price) return '1 month per listing';
  if (p.duration === 30 || p.duration === 31) return '1 month';
  if (p.duration === 365) return '1 year';
  return `${p.duration} days`;
}

export interface PlanBenefit {
  /** Stable id, for comparison rows and React keys. */
  key: string;
  on: boolean;
  label: string;
  hint: string;
}

const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * What a plan gives, worked out from its numbers and switches — the same
 * fields the API enforces — so a card can never promise what the plan does
 * not do. Every place that shows a plan uses this list.
 */
export function planBenefits(p: Plan): PlanBenefit[] {
  const team = p.teamMembers ?? 0;
  const featured = p.featuredListings ?? 0;
  return [
    { key: 'listings', on: true, label: n(p.propertyLimit, 'live listing', 'live listings'), hint: !p.price ? 'Live for a month at a time — renew for free' : team > 0 ? 'Shared by you and your agents' : 'Live at the same time' },
    { key: 'photos', on: true, label: `Up to ${p.photosPerProperty || 20} photos per listing`, hint: 'Plus a walkthrough video' },
    { key: 'featured', on: featured > 0, label: featured > 0 ? n(featured, 'featured listing', 'featured listings') : 'Featured listings', hint: 'Shown first in search, with a Featured tag' },
    { key: 'verified', on: !!p.verifiedBadge, label: 'Verified badge', hint: 'On your profile, listings and listing cards' },
    { key: 'instant', on: !!p.autoPublish, label: 'Instant publishing', hint: 'Listings go live without waiting for review' },
    { key: 'spotlight', on: !!p.spotlight, label: 'Homepage spotlight', hint: 'In "Verified agencies" on the homepage and agents page' },
    { key: 'team', on: team > 0, label: team > 0 ? n(team, 'agent account', 'agent accounts') : 'Agent accounts', hint: 'Your agents list under your agency' },
    { key: 'profile', on: p.profilePage !== false, label: 'Profile page with share link', hint: 'All your listings on one page, linked from each listing' },
    { key: 'branded', on: !!p.brandedProfile, label: 'Cover photo on your profile', hint: 'A banner across the top of your agent page' },
    { key: 'social', on: !!p.socialLinks, label: 'Social links on your profile', hint: 'Facebook, Instagram, YouTube, TikTok, website' },
  ];
}

/** What every plan has, Free included — shown once instead of on every card. */
export function sharedBenefits(): string[] {
  return [
    'A walkthrough video on every listing',
    'Call and WhatsApp buttons on every listing',
    'Your listings on the property map',
    'Views and enquiry stats',
  ];
}

export function perksOf(p: Plan): string[] {
  return PERK_LABELS.filter(({ key }) => (key === 'teamMembers' ? (p.teamMembers ?? 0) > 0 : Boolean(p[key]))).map(({ key, label }) =>
    key === 'teamMembers' ? `${p.teamMembers} ${label.toLowerCase()}` : label,
  );
}

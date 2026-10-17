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

export function perksOf(p: Plan): string[] {
  return PERK_LABELS.filter(({ key }) => (key === 'teamMembers' ? (p.teamMembers ?? 0) > 0 : Boolean(p[key]))).map(({ key, label }) =>
    key === 'teamMembers' ? `${p.teamMembers} ${label.toLowerCase()}` : label,
  );
}

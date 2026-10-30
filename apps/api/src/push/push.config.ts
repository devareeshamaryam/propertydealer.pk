/**
 * Push notification settings, templates and time rules.
 *
 * Every word a person sees is editable in Dashboard → Push notifications;
 * these are only the starting values. Templates use {placeholders} —
 * {site} is always available, the rest are listed with each notification.
 */

/** Groups a person can switch off in Dashboard → Notifications. */
export const PUSH_CATEGORIES: Record<string, { label: string; hint: string; adminOnly?: boolean }> = {
  listings: { label: 'My listings', hint: 'Approved, needs changes, expiring, expired, views' },
  reviews: { label: 'Reviews', hint: 'New reviews of you, and replies to reviews you wrote' },
  plan: { label: 'Plan & payments', hint: 'Payment approved, plan ending or ended' },
  alerts: { label: 'New listings for you', hint: 'New properties in the areas you look at, and price drops on ones you viewed' },
  promotions: { label: 'News & offers', hint: 'Announcements and offers from the site' },
  admin: { label: 'Admin alerts', hint: 'Listings, payments, reviews and reports waiting for you', adminOnly: true },
};

export interface AutoDef {
  category: keyof typeof PUSH_CATEGORIES;
  label: string;
  /** Who receives it — shown in the admin list. */
  to: string;
  /** "Send straight away": skips quiet hours and the daily limit (things people are waiting on). */
  immediate: boolean;
  vars: string[];
  title: string;
  body: string;
}

export const AUTO_TYPES: Record<string, AutoDef> = {
  listing_live: {
    category: 'listings', label: 'Listing approved', to: 'Agents', immediate: true,
    vars: ['listing'], title: 'Your listing is live', body: '{listing} is now on {site} for buyers to see.',
  },
  listing_rejected: {
    category: 'listings', label: 'Listing needs changes', to: 'Agents', immediate: true,
    vars: ['listing'], title: 'Your listing needs changes', body: "{listing} wasn't approved. Open it to see what to fix.",
  },
  listing_expiring: {
    category: 'listings', label: 'Listing expiring soon', to: 'Agents (Free plan)', immediate: false,
    vars: ['listing', 'when'], title: 'Your listing ends {when}', body: 'Renew {listing} for free in one tap to keep it live.',
  },
  listing_expired: {
    category: 'listings', label: 'Listing expired', to: 'Agents (Free plan)', immediate: false,
    vars: ['listing'], title: 'Your listing has expired', body: '{listing} is no longer shown to buyers. Renew it for free from My Listings.',
  },
  views_milestone: {
    category: 'listings', label: 'Views milestone', to: 'Agents', immediate: false,
    vars: ['count', 'listing'], title: '{count} people viewed your listing', body: '{listing} is getting attention — keep your phone close.',
  },
  review_received: {
    category: 'reviews', label: 'New review', to: 'Agents', immediate: true,
    vars: ['rating', 'reviewer', 'review'], title: 'New {rating}★ review', body: '{reviewer}: {review}',
  },
  review_reply: {
    category: 'reviews', label: 'Agent replied to your review', to: 'Reviewers', immediate: true,
    vars: ['agent', 'reply'], title: '{agent} replied to your review', body: '{reply}',
  },
  review_approved: {
    category: 'reviews', label: 'Your review is live', to: 'Reviewers', immediate: true,
    vars: ['agent'], title: 'Your review is live', body: 'Your review of {agent} is now on their profile.',
  },
  plan_active: {
    category: 'plan', label: 'Payment approved — plan active', to: 'Agents', immediate: true,
    vars: ['plan', 'until'], title: 'Your {plan} plan is active', body: 'Payment approved. Your plan runs until {until}.',
  },
  payment_rejected: {
    category: 'plan', label: 'Payment not approved', to: 'Agents', immediate: true,
    vars: ['plan', 'reason'], title: 'Payment needs attention', body: "We couldn't approve your {plan} payment. {reason}",
  },
  plan_expiring: {
    category: 'plan', label: 'Plan ending soon', to: 'Agents', immediate: false,
    vars: ['plan', 'when'], title: 'Your {plan} plan ends {when}', body: 'Renew to keep your listings live and featured.',
  },
  plan_expired: {
    category: 'plan', label: 'Plan ended', to: 'Agents', immediate: false,
    vars: ['plan'], title: 'Your {plan} plan has ended', body: 'You are on the Free plan now. Renew to get your listings and benefits back.',
  },
  new_in_area: {
    category: 'alerts', label: 'New listings in your area (daily)', to: 'Buyers & visitors who browsed an area', immediate: false,
    vars: ['count', 'what', 'area'], title: '{count} new {what} in {area}', body: 'Just listed on {site} — have a look before others do.',
  },
  price_drop: {
    category: 'alerts', label: 'Price drop on a listing you viewed', to: 'Everyone who viewed it', immediate: false,
    vars: ['listing', 'price', 'oldPrice'], title: 'Price drop: {listing}', body: 'Now {price} (was {oldPrice}). Have a look before it goes.',
  },
  admin_listing: {
    category: 'admin', label: 'Listing waiting for approval', to: 'Admins', immediate: true,
    vars: ['listing', 'by'], title: 'Listing waiting for approval', body: '{listing} — by {by}',
  },
  admin_payment: {
    category: 'admin', label: 'Payment to verify', to: 'Admins', immediate: true,
    vars: ['plan', 'by', 'amount'], title: 'Payment to verify: {plan}', body: '{by} paid {amount} — tap to check the screenshot.',
  },
  admin_review: {
    category: 'admin', label: 'Review waiting for approval', to: 'Admins', immediate: true,
    vars: ['agent', 'reason'], title: 'Review waiting for approval', body: 'About {agent} — {reason}',
  },
  admin_report: {
    category: 'admin', label: 'New report', to: 'Admins', immediate: true,
    vars: ['reason', 'what'], title: 'New report: {reason}', body: '{what}',
  },
  welcome: {
    category: 'promotions', label: 'Welcome (right after allowing)', to: 'New subscribers', immediate: true,
    vars: [], title: 'Notifications are on', body: "{site} will tell you about new properties and what's happening with your listings.",
  },
};

export type PromptContext = 'post' | 'contact' | 'review' | 'browse';
export interface PromptCopy { title: string; body: string }

export interface PushConfig {
  enabled: boolean;
  /** Notification icon; empty = the site's favicon, else the built-in house icon. */
  icon: string;
  /** Small white status-bar icon (Android); empty = the built-in one. */
  badge: string;
  timezone: string;
  prompt: {
    enabled: boolean;
    title: string;
    body: string;
    allow: string;
    later: string;
    delaySec: number;
    minPageViews: number;
    snoozeDays: number;
    /** Comma-separated path prefixes where the general ask never appears. */
    excludePaths: string;
    /** Wording when the ask follows an action. */
    contexts: Record<PromptContext, PromptCopy>;
  };
  quiet: { enabled: boolean; start: string; end: string };
  /** Max pushes per person per day, for notifications that aren't sent straight away. */
  dailyCap: number;
  milestones: string;
  priceDropMinPct: number;
  /** "New in your area": the hour it goes out (local time, 0–23). */
  alertHour: number;
  /** Days before a listing / plan ends to remind. */
  remindDays: number;
  auto: Record<string, { enabled: boolean; immediate: boolean; title: string; body: string }>;
}

export const DEFAULT_PUSH_CONFIG: PushConfig = {
  enabled: true,
  icon: '',
  badge: '',
  timezone: 'Asia/Karachi',
  prompt: {
    enabled: true,
    title: 'Get new properties first',
    body: "Turn on notifications and {site} will tell you about new listings in the areas you look at — and what's happening with your own.",
    allow: 'Allow',
    later: 'Not now',
    delaySec: 8,
    minPageViews: 2,
    snoozeDays: 7,
    excludePaths: '/dashboard,/login,/register,/signup,/forgot-password,/reset-password,/pending-activation',
    contexts: {
      post: { title: 'Know the moment your listing is live', body: 'Turn on notifications for approvals, expiry reminders and new reviews.' },
      contact: { title: 'Get similar properties first', body: "We'll tell you when new listings come up in this area, and if this one gets cheaper." },
      review: { title: 'Hear back from the agent', body: 'Turn on notifications to know when your review is live and when the agent replies.' },
      browse: { title: 'New in this area? Know first', body: "We'll send one short alert a day when new properties are listed here." },
    },
  },
  quiet: { enabled: true, start: '22:00', end: '08:00' },
  dailyCap: 4,
  milestones: '50,100,250,500,1000,2500',
  priceDropMinPct: 3,
  alertHour: 19,
  remindDays: 3,
  auto: Object.fromEntries(Object.entries(AUTO_TYPES).map(([k, d]) => [k, { enabled: true, immediate: d.immediate, title: d.title, body: d.body }])),
};

const num = (v: unknown, min: number, max: number, def: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : def;
};
const txt = (v: unknown, def: string, max = 300) => (typeof v === 'string' ? v.slice(0, max) : def);
const hhmm = (v: unknown, def: string) => (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : def);

/** Saved settings over the defaults, cleaned (new notification types get their defaults). */
export function mergePushConfig(saved: any): PushConfig {
  const d = DEFAULT_PUSH_CONFIG;
  const s = saved && typeof saved === 'object' ? saved : {};
  const p = s.prompt || {};
  const auto: PushConfig['auto'] = {};
  for (const k of Object.keys(AUTO_TYPES)) {
    const a = s.auto?.[k] || {};
    auto[k] = {
      enabled: a.enabled === undefined ? d.auto[k]!.enabled : !!a.enabled,
      immediate: a.immediate === undefined ? d.auto[k]!.immediate : !!a.immediate,
      title: txt(a.title, d.auto[k]!.title, 120) || d.auto[k]!.title,
      body: txt(a.body, d.auto[k]!.body, 300),
    };
  }
  const contexts = {} as PushConfig['prompt']['contexts'];
  for (const k of Object.keys(d.prompt.contexts) as PromptContext[]) {
    contexts[k] = { title: txt(p.contexts?.[k]?.title, d.prompt.contexts[k].title, 120), body: txt(p.contexts?.[k]?.body, d.prompt.contexts[k].body, 300) };
  }
  return {
    enabled: s.enabled === undefined ? d.enabled : !!s.enabled,
    icon: txt(s.icon, d.icon, 500),
    badge: txt(s.badge, d.badge, 500),
    timezone: txt(s.timezone, d.timezone, 60) || d.timezone,
    prompt: {
      enabled: p.enabled === undefined ? d.prompt.enabled : !!p.enabled,
      title: txt(p.title, d.prompt.title, 120),
      body: txt(p.body, d.prompt.body, 300),
      allow: txt(p.allow, d.prompt.allow, 30) || d.prompt.allow,
      later: txt(p.later, d.prompt.later, 30) || d.prompt.later,
      delaySec: num(p.delaySec, 0, 120, d.prompt.delaySec),
      minPageViews: num(p.minPageViews, 1, 20, d.prompt.minPageViews),
      snoozeDays: num(p.snoozeDays, 1, 90, d.prompt.snoozeDays),
      excludePaths: txt(p.excludePaths, d.prompt.excludePaths, 1000),
      contexts,
    },
    quiet: { enabled: s.quiet?.enabled === undefined ? d.quiet.enabled : !!s.quiet.enabled, start: hhmm(s.quiet?.start, d.quiet.start), end: hhmm(s.quiet?.end, d.quiet.end) },
    dailyCap: num(s.dailyCap, 1, 50, d.dailyCap),
    milestones: txt(s.milestones, d.milestones, 200),
    priceDropMinPct: num(s.priceDropMinPct, 1, 90, d.priceDropMinPct),
    alertHour: num(s.alertHour, 0, 23, d.alertHour),
    remindDays: num(s.remindDays, 1, 14, d.remindDays),
    auto,
  };
}

/** "{reviewer}: {review}" + vars → text. {site} is always filled in. */
export function renderTemplate(tpl: string, vars: Record<string, unknown>, siteName: string): string {
  return String(tpl || '')
    .replace(/\{(\w+)\}/g, (_, k: string) => (k === 'site' ? siteName : vars[k] == null ? '' : String(vars[k])))
    .replace(/\s+/g, ' ')
    .trim();
}

/* ── time (Pakistan time by default) ─────────────────────────────────────── */

const fmts = new Map<string, Intl.DateTimeFormat>();
function parts(tz: string, d: Date) {
  let f = fmts.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
    fmts.set(tz, f);
  }
  const o = Object.fromEntries(f.formatToParts(d).map((p) => [p.type, p.value]));
  return { day: `${o.year}-${o.month}-${o.day}`, minutes: (Number(o.hour) % 24) * 60 + Number(o.minute), hour: Number(o.hour) % 24 };
}

export function dayKey(tz: string, d = new Date()): string {
  try {
    return parts(tz, d).day;
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export function localHour(tz: string, d = new Date()): number {
  try {
    return parts(tz, d).hour;
  } catch {
    return d.getUTCHours();
  }
}

const toMin = (s: string) => {
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Inside quiet hours: when they end. Otherwise null. */
export function quietUntil(cfg: PushConfig, now = new Date()): Date | null {
  if (!cfg.quiet.enabled) return null;
  let minutes: number;
  try {
    minutes = parts(cfg.timezone, now).minutes;
  } catch {
    return null;
  }
  const start = toMin(cfg.quiet.start);
  const end = toMin(cfg.quiet.end);
  const inside = start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
  if (!inside) return null;
  return new Date(now.getTime() + ((end - minutes + 1440) % 1440) * 60_000);
}

/** Ready-made campaigns the admin starts from (and edits). */
export const CAMPAIGN_TEMPLATES: { id: string; name: string; title: string; body: string; url: string; who: string; hint: string }[] = [
  { id: 'new-listings', name: 'New properties this week', title: 'New properties in your city this week', body: 'Houses, plots and flats just listed on {site} — see them before anyone else.', url: '/properties', who: 'buyers', hint: 'For buyers and visitors' },
  { id: 'post-free', name: 'Post your property free', title: 'Selling or renting out? List it free', body: 'Post your property on {site} in two minutes — free, with photos and a video.', url: '/dashboard/property/add-property', who: 'all', hint: 'Gets owners and agents to post' },
  { id: 'plan-offer', name: 'Plan offer for agents', title: 'Get up to 3x more views on your listings', body: 'Feature your best listings and get the Verified badge. See the plans on {site}.', url: '/packages', who: 'free', hint: 'For agents on the Free plan' },
  { id: 'renew', name: 'Renew expired listings', title: 'Your buyers are still searching', body: 'Renew your expired listings for free and get back in front of them.', url: '/dashboard/property', who: 'agents', hint: 'For agents' },
  { id: 'rates', name: 'Construction rates updated', title: "Today's cement, steel and brick rates", body: 'Building? Check the latest material rates on {site}.', url: '/', who: 'all', hint: 'Daily rates pages' },
  { id: 'society', name: 'Society map launched', title: 'New: society maps with every plot', body: 'Find any plot on the map and see the listings around it.', url: '/societies', who: 'all', hint: 'Announce a new feature' },
  { id: 'reviews', name: 'Ask for reviews', title: 'Dealt with an agent? Tell others', body: 'Your review helps the next buyer pick an honest dealer.', url: '/property-dealers', who: 'users', hint: 'For signed-in people' },
];

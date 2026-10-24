import { agentProfilePath, agentSlugPart } from '@/lib/agent';

/*
 * The property dealers directory: /property-dealers (every city) and
 * /property-dealers-in-<city> (one city's agencies and agents, ranked by plan).
 * The city page lives at app/(pages)/property-dealers/[city] and is reached
 * through a rewrite in next.config; /property-dealers/<city> redirects to it.
 */

export interface DealerCard {
  _id: string;
  name: string;
  companyName?: string;
  person: string;
  avatarUrl: string;
  coverUrl: string;
  address: string;
  phone: string;
  whatsapp: string;
  experienceYears: number;
  listings: number;
  verified: boolean;
  isAgency: boolean;
  plan: string;
  rank: number;
  agency: { _id: string; name: string } | null;
  agents: number;
  since: string;
}

export interface DealerPageText {
  metaTitle?: string;
  metaDescription?: string;
  heading?: string;
  intro?: string;
  content?: string;
  faqs?: { q: string; a: string }[];
  noindex?: boolean;
}

export interface DealerSettings {
  hub: DealerPageText;
  cityDefaults: DealerPageText;
}

export interface DealerCity {
  _id: string;
  name: string;
  slug: string;
  thumbnail: string;
  agencies: number;
  agents: number;
}

export interface DealerCityData {
  city: { _id: string; name: string; slug: string; thumbnail: string };
  page: DealerPageText;
  defaults: DealerPageText;
  agencies: DealerCard[];
  agents: DealerCard[];
  total: { agencies: number; agents: number };
  /** With a search (?q=): how many of each match. */
  found?: { agencies: number; agents: number };
  pageInfo: { page: number; pages: number; limit: number };
}

export const DEALERS_HUB = '/property-dealers';

/** A city has a page only once it has at least one agency or agent. */
export const hasDealers = (c: { agencies: number; agents: number }) => c.agencies + c.agents > 0;
export const dealersCityPath = (slug: string) => `/property-dealers-in-${slug}`;

/** The profile address: an agency's agent sits under the agency (/agents/<agency>/<agent>). */
export function dealerHref(d: Pick<DealerCard, '_id' | 'name' | 'companyName' | 'agency'>): string {
  if (d.agency) {
    const base = agentProfilePath({ _id: d.agency._id, companyName: d.agency.name });
    if (base) return `${base}/${agentSlugPart({ _id: d._id, name: d.name, companyName: d.companyName })}`;
  }
  return agentProfilePath({ _id: d._id, name: d.name, companyName: d.companyName }) ?? '/agents';
}

/** "{city}" and "{count}" in the admin's default text. */
export function fill(template: string | undefined, vars: { city: string; count: number }): string {
  return String(template ?? '')
    .replace(/\{city\}/gi, vars.city)
    .replace(/\{count\}/gi, String(vars.count));
}

/** Text for a city page: the city's own, else the admin's defaults, else ours. */
export function cityText(d: DealerCityData) {
  const count = d.total.agencies + d.total.agents;
  const v = { city: d.city.name, count };
  const pick = (own: string | undefined, def: string | undefined, ours: string) => (own?.trim() ? own : def?.trim() ? fill(def, v) : ours);
  return {
    title: pick(
      d.page.metaTitle,
      d.defaults.metaTitle,
      count > 1 ? `${count} Property Dealers in ${d.city.name} — Real Estate Agents & Agencies` : `Property Dealers in ${d.city.name} — Real Estate Agents & Agencies`,
    ),
    description: pick(
      d.page.metaDescription,
      d.defaults.metaDescription,
      `Find trusted property dealers, real estate agents and verified agencies in ${d.city.name}. See their listings for sale and rent, and call or WhatsApp them directly.`,
    ),
    heading: pick(d.page.heading, d.defaults.heading, `Property Dealers in ${d.city.name}`),
    intro: pick(
      d.page.intro,
      d.defaults.intro,
      `Verified agencies and real estate agents working in ${d.city.name} — with their live listings, phone and WhatsApp. Agencies first, then agents.`,
    ),
    content: d.page.content?.trim() ? d.page.content : fill(d.defaults.content, v),
    faqs: d.page.faqs?.length ? d.page.faqs : (d.defaults.faqs ?? []).map((f) => ({ q: fill(f.q, v), a: fill(f.a, v) })),
    noindex: !!d.page.noindex,
  };
}

/** Digits for wa.me: 03xx… → 923xx… */
export function waNumber(raw: string): string {
  const d = String(raw ?? '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('92')) return d;
  if (d.startsWith('0')) return `92${d.slice(1)}`;
  return d;
}

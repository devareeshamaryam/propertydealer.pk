import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, MapPin, MessageCircle, Phone, Users } from "lucide-react";
import VerifiedBadge from "@/components/VerifiedBadge";
import ShareProfile from "@/components/agent/ShareProfile";
import SocialLinks from "@/components/agent/SocialLinks";
import { waDigits } from "@/lib/site-settings";

import AgentListings from "@/components/AgentListings";
import { ReportButton } from "@/components/property/ReportButton";
import { Button } from "@/components/ui/button";
import agentApi, { type AgentProfile } from "@/lib/api/agent/agent.api";
import { propertyApi } from "@/lib/api";
import { agentDisplayName, agentIdFromSlug, agentProfilePath, agentSlugPart } from "@/lib/agent";
import {
  mapBackendToFrontendProperty,
  type BackendProperty,
} from "@/lib/types/property-utils";
import { getSiteName } from "@/lib/site-settings.server";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://propertydealer.pk").replace(/\/$/, "");

/**
 * An agent's public page: who they are, how to reach them, and everything they
 * currently have listed.
 *
 * A listing used to be a dead end — a phone number and nothing else. Buyers
 * here shop by dealer as much as by house ("what else has this office got in
 * Bahria?"), which is why Zameen and Graana both put an agency page behind
 * every listing. The listing card links here, and this page links back.
 *
 * Laid out like a social profile: one card holding the photo, the name, the
 * numbers and the contact buttons, then everything else beneath it. A cover
 * photo shows only when the agent's plan includes a branded profile and they
 * have uploaded one — never an empty grey band. The Verified badge is for
 * plans that include it (Agency, Agency Plus), not for every active dealer.
 */

const LISTINGS_LIMIT = 24;

export interface AgentPageData {
  profile: AgentProfile;
  listings: BackendProperty[];
  total: number;
  /** True counts by purpose (not just of the first page). */
  saleTotal: number;
  rentTotal: number;
  /** True when the account itself could not be read and only listings remain. */
  profileMissing: boolean;
}

export async function getAgent(slug: string): Promise<AgentPageData | null> {
  const id = agentIdFromSlug(slug);
  if (!id) return null;

  /*
   * The profile and the listings are fetched together and judged together.
   *
   * Either one on its own is a page worth showing. A profile lookup that
   * fails used to 404 the whole route, which took out every agent whose user
   * row is missing or deactivated — including one account with 178 live
   * listings, all of them linking here from their own listing pages.
   */
  const [profileResult, listingsResult, saleResult, rentResult] = await Promise.allSettled([
    agentApi.getPublicProfile(id),
    propertyApi.getAll({ ownerId: id, limit: LISTINGS_LIMIT }),
    // One-row queries just for the totals.
    propertyApi.getAll({ ownerId: id, limit: 1, purpose: "buy" }),
    propertyApi.getAll({ ownerId: id, limit: 1, purpose: "rent" }),
  ]);
  // Both lookups failing for a reason other than "not found" means the API is
  // down: throw, so a cached profile is not replaced by a 404 or an empty page.
  const down = (r: PromiseSettledResult<any>) => r.status === 'rejected' && Number(r.reason?.response?.status ?? 0) !== 404;
  if (down(profileResult) && down(listingsResult)) throw (profileResult as PromiseRejectedResult).reason;

  const totalOf = (r: PromiseSettledResult<any>) =>
    r.status === "fulfilled" ? Number(r.value?.total ?? 0) || 0 : 0;

  const profile =
    profileResult.status === "fulfilled" ? profileResult.value : null;

  let listings: BackendProperty[] = [];
  let total = 0;
  if (listingsResult.status === "fulfilled") {
    const response = listingsResult.value;
    const rows = Array.isArray(response) ? response : (response?.properties ?? []);
    listings = rows as BackendProperty[];
    total = Array.isArray(response) ? rows.length : (response?.total ?? rows.length);
  }

  // Nothing to say about them and nothing to show: that is a genuine 404.
  if (!profile && listings.length === 0 && totalOf(saleResult) + totalOf(rentResult) === 0) return null;

  return {
    profile: profile ?? { _id: id },
    listings,
    total,
    saleTotal: totalOf(saleResult),
    rentTotal: totalOf(rentResult),
    profileMissing: !profile,
  };
}

/** Most common city among the agent's listings — what "property dealer in …" is about. */
export function agentCity(data: AgentPageData): string {
  const n = new Map<string, number>();
  for (const row of data.listings) {
    const c = mapBackendToFrontendProperty(row).city?.trim();
    if (c) n.set(c, (n.get(c) ?? 0) + 1);
  }
  let best = "";
  let max = 0;
  for (const [c, k] of n) if (k > max) [best, max] = [c, k];
  return best ? best.replace(/\b\w/g, (ch) => ch.toUpperCase()) : "";
}

/**
 * Written for the agent, not by them: "<Name> - Property Dealer in <City>",
 * which is what people search for a dealer by. An agency's agent carries the
 * agency's name. Not editable from the dashboard on purpose.
 */
export async function agentMetadata(data: AgentPageData | null, path: string): Promise<Metadata> {
  if (!data) return { title: "Agent not found", robots: { index: false, follow: true } };
  const site = await getSiteName();
  const name = agentDisplayName(data.profile);
  const city = agentCity(data);
  const agency = data.profile.agency?.name;
  const count = Math.max(data.total, data.saleTotal + data.rentTotal);
  const title = agency
    ? `${name} - Property Dealer at ${agency}${city ? `, ${city}` : ""}`
    : `${name} - Property Dealer${city ? ` in ${city}` : " in Pakistan"}`;
  const description =
    `${name} is a property dealer${agency ? ` with ${agency}` : ""}${city ? ` in ${city}` : ""}. ` +
    `${count} ${count === 1 ? "property" : "properties"} for sale and rent on ${site} — call or WhatsApp directly.`;
  const url = `${SITE_URL}${path}`;
  const image = data.profile.avatarUrl ? (data.profile.avatarUrl.startsWith("http") ? data.profile.avatarUrl : `${SITE_URL}${data.profile.avatarUrl}`) : undefined;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "profile", ...(image ? { images: [{ url: image }] } : {}) },
    twitter: { card: "summary", title, description },
    // A profile with nothing listed is a thin page; keep it out of the index until there is something on it.
    robots: count > 0 ? undefined : { index: false, follow: true },
  };
}

export function AgentProfileView({ data, path }: { data: AgentPageData; path: string }) {

  const { profile, listings, total, saleTotal, rentTotal, profileMissing } = data;
  const name = agentDisplayName(profile);
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "P";

  const phone = profile.phone?.trim();
  const whatsapp = (profile.whatsappNumber || profile.phone)?.trim();
  const memberSince = profile.createdAt
    ? new Date(profile.createdAt).getFullYear()
    : null;

  // Split rather than counted separately: two more API calls to print two
  // numbers that the page has already loaded the rows for.
  const forSale = listings.filter((item) => item.listingType === "sale");
  const forRent = listings.filter((item) => item.listingType === "rent");

  const stats = [
    { value: total, label: total === 1 ? "Listing" : "Listings" },
    { value: saleTotal || forSale.length, label: "For sale" },
    { value: rentTotal || forRent.length, label: "For rent" },
    ...(profile.experienceYears
      ? [{ value: profile.experienceYears, label: "Years active" }]
      : memberSince
        ? [{ value: memberSince, label: "Member since" }]
        : []),
  ];

  /*
   * A profile page, app-style: photo in a ring of the theme colour, the name
   * with a tick, one line of numbers, the two ways to get in touch, a short
   * about, then the listings. No icon tiles and no cards inside cards.
   */
  // RealEstateAgent, so search engines read the name, phone, place and agency.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    name,
    url: `${SITE_URL}${path}`,
    ...(profile.avatarUrl ? { image: profile.avatarUrl.startsWith("http") ? profile.avatarUrl : `${SITE_URL}${profile.avatarUrl}` } : {}),
    ...(phone ? { telephone: phone } : {}),
    ...(profile.address ? { address: profile.address } : {}),
    ...(agentCity(data) ? { areaServed: agentCity(data) } : {}),
    ...(profile.agency ? { parentOrganization: { "@type": "RealEstateAgent", name: profile.agency.name, url: `${SITE_URL}${agentProfilePath({ _id: profile.agency._id, companyName: profile.agency.name })}` } } : {}),
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <section className="border-b border-slate-200 bg-white">
        {profile.coverUrl && (
          <div className="relative h-36 w-full overflow-hidden bg-slate-200 sm:h-56">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={profile.coverUrl} alt="" className="h-full w-full object-cover" />
          </div>
        )}
        <div className={`container mx-auto px-4 pb-5 sm:pb-7 ${profile.coverUrl ? "-mt-12 sm:-mt-14" : "pt-6 sm:pt-8"}`}>
          <div className="flex flex-col items-center text-center sm:flex-row sm:items-center sm:gap-6 sm:text-left">
            <span className="rounded-full bg-primary p-[3px]">
              <span className="block rounded-full bg-white p-[3px]">
                <span className="grid h-24 w-24 place-items-center overflow-hidden rounded-full bg-primary/10 text-3xl font-bold text-primary sm:h-28 sm:w-28">
                  {profile.avatarUrl ? (
                    // Not next/image: agent photos come from the media library and
                    // from older uploads on paths the image config does not cover.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.avatarUrl} alt={name} className="h-full w-full object-cover" />
                  ) : (
                    initials
                  )}
                </span>
              </span>
            </span>

            <div className="mt-3 min-w-0 flex-1 sm:mt-0">
              <h1 className="inline-flex items-center gap-1.5 text-[24px] font-bold leading-tight tracking-tight text-slate-900 sm:text-[30px]">
                {name}
              </h1>
              {profile.verified && (
                <div className="mt-1">
                  <VerifiedBadge />
                </div>
              )}
              {profile.companyName && profile.name && (
                <p className="mt-0.5 text-[15px] text-slate-600">{profile.name}</p>
              )}
              {profile.agency && (
                <p className="mt-1 text-[14px] text-slate-600">
                  Agent at{" "}
                  <Link href={agentProfilePath({ _id: profile.agency._id, companyName: profile.agency.name }) ?? "#"} className="font-semibold text-primary hover:underline">
                    {profile.agency.name}
                  </Link>
                </p>
              )}
              {profile.address && (
                <p className="mt-1 inline-flex items-center gap-1.5 text-[14px] text-slate-600">
                  <MapPin className="h-4 w-4 shrink-0 text-primary" />
                  {profile.address}
                </p>
              )}
            </div>

            {(phone || whatsapp) && (
              <div className="mt-4 grid w-full grid-cols-2 gap-2 sm:mt-0 sm:w-auto sm:min-w-[260px] sm:self-end">
                {phone ? (
                  <a
                    href={`tel:${phone.replace(/\s/g, "")}`}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-primary text-[15px] font-semibold text-primary hover:bg-primary/5 btn-shape"
                  >
                    <Phone className="h-4 w-4" /> Call
                  </a>
                ) : <span />}
                {whatsapp && (
                  <a
                    href={`https://wa.me/${waDigits(whatsapp)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#25D366] text-[15px] font-semibold text-white hover:bg-[#1ebe5b] btn-shape"
                  >
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </a>
                )}
              </div>
            )}
          </div>

          {/* One line of numbers. */}
          <dl className="mt-5 grid grid-cols-4 divide-x divide-slate-200 rounded-2xl border border-slate-200 py-3 sm:mt-6 sm:max-w-xl">
            {stats.map(({ value, label }) => (
              <div key={label} className="px-1 text-center">
                <dt className="sr-only">{label}</dt>
                <dd className="text-[19px] font-bold leading-tight text-slate-900 sm:text-[21px]">{value}</dd>
                <dd className="text-[11.5px] text-slate-500 sm:text-[12.5px]">{label}</dd>
              </div>
            ))}
          </dl>

          {profile.bio && (
            <p className="mt-4 max-w-3xl whitespace-pre-line text-[15px] leading-relaxed text-slate-700">{profile.bio}</p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <ShareProfile name={name} />
            <SocialLinks links={profile.socialLinks} />
          </div>

          {(profile.team?.length ?? 0) > 0 && (
            <div className="mt-6">
              <h2 className="flex items-center gap-2 text-[16px] font-bold text-slate-900">
                <Users className="h-4 w-4 text-primary" /> Our agents
              </h2>
              <div className="hide-scrollbar mt-3 flex gap-3 overflow-x-auto pb-1">
                {profile.team!.map((m) => (
                  <Link
                    key={m._id}
                    href={`${path}/${agentSlugPart({ _id: m._id, name: m.name })}`}
                    className="flex w-24 shrink-0 flex-col items-center text-center"
                  >
                    <span className="grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-primary/10 text-lg font-bold text-primary ring-2 ring-white">
                      {m.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.avatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        m.name.slice(0, 1).toUpperCase()
                      )}
                    </span>
                    <span className="mt-1.5 inline-flex items-center gap-0.5 text-[12.5px] font-medium text-slate-800">
                      <span className="line-clamp-2">{m.name}</span>
                      {profile.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-sky-500" aria-label="Verified" />}
                    </span>
                    {typeof m.listings === "number" && (
                      <span className="text-[11.5px] text-slate-500">{m.listings} {m.listings === 1 ? "listing" : "listings"}</span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="container mx-auto px-4 pt-5">
        {/* The counts say there are listings even when the first page failed to load: the list fetches it then. */}
        {listings.length === 0 && saleTotal + rentTotal === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center">
            <p className="text-slate-600">
              {profileMissing
                ? "Nothing is listed under this profile right now."
                : "This agent has no active listings right now."}
            </p>
            <Button variant="outline" asChild className="mt-4">
              <Link href="/properties">Browse all properties</Link>
            </Button>
          </div>
        ) : (
          <AgentListings
            agentId={profile._id}
            initial={listings.map((row) => ({ ...mapBackendToFrontendProperty(row), description: undefined }))}
            totals={{ all: Math.max(total, saleTotal + rentTotal), sale: saleTotal || forSale.length, rent: rentTotal || forRent.length }}
          />
        )}

        {/* A dealer's record is the thing buyers most need to flag. */}
        <div className="mt-8 flex justify-center">
          <ReportButton type="agent" agentId={profile._id} label="Report this agent" />
        </div>
      </div>
    </div>
  );
}

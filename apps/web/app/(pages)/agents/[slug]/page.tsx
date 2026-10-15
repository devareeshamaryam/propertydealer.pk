import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, MapPin, MessageCircle, Phone } from "lucide-react";
import { waDigits } from "@/lib/site-settings";

import AgentListings from "@/components/AgentListings";
import { ReportButton } from "@/components/property/ReportButton";
import { Button } from "@/components/ui/button";
import agentApi, { type AgentProfile } from "@/lib/api/agent/agent.api";
import { propertyApi } from "@/lib/api";
import { agentDisplayName, agentIdFromSlug } from "@/lib/agent";
import {
  mapBackendToFrontendProperty,
  type BackendProperty,
} from "@/lib/types/property-utils";

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
 * numbers and the two contact buttons, then everything else beneath it. There
 * is deliberately no cover image — agents do not have one to upload, and an
 * empty grey band at the top of every profile looks broken rather than
 * unfinished. The slim tinted strip behind the avatar does the same job of
 * separating the header from the page without asking anyone for a photo.
 */

const LISTINGS_LIMIT = 24;

interface PageProps {
  params: Promise<{ slug: string }>;
}

interface AgentPageData {
  profile: AgentProfile;
  listings: BackendProperty[];
  total: number;
  /** True counts by purpose (not just of the first page). */
  saleTotal: number;
  rentTotal: number;
  /** True when the account itself could not be read and only listings remain. */
  profileMissing: boolean;
}

async function getAgent(slug: string): Promise<AgentPageData | null> {
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
  if (!profile && listings.length === 0) return null;

  return {
    profile: profile ?? { _id: id },
    listings,
    total,
    saleTotal: totalOf(saleResult),
    rentTotal: totalOf(rentResult),
    profileMissing: !profile,
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getAgent(slug);

  if (!data) return { title: "Agent not found" };

  const name = agentDisplayName(data.profile);
  const count = data.total;

  return {
    title: `${name} — Properties for Sale & Rent in Pakistan`,
    description:
      data.profile.bio?.replace(/<[^>]*>/g, "").slice(0, 160) ||
      `${name} has ${count} ${count === 1 ? "property" : "properties"} listed on PropertyDealer. See their listings and contact them directly.`,
    // A profile with nothing listed is a thin page; keep it out of the index
    // until there is something on it worth finding.
    robots: count > 0 ? undefined : { index: false, follow: true },
  };
}

export default async function AgentProfilePage({ params }: PageProps) {
  const { slug } = await params;
  const data = await getAgent(slug);

  if (!data) notFound();

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
  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <section className="border-b border-slate-200 bg-white">
        <div className="container mx-auto px-4 pb-5 pt-6 sm:pb-7 sm:pt-8">
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
                {total > 0 && (
                  <BadgeCheck className="h-6 w-6 shrink-0 fill-primary text-white" aria-label="Active dealer" />
                )}
              </h1>
              {profile.companyName && profile.name && (
                <p className="mt-0.5 text-[15px] text-slate-600">{profile.name}</p>
              )}
              {profile.address && (
                <p className="mt-1 inline-flex items-center gap-1.5 text-[14px] text-slate-600">
                  <MapPin className="h-4 w-4 shrink-0 text-primary" />
                  {profile.address}
                </p>
              )}
            </div>

            {(phone || whatsapp) && (
              <div className="mt-4 grid w-full grid-cols-2 gap-2 sm:mt-0 sm:w-auto sm:min-w-[260px]">
                {phone ? (
                  <a
                    href={`tel:${phone.replace(/\s/g, "")}`}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-primary text-[15px] font-semibold text-primary hover:bg-primary/5"
                  >
                    <Phone className="h-4 w-4" /> Call
                  </a>
                ) : <span />}
                {whatsapp && (
                  <a
                    href={`https://wa.me/${waDigits(whatsapp)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#25D366] text-[15px] font-semibold text-white hover:bg-[#1ebe5b]"
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
        </div>
      </section>

      <div className="container mx-auto px-4 pt-5">
        {listings.length === 0 ? (
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
            totals={{ all: total, sale: saleTotal || forSale.length, rent: rentTotal || forRent.length }}
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

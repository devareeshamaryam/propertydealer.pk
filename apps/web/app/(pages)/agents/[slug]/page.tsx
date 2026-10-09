import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BadgeCheck,
  Briefcase,
  Building2,
  CalendarDays,
  Home,
  KeyRound,
  MapPin,
  MessageCircle,
  Phone,
} from "lucide-react";

import PropertyCard from "@/components/PropertyCard";
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
  const [profileResult, listingsResult] = await Promise.allSettled([
    agentApi.getPublicProfile(id),
    propertyApi.getAll({ ownerId: id, limit: LISTINGS_LIMIT }),
  ]);

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

/** One number and its label, as the strip under the header. */
function Stat({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Building2;
  value: string | number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-base font-semibold leading-tight text-foreground">
          {value}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {label}
        </span>
      </span>
    </div>
  );
}

export default async function AgentProfilePage({ params }: PageProps) {
  const { slug } = await params;
  const data = await getAgent(slug);

  if (!data) notFound();

  const { profile, listings, total, profileMissing } = data;
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

  const sections = [
    { key: "sale", title: "For sale", rows: forSale },
    { key: "rent", title: "For rent", rows: forRent },
  ].filter((section) => section.rows.length > 0);

  return (
    <div className="min-h-screen bg-secondary/10">
      <div className="container mx-auto px-4 pb-10 pt-20 sm:pt-24">
        {/* ─────────────────────────── header card ─────────────────────────── */}
        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
          <div className="h-16 bg-gradient-to-r from-primary/20 via-primary/8 to-transparent sm:h-20" />

          <div className="px-4 pb-5 sm:px-7 sm:pb-6">
            <div className="-mt-11 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-end">
              {/* The ring is what lifts the photo off the strip behind it. */}
              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-3xl font-semibold text-primary ring-4 ring-card sm:h-28 sm:w-28">
                {profile.avatarUrl ? (
                  // Not next/image: agent photos come from the media library and
                  // from older uploads on paths the image config does not cover.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatarUrl}
                    alt={name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials
                )}
              </div>

              <div className="min-w-0 flex-1 sm:pb-1">
                <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold text-foreground sm:text-3xl">
                  {name}
                  {total > 0 && (
                    <span
                      title="Has listings on PropertyDealer"
                      className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                    >
                      <BadgeCheck className="h-3.5 w-3.5" />
                      Active dealer
                    </span>
                  )}
                </h1>

                {profile.companyName && profile.name && (
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {profile.name}
                  </p>
                )}

                {profile.address && (
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0" />
                    {profile.address}
                  </p>
                )}
              </div>

              {(phone || whatsapp) && (
                <div className="flex shrink-0 gap-2 sm:pb-1">
                  {phone && (
                    <Button asChild className="flex-1 sm:flex-none">
                      <a href={`tel:${phone.replace(/\s/g, "")}`}>
                        <Phone className="mr-1.5 h-4 w-4" />
                        Call
                      </a>
                    </Button>
                  )}
                  {whatsapp && (
                    <Button
                      asChild
                      className="flex-1 border-none bg-[#25D366] text-white hover:bg-[#128C7E] sm:flex-none"
                    >
                      <a
                        href={`https://wa.me/${whatsapp.replace(/[^0-9]/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MessageCircle className="mr-1.5 h-4 w-4" />
                        WhatsApp
                      </a>
                    </Button>
                  )}
                </div>
              )}
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-border/60 pt-4 sm:grid-cols-4">
              <Stat
                icon={Building2}
                value={total}
                label={total === 1 ? "listing" : "listings"}
              />
              <Stat icon={Home} value={forSale.length} label="for sale" />
              <Stat icon={KeyRound} value={forRent.length} label="for rent" />
              {profile.experienceYears ? (
                <Stat
                  icon={Briefcase}
                  value={profile.experienceYears}
                  label="years in the market"
                />
              ) : memberSince ? (
                <Stat
                  icon={CalendarDays}
                  value={memberSince}
                  label="on PropertyDealer since"
                />
              ) : null}
            </dl>
          </div>
        </section>

        {/* ──────────────────────────── about ──────────────────────────── */}
        {(profile.bio || profile.experienceYears || memberSince) && (
          <section className="mt-5 rounded-2xl border border-border/60 bg-card p-5 shadow-sm sm:p-6">
            <h2 className="text-base font-semibold text-foreground">About</h2>

            {profile.bio && (
              <p className="mt-2.5 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {profile.bio}
              </p>
            )}

            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {profile.experienceYears ? (
                <span className="flex items-center gap-1.5">
                  <Briefcase className="h-4 w-4" />
                  {profile.experienceYears} years in the market
                </span>
              ) : null}
              {memberSince && (
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" />
                  On PropertyDealer since {memberSince}
                </span>
              )}
            </div>
          </section>
        )}

        {/* ─────────────────────────── listings ─────────────────────────── */}
        <section className="mt-5">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="text-xl font-bold text-foreground">
              {total > 0 ? `Listings by ${name}` : "Listings"}
            </h2>
            {total > listings.length && (
              <span className="text-sm text-muted-foreground">
                Showing {listings.length} of {total}
              </span>
            )}
          </div>

          {listings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/60 py-16 text-center">
              <p className="text-muted-foreground">
                {profileMissing
                  ? "Nothing is listed under this profile right now."
                  : "This agent has no active listings right now."}
              </p>
              <Button variant="outline" asChild className="mt-4">
                <Link href="/properties">Browse all properties</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-8">
              {sections.map((section) => (
                <div key={section.key}>
                  {sections.length > 1 && (
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      {section.title} ({section.rows.length})
                    </h3>
                  )}
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {section.rows.map((listing) => (
                      <PropertyCard
                        key={listing._id}
                        property={mapBackendToFrontendProperty(listing)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* A dealer's record is the thing buyers most need to flag. */}
        <div className="mt-8 flex justify-center">
          <ReportButton
            type="agent"
            agentId={profile._id}
            label="Report this agent"
          />
        </div>
      </div>
    </div>
  );
}

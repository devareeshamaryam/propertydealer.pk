import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Briefcase,
  Building2,
  CalendarDays,
  MapPin,
  MessageCircle,
  Phone,
} from "lucide-react";

import PropertyCard from "@/components/PropertyCard";
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
 */

const LISTINGS_LIMIT = 24;

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getAgent(slug: string) {
  const id = agentIdFromSlug(slug);
  if (!id) return null;

  let profile: AgentProfile;
  try {
    profile = await agentApi.getPublicProfile(id);
  } catch {
    return null;
  }

  // The profile is the page; its listings are a bonus and must not 404 it.
  let listings: BackendProperty[] = [];
  let total = 0;
  try {
    const response = await propertyApi.getAll({ ownerId: id, limit: LISTINGS_LIMIT });
    const rows = Array.isArray(response) ? response : (response?.properties ?? []);
    listings = rows as BackendProperty[];
    total = Array.isArray(response) ? rows.length : (response?.total ?? rows.length);
  } catch {
    listings = [];
  }

  return { profile, listings, total };
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

  const { profile, listings, total } = data;
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

  return (
    <div className="min-h-screen">
      <div className="pt-24 pb-8 bg-secondary/20">
        <div className="container mx-auto px-4">
          <div className="flex flex-col gap-5 rounded-2xl border border-border/60 bg-card p-5 sm:flex-row sm:items-start sm:p-6">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-primary/20 bg-primary/10 text-2xl font-semibold text-primary">
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

            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
                {name}
              </h1>

              {profile.companyName && profile.name && (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {profile.name}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Building2 className="h-4 w-4" />
                  {total} {total === 1 ? "listing" : "listings"}
                </span>
                {profile.experienceYears ? (
                  <span className="flex items-center gap-1.5">
                    <Briefcase className="h-4 w-4" />
                    {profile.experienceYears} years in the market
                  </span>
                ) : null}
                {profile.address && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    {profile.address}
                  </span>
                )}
                {memberSince && (
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="h-4 w-4" />
                    On PropertyDealer since {memberSince}
                  </span>
                )}
              </div>

              {profile.bio && (
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {profile.bio}
                </p>
              )}

              {(phone || whatsapp) && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {phone && (
                    <Button asChild size="sm">
                      <a href={`tel:${phone.replace(/\s/g, "")}`}>
                        <Phone className="mr-1.5 h-4 w-4" />
                        Call
                      </a>
                    </Button>
                  )}
                  {whatsapp && (
                    <Button asChild size="sm" variant="outline">
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
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <h2 className="mb-5 text-xl font-bold text-foreground">
          {total > 0 ? `Listings by ${name}` : "Listings"}
        </h2>

        {listings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-secondary/20 py-16 text-center">
            <p className="text-muted-foreground">
              This agent has no active listings right now.
            </p>
            <Button variant="outline" asChild className="mt-4">
              <Link href="/properties">Browse all properties</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((listing) => (
                <PropertyCard
                  key={listing._id}
                  property={mapBackendToFrontendProperty(listing)}
                />
              ))}
            </div>

            {total > listings.length && (
              <p className="mt-6 text-center text-sm text-muted-foreground">
                Showing {listings.length} of {total} listings.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

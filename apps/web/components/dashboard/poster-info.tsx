"use client";

import Link from "next/link";
import { BadgeCheck, Building2, ExternalLink, List, Mail, Phone, UserRound } from "lucide-react";
import { agentProfilePath } from "@/lib/agent";
import { cn } from "@/lib/utils";

/*
 * Who posted a listing, as the dashboard list returns it (`poster`). The
 * approval queue used to show a title and nothing about the account behind
 * it, so an admin could not tell an agency from a first-time owner.
 */

export interface Poster {
  _id: string;
  name: string;
  companyName: string;
  email?: string;
  phone?: string;
  role?: string;
  isActive?: boolean;
  joinedAt?: string | null;
  agency?: { _id: string; name: string } | null;
  plan?: string;
  listings?: number;
}

const label = (p: Poster) => p.companyName || p.name || p.email || "Unnamed account";

/** One line under a listing's title. */
export function PosterLine({ poster, className }: { poster?: Poster | null; className?: string }) {
  if (!poster) return <p className={cn("text-xs text-muted-foreground", className)}>Posted by: unknown account</p>;
  return (
    <p className={cn("flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground", className)}>
      <UserRound className="h-3 w-3 shrink-0" />
      <span className="font-medium text-slate-800">{label(poster)}</span>
      {poster.companyName && poster.name && poster.companyName !== poster.name && <span>({poster.name})</span>}
      {poster.agency && <span className="text-violet-700">· agent of {poster.agency.name}</span>}
      {poster.plan && (
        <span className={cn("rounded px-1 py-px text-[10.5px] font-semibold", poster.plan === "Free" ? "bg-slate-100 text-slate-600" : "bg-primary/10 text-primary")}>{poster.plan}</span>
      )}
      {poster.isActive === false && <span className="rounded bg-red-50 px-1 py-px text-[10.5px] font-semibold text-red-700">Inactive</span>}
    </p>
  );
}

/** The full card, for the review dialog. */
export function PosterCard({ poster }: { poster?: Poster | null }) {
  if (!poster) {
    return <div className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">The account that posted this listing could not be found.</div>;
  }
  const profile = agentProfilePath({ _id: poster._id, name: poster.name, companyName: poster.companyName });
  return (
    <div className="rounded-xl border bg-slate-50/60 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Posted by</p>
      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[15px] font-semibold">
        {poster.agency ? <UserRound className="h-4 w-4 text-slate-400" /> : <Building2 className="h-4 w-4 text-slate-400" />}
        {label(poster)}
        {poster.plan && poster.plan !== "Free" && <BadgeCheck className="h-4 w-4 text-sky-500" aria-label={poster.plan} />}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {[poster.companyName && poster.name ? poster.name : "", poster.role?.toLowerCase(), poster.plan ? `${poster.plan} plan` : "", poster.agency ? `agent of ${poster.agency.name}` : "", typeof poster.listings === "number" ? `${poster.listings} listings` : ""]
          .filter(Boolean)
          .join(" · ")}
        {poster.joinedAt ? ` · joined ${new Date(poster.joinedAt).toLocaleDateString("en-PK", { month: "short", year: "numeric" })}` : ""}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
        {poster.phone && (
          <a href={`tel:${poster.phone}`} className="inline-flex items-center gap-1 rounded-full border bg-white px-2.5 py-1 font-medium hover:border-primary">
            <Phone className="h-3 w-3" /> {poster.phone}
          </a>
        )}
        {poster.email && (
          <a href={`mailto:${poster.email}`} className="inline-flex items-center gap-1 rounded-full border bg-white px-2.5 py-1 font-medium hover:border-primary">
            <Mail className="h-3 w-3" /> {poster.email}
          </a>
        )}
        {profile && (
          <a href={profile} target="_blank" rel="noopener" className="inline-flex items-center gap-1 rounded-full border bg-white px-2.5 py-1 font-medium hover:border-primary">
            <ExternalLink className="h-3 w-3" /> Profile
          </a>
        )}
        <Link
          href={`/dashboard/property?ownerId=${poster._id}&owner=${encodeURIComponent(label(poster))}`}
          className="inline-flex items-center gap-1 rounded-full border bg-white px-2.5 py-1 font-medium hover:border-primary"
        >
          <List className="h-3 w-3" /> All their listings
        </Link>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Building2, MapPin } from "lucide-react";
import { getSpotlightAgencies } from "@/lib/server-api";
import { agentProfilePath } from "@/lib/agent";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Verified Property Agencies in Pakistan | PropertyDealer",
  description: "Verified real estate agencies on PropertyDealer — see their listings for sale and rent, and contact them directly by phone or WhatsApp.",
  alternates: { canonical: "/agents" },
};

/* /agents: the verified agencies (plans with the spotlight benefit), most listings first. */
export default async function AgentsPage() {
  const agencies = await getSpotlightAgencies();
  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        <BadgeCheck className="h-7 w-7 text-sky-500" /> Verified agencies
      </h1>
      <p className="mt-2 max-w-2xl text-[15px] text-slate-600">
        Established agencies on PropertyDealer. Each one carries the Verified badge on its profile and on every listing.
      </p>

      {agencies.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600">
          Verified agencies will appear here.
        </p>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {agencies.map((a) => (
            <Link
              key={a._id}
              href={agentProfilePath({ _id: a._id, name: a.name }) ?? "#"}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-primary"
            >
              <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-slate-100">
                {a.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.avatarUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <Building2 className="h-6 w-6 text-slate-400" />
                )}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1 font-semibold text-slate-900">
                  <span className="truncate">{a.name}</span>
                  <BadgeCheck className="h-4 w-4 shrink-0 text-sky-500" aria-label="Verified" />
                </span>
                {a.address && (
                  <span className="mt-0.5 flex items-center gap-1 truncate text-[12.5px] text-slate-500">
                    <MapPin className="h-3.5 w-3.5 shrink-0" /> {a.address}
                  </span>
                )}
                <span className="mt-0.5 block text-[12.5px] text-slate-500">{a.listings} live {a.listings === 1 ? "listing" : "listings"}</span>
              </span>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-10 rounded-2xl bg-slate-900 p-6 text-white sm:p-8">
        <h2 className="text-[20px] font-bold">Are you an agency?</h2>
        <p className="mt-1 max-w-2xl text-[14.5px] text-white/80">
          Get the Verified badge, instant publishing, a place on this page and agent accounts for your team.
        </p>
        <Link href="/packages" className="btn-shape mt-4 inline-flex h-11 items-center rounded-xl bg-white px-5 text-[14.5px] font-semibold text-slate-900">
          See agency packages
        </Link>
      </div>
    </div>
  );
}

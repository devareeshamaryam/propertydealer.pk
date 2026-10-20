import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { agentProfilePath, agentSlugPart } from "@/lib/agent";
import { AgentProfileView, agentMetadata, getAgent } from "./agent-view";

/**
 * An agent's or agency's public page. An agency's own agents live under the
 * agency — /agents/<agency>/<agent> — so their old single-level address
 * redirects there (permanently, so search engines move with it).
 */

/* Rendered on first visit, then cached; refreshed every 10 minutes and when the profile or a listing changes. */
export const revalidate = 600;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

function nestedPath(data: NonNullable<Awaited<ReturnType<typeof getAgent>>>): string | null {
  const agency = data.profile.agency;
  if (!agency) return null;
  return `${agentProfilePath({ _id: agency._id, companyName: agency.name })}/${agentSlugPart(data.profile)}`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getAgent(slug);
  if (data?.profile.profilePage === false) return agentMetadata(null, `/agents/${slug}`);
  return agentMetadata(data, (data && (nestedPath(data) ?? agentProfilePath(data.profile))) || `/agents/${slug}`);
}

export default async function AgentProfilePage({ params }: PageProps) {
  const { slug } = await params;
  const data = await getAgent(slug);
  // The plan has no profile page (Dashboard → Packages): there is no page.
  if (!data || data.profile.profilePage === false) notFound();
  const nested = nestedPath(data);
  if (nested) permanentRedirect(nested);
  return <AgentProfileView data={data} path={agentProfilePath(data.profile) ?? `/agents/${slug}`} />;
}

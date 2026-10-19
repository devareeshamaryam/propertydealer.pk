import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { agentIdFromSlug, agentProfilePath, agentSlugPart } from "@/lib/agent";
import { AgentProfileView, agentMetadata, getAgent } from "../agent-view";

/**
 * An agency's agent: /agents/<agency>/<agent>. Shown only under the agency the
 * agent belongs to — any other combination redirects to the right address.
 */

export const revalidate = 600;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

interface PageProps {
  params: Promise<{ slug: string; agent: string }>;
}

async function load(slug: string, agentSlug: string) {
  const data = await getAgent(agentSlug);
  if (!data) return { data: null, path: "", right: "" };
  const agency = data.profile.agency;
  const right = agency
    ? `${agentProfilePath({ _id: agency._id, companyName: agency.name })}/${agentSlugPart(data.profile)}`
    : agentProfilePath(data.profile) ?? "";
  const path = `/agents/${slug}/${agentSlug}`;
  const sameAgency = !!agency && agentIdFromSlug(slug) === agency._id;
  return { data, path: sameAgency ? right : path, right: sameAgency && path === right ? "" : right };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, agent } = await params;
  const { data, path, right } = await load(slug, agent);
  return agentMetadata(data, right || path);
}

export default async function AgencyAgentPage({ params }: PageProps) {
  const { slug, agent } = await params;
  const { data, path, right } = await load(slug, agent);
  if (!data) notFound();
  if (right) permanentRedirect(right);
  return <AgentProfileView data={data} path={path} />;
}
